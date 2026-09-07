import { randomInt } from 'crypto';
import { pool, query } from '../config/db.js';
import * as eps from '../config/eps.js';
import { createNotification } from '../utils/helpers.js';
import { env } from '../config/loadEnv.js';

const COMMISSION = Number(env('PLATFORM_COMMISSION_RATE', '0.2'));

export function newMerchantTransactionId() {
  return `${Date.now()}${randomInt(1000, 10000)}`;
}

export function frontendBaseUrl() {
  const explicit = env('FRONTEND_URL', '');
  if (explicit) return explicit.replace(/\/$/, '');
  const first = String(env('CLIENT_URL', 'http://localhost:5173'))
    .split(',')
    .map((s) => s.trim())
    .find(Boolean);
  return (first || 'http://localhost:5173').replace(/\/$/, '');
}

export function callbackBaseUrl() {
  return env('EPS_CALLBACK_BASE_URL', env('PUBLIC_URL', 'http://localhost:5000')).replace(/\/$/, '');
}

export function epsBridgeUrl(action, extraQuery = '') {
  const base = callbackBaseUrl();
  const script = env('EPS_BRIDGE_PATH', '/eps-bridge.php');
  const params = extraQuery ? `&${extraQuery}` : '';
  return `${base}${script}?action=${encodeURIComponent(action)}${params}`;
}

export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  let ip = forwarded
    ? String(forwarded).split(',')[0].trim()
    : req.ip || req.socket?.remoteAddress || '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (!ip || ip === '::1' || ip.includes(':')) return '0.0.0.0';
  return ip;
}

export async function getSetting(key, fallback) {
  const { rows } = await query('SELECT value FROM platform_settings WHERE key = $1', [key]);
  if (!rows[0]) return fallback;
  return rows[0].value;
}

export function settingEnabled(value) {
  if (value === false || value === 'false' || value === '"false"') return false;
  return true;
}

async function notifyEnrollment(txn, enrollment) {
  try {
    const { rows } = await query(
      `SELECT c.title, c.slug, u.name AS student_name
       FROM courses c
       JOIN users u ON u.id = $2
       WHERE c.id = $1`,
      [txn.course_id, txn.student_id]
    );
    const course = rows[0];
    if (!course) return;
    await createNotification({
      userId: txn.student_id,
      type: 'enrollment',
      title: 'Enrollment confirmed',
      message: `You are now enrolled in "${course.title}". Happy learning!`,
      link: `/learn/${course.slug}`,
    });
    await createNotification({
      userId: txn.instructor_id,
      type: 'enrollment',
      title: 'New student enrolled',
      message: `${course.student_name} enrolled in "${course.title}".`,
      link: '/instructor/earnings',
    });
    return { enrollment, course };
  } catch (err) {
    console.error('[EPS] notify failed:', err.message);
    return { enrollment };
  }
}

export async function settleTransaction(merchantTransactionId, resolveOutcome, source) {
  if (!merchantTransactionId) return { ok: false, reason: 'no-mtxn' };

  const client = await pool.connect();
  let creditedTxn = null;
  let enrollment = null;
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM payments
       WHERE transaction_id = $1 AND payment_method = 'eps'
       FOR UPDATE`,
      [merchantTransactionId]
    );
    const txn = rows[0];
    if (!txn) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'not-found' };
    }
    if (txn.payment_status === 'completed') {
      await client.query('ROLLBACK');
      return { ok: true, reason: 'already', courseId: txn.course_id, studentId: txn.student_id };
    }
    if (txn.payment_status === 'failed' || txn.payment_status === 'refunded') {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'rejected', courseId: txn.course_id };
    }

    const outcome = await resolveOutcome(txn);
    const status = String(outcome.status || '').toLowerCase();
    const paidAmount = Number(outcome.totalAmount);

    if (status !== 'success') {
      if (['', 'pending', 'initiated', 'processing'].includes(status)) {
        await client.query('ROLLBACK');
        return { ok: false, reason: 'pending', courseId: txn.course_id };
      }
      await client.query(
        `UPDATE payments
         SET payment_status = 'failed', rejection_reason = $1, reviewed_at = NOW()
         WHERE id = $2`,
        [`Gateway status: ${outcome.status}`.slice(0, 255), txn.id]
      );
      await client.query('COMMIT');
      return { ok: false, reason: 'failed', status: outcome.status, courseId: txn.course_id };
    }

    if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - Number(txn.amount)) > 0.01) {
      await client.query(
        `UPDATE payments
         SET payment_status = 'failed', rejection_reason = $1, reviewed_at = NOW()
         WHERE id = $2`,
        [`Amount mismatch: paid ${outcome.totalAmount}, expected ${txn.amount}`.slice(0, 255), txn.id]
      );
      await client.query('COMMIT');
      return { ok: false, reason: 'amount-mismatch', courseId: txn.course_id };
    }

    const existing = await client.query(
      `SELECT * FROM enrollments WHERE student_id = $1 AND course_id = $2 FOR UPDATE`,
      [txn.student_id, txn.course_id]
    );
    enrollment = existing.rows[0];
    if (!enrollment) {
      try {
        const inserted = await client.query(
          `INSERT INTO enrollments (student_id, course_id) VALUES ($1, $2) RETURNING *`,
          [txn.student_id, txn.course_id]
        );
        enrollment = inserted.rows[0];
        await client.query(
          `UPDATE courses SET enrollment_count = enrollment_count + 1, updated_at = NOW() WHERE id = $1`,
          [txn.course_id]
        );
      } catch (err) {
        if (err.code !== '23505') throw err;
        const again = await client.query(
          `SELECT * FROM enrollments WHERE student_id = $1 AND course_id = $2`,
          [txn.student_id, txn.course_id]
        );
        enrollment = again.rows[0];
      }
    }

    await client.query(
      `UPDATE payments
       SET payment_status = 'completed',
           enrollment_id = $1,
           eps_transaction_id = $2,
           rejection_reason = NULL,
           reviewed_at = NOW()
       WHERE id = $3`,
      [enrollment.id, outcome.epsTransactionId || txn.eps_transaction_id || null, txn.id]
    );

    await client.query('COMMIT');
    creditedTxn = txn;
    console.log(
      `[EPS] credited via ${source} txn=${merchantTransactionId} user=${txn.student_id} amount=${txn.amount}`
    );
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    console.error(`[EPS] settle error (${source}):`, err.message);
    return { ok: false, reason: 'error' };
  } finally {
    client.release();
  }

  if (!creditedTxn) return { ok: false, reason: 'error' };
  const extra = await notifyEnrollment(creditedTxn, enrollment);
  return {
    ok: true,
    reason: 'credited',
    courseId: creditedTxn.course_id,
    studentId: creditedTxn.student_id,
    amount: Number(creditedTxn.amount),
    enrollment,
    course: extra?.course,
  };
}

export async function verifyAndCredit(mtxn) {
  return settleTransaction(
    mtxn,
    async () => {
      const v = await eps.verifyTransaction({ merchantTransactionId: mtxn });
      return {
        status: v.Status,
        totalAmount: v.TotalAmount,
        epsTransactionId: v.EpsTransactionId,
      };
    },
    'callback'
  );
}

export async function creditFromIpn(ipn) {
  return settleTransaction(
    ipn.MerchantTransactionId,
    async () => ({
      status: ipn.Status,
      totalAmount: ipn.TotalAmount,
      epsTransactionId: ipn.EpsTransactionId,
    }),
    'ipn'
  );
}

export async function createPendingPayment({ user, course, amount, merchantTransactionId }) {
  const platform_fee = Number((amount * COMMISSION).toFixed(2));
  const instructor_earning = Number((amount - platform_fee).toFixed(2));
  const { rows } = await query(
    `INSERT INTO payments (
      enrollment_id, student_id, course_id, instructor_id, amount,
      platform_fee, instructor_earning, currency, payment_method, payment_status,
      transaction_id
    ) VALUES (NULL,$1,$2,$3,$4,$5,$6,'BDT','eps','pending',$7)
    RETURNING *`,
    [user.id, course.id, course.instructor_id, amount, platform_fee, instructor_earning, merchantTransactionId]
  );
  return rows[0];
}

export async function markInitFailed(merchantTransactionId, message) {
  await query(
    `UPDATE payments
     SET payment_status = 'failed', rejection_reason = $2, reviewed_at = NOW()
     WHERE transaction_id = $1 AND payment_method = 'eps' AND payment_status = 'pending'`,
    [merchantTransactionId, String(message || 'Gateway init failed').slice(0, 255)]
  );
}

export async function logIpn(ipn) {
  await query(
    `INSERT INTO eps_ipn_log (
      eps_transaction_id, merchant_transaction_id, store_id, status, total_amount,
      store_amount, transaction_type, financial_entity, ipn_timestamp, raw_json
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      ipn.EpsTransactionId || null,
      ipn.MerchantTransactionId || null,
      ipn.StoreId != null ? String(ipn.StoreId) : null,
      ipn.Status || null,
      Number(ipn.TotalAmount) || 0,
      Number(ipn.StoreAmount) || 0,
      ipn.TransactionType || null,
      ipn.FinancialEntity || null,
      ipn.Timestamp || null,
      JSON.stringify(ipn).slice(0, 65000),
    ]
  );
}

export async function enrollFreeCourse(user, course) {
  const existing = await query(
    'SELECT * FROM enrollments WHERE student_id = $1 AND course_id = $2',
    [user.id, course.id]
  );
  if (existing.rows[0]) return { enrollment: existing.rows[0], already: true };

  const { rows } = await query(
    `INSERT INTO enrollments (student_id, course_id) VALUES ($1,$2) RETURNING *`,
    [user.id, course.id]
  );
  await query(
    `UPDATE courses SET enrollment_count = enrollment_count + 1, updated_at = NOW() WHERE id = $1`,
    [course.id]
  );
  const txn = {
    student_id: user.id,
    course_id: course.id,
    instructor_id: course.instructor_id,
  };
  await notifyEnrollment(txn, rows[0]);
  return { enrollment: rows[0], already: false };
}
