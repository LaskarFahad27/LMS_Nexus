import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, authorize('instructor', 'admin'));

router.get('/dashboard', async (req, res) => {
  try {
    const instructorId = req.user.role === 'admin' && req.query.instructorId
      ? req.query.instructorId
      : req.user.id;

    const stats = await query(
      `SELECT
        (SELECT COUNT(*) FROM courses WHERE instructor_id = $1) AS total_courses,
        (SELECT COUNT(*) FROM courses WHERE instructor_id = $1 AND status = 'approved') AS active_courses,
        (SELECT COUNT(*) FROM courses WHERE instructor_id = $1 AND status = 'pending') AS pending_courses,
        (SELECT COUNT(*) FROM courses WHERE instructor_id = $1 AND status = 'draft') AS draft_courses,
        (SELECT COALESCE(SUM(enrollment_count),0) FROM courses WHERE instructor_id = $1) AS total_students,
        (SELECT COALESCE(SUM(instructor_earning),0) FROM payments WHERE instructor_id = $1 AND payment_status = 'completed') AS total_revenue,
        (SELECT COALESCE(AVG(average_rating),0) FROM courses WHERE instructor_id = $1 AND review_count > 0) AS avg_rating`,
      [instructorId]
    );

    const { rows: courses } = await query(
      `SELECT c.*, cat.name AS category_name
       FROM courses c
       LEFT JOIN categories cat ON cat.id = c.category_id
       WHERE c.instructor_id = $1
       ORDER BY c.updated_at DESC`,
      [instructorId]
    );

    const { rows: recentEnrollments } = await query(
      `SELECT e.enrolled_at, u.name AS student_name, c.title AS course_title, p.amount
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       JOIN users u ON u.id = e.student_id
       LEFT JOIN payments p ON p.enrollment_id = e.id
       WHERE c.instructor_id = $1
       ORDER BY e.enrolled_at DESC LIMIT 8`,
      [instructorId]
    );

    const { rows: reviews } = await query(
      `SELECT r.*, u.name AS student_name, c.title AS course_title
       FROM reviews r
       JOIN courses c ON c.id = r.course_id
       JOIN users u ON u.id = r.student_id
       WHERE c.instructor_id = $1
       ORDER BY r.created_at DESC LIMIT 10`,
      [instructorId]
    );

    res.json({
      stats: stats.rows[0],
      courses,
      recentEnrollments,
      reviews,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load instructor dashboard' });
  }
});

router.get('/earnings', async (req, res) => {
  try {
    const { rows: summary } = await query(
      `SELECT
        COALESCE(SUM(instructor_earning),0) AS total_earnings,
        COALESCE(SUM(platform_fee),0) AS platform_fees,
        COALESCE(SUM(amount),0) AS gross_revenue,
        COUNT(*) AS transactions
       FROM payments
       WHERE instructor_id = $1 AND payment_status = 'completed'`,
      [req.user.id]
    );

    const { rows: monthly } = await query(
      `SELECT TO_CHAR(created_at, 'YYYY-MM') AS month,
              SUM(instructor_earning) AS earnings,
              COUNT(*) AS sales
       FROM payments
       WHERE instructor_id = $1 AND payment_status = 'completed'
       GROUP BY 1 ORDER BY 1 DESC LIMIT 12`,
      [req.user.id]
    );

    const { rows: transactions } = await query(
      `SELECT p.*, c.title AS course_title, u.name AS student_name
       FROM payments p
       JOIN courses c ON c.id = p.course_id
       JOIN users u ON u.id = p.student_id
       WHERE p.instructor_id = $1
       ORDER BY p.created_at DESC LIMIT 50`,
      [req.user.id]
    );

    res.json({ summary: summary[0], monthly, transactions });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load earnings' });
  }
});

router.get('/analytics', async (req, res) => {
  try {
    const { rows: engagement } = await query(
      `SELECT c.id, c.title, c.enrollment_count, c.average_rating, c.review_count, c.status,
              COALESCE(AVG(e.progress_percentage),0) AS avg_progress,
              COUNT(e.id) FILTER (WHERE e.is_completed) AS completions
       FROM courses c
       LEFT JOIN enrollments e ON e.course_id = c.id
       WHERE c.instructor_id = $1
       GROUP BY c.id
       ORDER BY c.enrollment_count DESC`,
      [req.user.id]
    );

    const { rows: monthlyEnrollments } = await query(
      `SELECT TO_CHAR(e.enrolled_at, 'YYYY-MM') AS month, COUNT(*)::int AS enrollments
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       WHERE c.instructor_id = $1
       GROUP BY 1 ORDER BY 1 ASC LIMIT 12`,
      [req.user.id]
    );

    const { rows: monthlyRevenue } = await query(
      `SELECT TO_CHAR(created_at, 'YYYY-MM') AS month,
              COALESCE(SUM(instructor_earning),0) AS earnings,
              COUNT(*)::int AS sales
       FROM payments
       WHERE instructor_id = $1 AND payment_status = 'completed'
       GROUP BY 1 ORDER BY 1 ASC LIMIT 12`,
      [req.user.id]
    );

    const { rows: totals } = await query(
      `SELECT
        COALESCE(SUM(c.enrollment_count),0) AS students,
        COALESCE(AVG(c.average_rating) FILTER (WHERE c.review_count > 0),0) AS avg_rating,
        (SELECT COALESCE(AVG(e.progress_percentage),0)
           FROM enrollments e JOIN courses c ON c.id = e.course_id
           WHERE c.instructor_id = $1) AS avg_progress,
        (SELECT COUNT(*) FROM enrollments e JOIN courses c ON c.id = e.course_id
           WHERE c.instructor_id = $1 AND e.is_completed) AS completions,
        (SELECT COUNT(*) FROM courses WHERE instructor_id = $1) AS courses
       FROM courses c WHERE c.instructor_id = $1`,
      [req.user.id]
    );

    res.json({ engagement, monthlyEnrollments, monthlyRevenue, totals: totals[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load analytics' });
  }
});

router.get('/messages', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM contact_messages WHERE instructor_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ messages: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load messages' });
  }
});

export default router;
