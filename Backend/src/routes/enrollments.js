import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { createNotification } from '../utils/helpers.js';

const router = Router();
const COMMISSION = Number(process.env.PLATFORM_COMMISSION_RATE || 0.2);

const DEMO_CARD = {
  name: 'Demo',
  number: '4242',
  expiry: '12/30',
  cvc: '123',
};

const normalizeCard = (value) => String(value || '').replace(/\s+/g, '').trim();

const isDemoCard = (card = {}) =>
  normalizeCard(card.name).toLowerCase() === DEMO_CARD.name.toLowerCase()
  && normalizeCard(card.number) === DEMO_CARD.number
  && normalizeCard(card.expiry) === DEMO_CARD.expiry
  && normalizeCard(card.cvc) === DEMO_CARD.cvc;

router.post('/checkout', authenticate, authorize('student'), async (req, res) => {
  try {
    const { course_id, payment_method = 'card', card } = req.body;
    if (!course_id) return res.status(400).json({ message: 'course_id required' });
    if (!isDemoCard(card)) {
      return res.status(400).json({
        message: 'Use the demo card: Demo / 4242 / 12/30 / 123',
      });
    }
    const card_last4 = DEMO_CARD.number.slice(-4);

    const { rows: courses } = await query(
      `SELECT * FROM courses WHERE id = $1 AND status = 'approved'`,
      [course_id]
    );
    const course = courses[0];
    if (!course) return res.status(404).json({ message: 'Course not available' });

    const existing = await query(
      'SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2',
      [req.user.id, course_id]
    );
    if (existing.rows[0]) {
      return res.status(409).json({ message: 'Already enrolled' });
    }

    const amount = Number(course.discount_price ?? course.price);
    const platform_fee = Number((amount * COMMISSION).toFixed(2));
    const instructor_earning = Number((amount - platform_fee).toFixed(2));
    const transaction_id = `TXN-${uuidv4().slice(0, 8).toUpperCase()}`;

    const { rows: enrollmentRows } = await query(
      `INSERT INTO enrollments (student_id, course_id) VALUES ($1,$2) RETURNING *`,
      [req.user.id, course_id]
    );
    const enrollment = enrollmentRows[0];

    const { rows: paymentRows } = await query(
      `INSERT INTO payments (
        enrollment_id, student_id, course_id, instructor_id, amount,
        platform_fee, instructor_earning, currency, payment_method, payment_status,
        transaction_id, card_last4
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,'BDT',$8,'completed',$9,$10) RETURNING *`,
      [
        enrollment.id,
        req.user.id,
        course_id,
        course.instructor_id,
        amount,
        platform_fee,
        instructor_earning,
        payment_method,
        transaction_id,
        card_last4,
      ]
    );

    await query(
      `UPDATE courses SET enrollment_count = enrollment_count + 1, updated_at = NOW() WHERE id = $1`,
      [course_id]
    );

    await createNotification({
      userId: req.user.id,
      type: 'enrollment',
      title: 'Enrollment confirmed',
      message: `You are now enrolled in "${course.title}". Happy learning!`,
      link: `/learn/${course.slug}`,
    });

    await createNotification({
      userId: course.instructor_id,
      type: 'enrollment',
      title: 'New student enrolled',
      message: `${req.user.name} enrolled in "${course.title}".`,
      link: '/instructor/earnings',
    });

    res.status(201).json({
      enrollment,
      payment: paymentRows[0],
      message: 'Payment successful. Enrollment confirmed.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Checkout failed' });
  }
});

router.get('/my-enrollments', authenticate, authorize('student', 'admin'), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT e.*, c.title, c.slug, c.thumbnail_url, c.price, c.average_rating,
              u.name AS instructor_name
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       JOIN users u ON u.id = c.instructor_id
       WHERE e.student_id = $1
       ORDER BY e.enrolled_at DESC`,
      [req.user.id]
    );
    res.json({ enrollments: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch enrollments' });
  }
});

router.get('/history', authenticate, authorize('student', 'admin'), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.*, c.title AS course_title, c.slug AS course_slug, c.thumbnail_url
       FROM payments p
       JOIN courses c ON c.id = p.course_id
       WHERE p.student_id = $1
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json({ payments: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch purchase history' });
  }
});

router.post('/progress', authenticate, authorize('student'), async (req, res) => {
  try {
    const { course_id, lesson_id } = req.body;
    const { rows } = await query(
      'SELECT * FROM enrollments WHERE student_id = $1 AND course_id = $2',
      [req.user.id, course_id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Enrollment not found' });

    const completed = new Set(rows[0].completed_lessons || []);
    if (lesson_id) completed.add(lesson_id);

    const totalLessons = await query(
      `SELECT COUNT(*) FROM lessons l
       JOIN modules m ON m.id = l.module_id
       WHERE m.course_id = $1`,
      [course_id]
    );
    const total = Number(totalLessons.rows[0].count) || 1;
    const progress = Math.min(100, Math.round((completed.size / total) * 10000) / 100);
    const is_completed = progress >= 100;

    const { rows: updated } = await query(
      `UPDATE enrollments SET
        completed_lessons = $1,
        progress_percentage = $2,
        is_completed = $3,
        completed_at = CASE WHEN $3 AND completed_at IS NULL THEN NOW() ELSE completed_at END,
        last_accessed_at = NOW()
       WHERE id = $4 RETURNING *`,
      [[...completed], progress, is_completed, rows[0].id]
    );

    res.json({ enrollment: updated[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update progress' });
  }
});

router.post('/certificate/:enrollmentId', authenticate, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT e.*, c.title AS course_title, u.name AS student_name
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       JOIN users u ON u.id = e.student_id
       WHERE e.id = $1`,
      [req.params.enrollmentId]
    );
    const enrollment = rows[0];
    if (!enrollment) return res.status(404).json({ message: 'Enrollment not found' });
    if (enrollment.student_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not allowed' });
    }
    if (!enrollment.is_completed && Number(enrollment.progress_percentage) < 100) {
      return res.status(400).json({ message: 'Complete the course to get a certificate' });
    }

    const existing = await query(
      'SELECT * FROM certificates WHERE enrollment_id = $1',
      [enrollment.id]
    );
    if (existing.rows[0]) {
      return res.json({ certificate: existing.rows[0] });
    }

    const code = `NEXUS-${uuidv4().slice(0, 10).toUpperCase()}`;
    const { rows: cert } = await query(
      `INSERT INTO certificates (enrollment_id, student_id, course_id, certificate_code)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [enrollment.id, enrollment.student_id, enrollment.course_id, code]
    );

    await query('UPDATE enrollments SET certificate_issued = TRUE WHERE id = $1', [enrollment.id]);

    res.status(201).json({
      certificate: {
        ...cert[0],
        student_name: enrollment.student_name,
        course_title: enrollment.course_title,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Certificate generation failed' });
  }
});

router.get('/certificate/verify/:code', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT cert.*, u.name AS student_name, c.title AS course_title, i.name AS instructor_name
       FROM certificates cert
       JOIN users u ON u.id = cert.student_id
       JOIN courses c ON c.id = cert.course_id
       JOIN users i ON i.id = c.instructor_id
       WHERE cert.certificate_code = $1`,
      [req.params.code]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Certificate not found' });
    res.json({ certificate: rows[0], valid: true });
  } catch (err) {
    res.status(500).json({ message: 'Verification failed' });
  }
});

export default router;
