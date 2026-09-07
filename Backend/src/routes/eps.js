import { Router } from 'express';
import { query } from '../config/db.js';
import { env } from '../config/loadEnv.js';
import * as eps from '../config/eps.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  clientIp,
  createPendingPayment,
  creditFromIpn,
  enrollFreeCourse,
  frontendBaseUrl,
  getSetting,
  logIpn,
  markInitFailed,
  newMerchantTransactionId,
  settingEnabled,
  verifyAndCredit,
  epsBridgeUrl,
} from '../services/epsPayment.js';

const router = Router();
const RECONCILE_KEY = env('EPS_RECONCILE_KEY', '');
let reconcileRunning = false;

function redirectCheckout(res, courseId, epsStatus, mtxn) {
  const front = frontendBaseUrl();
  const dest = courseId
    ? `${front}/checkout/${courseId}?eps=${epsStatus}&mtxn=${encodeURIComponent(mtxn || '')}`
    : `${front}/student/purchases?eps=${epsStatus}`;
  return res.redirect(dest);
}

router.post('/enrollments/checkout/eps', authenticate, authorize('student'), async (req, res) => {
  try {
    if (!eps.isConfigured()) {
      return res.status(503).json({ message: 'Online payment is not configured.' });
    }

    const enabled = await getSetting('eps_enabled', true);
    if (!settingEnabled(enabled)) {
      return res.status(400).json({ message: 'Online payment is currently disabled' });
    }

    const { course_id } = req.body || {};
    if (!course_id) return res.status(400).json({ message: 'course_id required' });

    const { rows: courses } = await query(
      `SELECT * FROM courses WHERE id = $1 AND status = 'approved'`,
      [course_id]
    );
    const course = courses[0];
    if (!course) return res.status(404).json({ message: 'Course not available' });

    const already = await query(
      'SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2',
      [req.user.id, course_id]
    );
    if (already.rows[0]) {
      return res.status(409).json({ message: 'Already enrolled' });
    }

    const amount = Number(Number(course.discount_price ?? course.price).toFixed(2));
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ message: 'Invalid course price' });
    }

    if (amount === 0) {
      const result = await enrollFreeCourse(req.user, course);
      return res.status(201).json({
        enrolled: true,
        enrollment: result.enrollment,
        message: 'Enrolled in free course.',
      });
    }

    const minRaw = await getSetting('min_recharge_amount', 1);
    const minAmount = Number(minRaw);
    if (Number.isFinite(minAmount) && amount < minAmount) {
      return res.status(400).json({ message: `Minimum payment amount is ${minAmount}` });
    }

    const merchantTransactionId = newMerchantTransactionId();
    await createPendingPayment({
      user: req.user,
      course,
      amount,
      merchantTransactionId,
    });

    const qs = `mtxn=${encodeURIComponent(merchantTransactionId)}`;

    try {
      const init = await eps.initializePayment({
        customerOrderId: `ORD${merchantTransactionId}`,
        merchantTransactionId,
        totalAmount: amount,
        ipAddress: clientIp(req),
        successUrl: epsBridgeUrl('callback', `type=success&${qs}`),
        failUrl: epsBridgeUrl('callback', `type=fail&${qs}`),
        cancelUrl: epsBridgeUrl('callback', `type=cancel&${qs}`),
        customerName: req.user.name,
        customerEmail: req.user.email,
        productName: String(course.title || 'Course purchase').slice(0, 120),
      });

      return res.json({
        redirectUrl: init.redirectUrl,
        merchantTransactionId,
        epsTransactionId: init.transactionId,
      });
    } catch (err) {
      await markInitFailed(merchantTransactionId, err.message);
      throw err;
    }
  } catch (err) {
    console.error('[EPS] init failed:', err.message);
    res.status(500).json({ message: err.message || 'Failed to start EPS payment' });
  }
});

router.post('/enrollments/checkout/eps/verify', authenticate, authorize('student'), async (req, res) => {
  try {
    const merchantTransactionId = String(req.body?.merchantTransactionId || '').trim();
    if (!merchantTransactionId) {
      return res.status(400).json({ message: 'merchantTransactionId required' });
    }

    const { rows } = await query(
      `SELECT * FROM payments WHERE transaction_id = $1 AND payment_method = 'eps'`,
      [merchantTransactionId]
    );
    const txn = rows[0];
    if (!txn || txn.student_id !== req.user.id) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    const result = await verifyAndCredit(merchantTransactionId);
    const paid = Boolean(result.ok);
    return res.json({
      status: result.reason,
      paid,
      reason: result.reason,
      course_id: result.courseId || txn.course_id,
      enrollment: result.enrollment || null,
    });
  } catch (err) {
    console.error('[EPS] verify failed:', err.message);
    res.status(500).json({ message: 'Verification failed' });
  }
});

async function handleCallback(req, res) {
  const type = String(req.query.type || req.body?.type || '').toLowerCase();
  const mtxn = String(req.query.mtxn || req.body?.mtxn || req.query.merchantTransactionId || '').trim();

  let courseId = null;
  if (mtxn) {
    const { rows } = await query(
      `SELECT course_id FROM payments WHERE transaction_id = $1 AND payment_method = 'eps'`,
      [mtxn]
    );
    courseId = rows[0]?.course_id || null;
  }

  if (type === 'cancel' || type === 'cancelled') {
    return redirectCheckout(res, courseId, 'cancelled', mtxn);
  }

  if (!mtxn) return redirectCheckout(res, courseId, 'failed', mtxn);

  const result = await verifyAndCredit(mtxn);
  if (result.ok) return redirectCheckout(res, result.courseId || courseId, 'success', mtxn);
  if (result.reason === 'pending') return redirectCheckout(res, result.courseId || courseId, 'pending', mtxn);
  return redirectCheckout(res, result.courseId || courseId, 'failed', mtxn);
}

router.get('/payment/eps/callback', handleCallback);
router.post('/payment/eps/callback', handleCallback);

async function handleIpn(req, res) {
  try {
    const data = req.body?.Data || req.body?.data;
    if (!data) return res.status(400).json({ status: 'ERROR', message: 'Invalid payload' });
    if (!eps.isIpnConfigured()) {
      console.error('[EPS][IPN] EPS_IPN_SECRET_KEY is not configured');
      return res.status(500).json({ status: 'ERROR', message: 'IPN not configured' });
    }

    let ipn;
    try {
      ipn = JSON.parse(eps.decryptIpn(data));
    } catch (err) {
      console.error('[EPS][IPN] decrypt/parse failed:', err.message);
      return res.status(400).json({ status: 'ERROR', message: 'Invalid payload' });
    }

    try {
      await logIpn(ipn);
    } catch (err) {
      console.error('[EPS][IPN] audit insert failed:', err.message);
    }

    const result = await creditFromIpn(ipn);
    return res.json({
      status: 'OK',
      message: 'IPN received and saved successfully',
      result: result.reason,
    });
  } catch (err) {
    console.error('[EPS][IPN] error:', err.message);
    return res.status(500).json({ status: 'ERROR', message: 'Decryption failed or internal error' });
  }
}

router.get('/payment/eps/ipn', (_req, res) => {
  res.json({ status: 'OK', message: 'EPS IPN endpoint ready' });
});
router.post('/payment/eps/ipn', handleIpn);

router.get('/payment/eps/reconcile-pending', async (req, res) => {
  const key = String(req.query.key || '');
  if (!RECONCILE_KEY || key !== RECONCILE_KEY) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (reconcileRunning) {
    return res.status(409).json({ message: 'Reconcile already running' });
  }

  reconcileRunning = true;
  const summary = { checked: 0, credited: 0, still_pending: 0, failed: 0, credited_txns: [] };
  try {
    const { rows } = await query(
      `SELECT transaction_id FROM payments
       WHERE payment_method = 'eps' AND payment_status = 'pending'
       ORDER BY created_at ASC
       LIMIT 200`
    );
    for (const row of rows) {
      summary.checked += 1;
      const result = await verifyAndCredit(row.transaction_id);
      if (result.ok) {
        summary.credited += 1;
        summary.credited_txns.push(row.transaction_id);
      } else if (result.reason === 'pending') {
        summary.still_pending += 1;
      } else {
        summary.failed += 1;
      }
    }
    res.json(summary);
  } catch (err) {
    console.error('[EPS] reconcile failed:', err.message);
    res.status(500).json({ message: 'Reconcile failed', ...summary });
  } finally {
    reconcileRunning = false;
  }
});

export default router;
