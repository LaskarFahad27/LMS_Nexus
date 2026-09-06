import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { createNotification } from '../utils/helpers.js';
import { isPlainSecretString, sanitizeSettings } from '../services/chatbot.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/dashboard', async (_req, res) => {
  try {
    const { rows: stats } = await query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'student') AS students,
        (SELECT COUNT(*) FROM users WHERE role = 'instructor') AS instructors,
        (SELECT COUNT(*) FROM courses) AS total_courses,
        (SELECT COUNT(*) FROM courses WHERE status = 'pending') AS pending_courses,
        (SELECT COUNT(*) FROM courses WHERE status = 'approved') AS approved_courses,
        (SELECT COALESCE(SUM(amount),0) FROM payments WHERE payment_status = 'completed') AS gross_revenue,
        (SELECT COALESCE(SUM(platform_fee),0) FROM payments WHERE payment_status = 'completed') AS platform_revenue,
        (SELECT COUNT(*) FROM enrollments) AS total_enrollments
    `);

    const { rows: pending } = await query(
      `SELECT c.*, u.name AS instructor_name, u.email AS instructor_email, cat.name AS category_name
       FROM courses c
       JOIN users u ON u.id = c.instructor_id
       LEFT JOIN categories cat ON cat.id = c.category_id
       WHERE c.status = 'pending'
       ORDER BY c.created_at ASC`
    );

    const { rows: recentUsers } = await query(
      `SELECT id, name, email, role, created_at, is_banned, last_login
       FROM users ORDER BY created_at DESC LIMIT 10`
    );

    const { rows: revenueByMonth } = await query(
      `SELECT TO_CHAR(created_at, 'YYYY-MM') AS month,
              SUM(amount) AS gross,
              SUM(platform_fee) AS platform
       FROM payments WHERE payment_status = 'completed'
       GROUP BY 1 ORDER BY 1 DESC LIMIT 12`
    );

    res.json({
      stats: stats[0],
      pendingCourses: pending,
      recentUsers,
      revenueByMonth,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Admin dashboard failed' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const { role, search } = req.query;
    const clauses = [];
    const params = [];
    let i = 1;

    if (role) {
      clauses.push(`role = $${i}`);
      params.push(role);
      i += 1;
    }
    if (search) {
      clauses.push(`(name ILIKE $${i} OR email ILIKE $${i})`);
      params.push(`%${search}%`);
      i += 1;
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT id, name, email, role, avatar_url, is_banned, is_verified, created_at, last_login
       FROM users ${where} ORDER BY created_at DESC LIMIT 100`,
      params
    );
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

router.patch('/users/:id/ban', async (req, res) => {
  try {
    const { ban = true } = req.body;
    const { rows } = await query(
      `UPDATE users SET is_banned = $1, updated_at = NOW() WHERE id = $2 AND role != 'admin'
       RETURNING id, name, email, role, is_banned`,
      [ban, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'User not found' });

    await createNotification({
      userId: rows[0].id,
      type: 'system',
      title: ban ? 'Account suspended' : 'Account reinstated',
      message: ban
        ? 'Your account has been suspended for violating platform terms.'
        : 'Your account access has been restored.',
    });

    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update user' });
  }
});

router.get('/courses', async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status) {
      where = 'WHERE c.status = $1';
      params.push(status);
    }

    const { rows } = await query(
      `SELECT c.*, u.name AS instructor_name, u.email AS instructor_email, cat.name AS category_name
       FROM courses c
       JOIN users u ON u.id = c.instructor_id
       LEFT JOIN categories cat ON cat.id = c.category_id
       ${where}
       ORDER BY c.created_at DESC`,
      params
    );
    res.json({ courses: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch courses' });
  }
});

router.post('/courses/:id/review', async (req, res) => {
  try {
    const { decision, feedback } = req.body;
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ message: 'decision must be approve or reject' });
    }

    const status = decision === 'approve' ? 'approved' : 'rejected';
    const { rows } = await query(
      `UPDATE courses SET
        status = $1::course_status,
        rejection_reason = $2,
        published_at = CASE WHEN $1::course_status = 'approved' THEN NOW() ELSE published_at END,
        is_trending = CASE WHEN $1::course_status = 'approved' THEN is_trending ELSE FALSE END,
        updated_at = NOW()
       WHERE id = $3 AND status = 'pending'
       RETURNING *`,
      [status, decision === 'reject' ? feedback || 'Does not meet quality guidelines' : null, req.params.id]
    );

    if (!rows[0]) return res.status(404).json({ message: 'Pending course not found' });

    await createNotification({
      userId: rows[0].instructor_id,
      type: decision === 'approve' ? 'approval' : 'rejection',
      title: decision === 'approve' ? 'Course approved' : 'Course rejected',
      message:
        decision === 'approve'
          ? `"${rows[0].title}" is now live on the marketplace.`
          : `"${rows[0].title}" was rejected. ${feedback || ''}`,
      link: '/instructor/courses',
    });

    res.json({ course: rows[0], message: `Course ${status}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Review failed' });
  }
});

router.patch('/courses/:id/feature', async (req, res) => {
  try {
    const { featured = true, trending } = req.body;
    const { rows } = await query(
      `UPDATE courses SET
        is_featured = COALESCE($1, is_featured),
        is_trending = COALESCE($2, is_trending),
        updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [featured, trending ?? null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Course not found' });
    res.json({ course: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update course flags' });
  }
});

router.get('/payments', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.*, c.title AS course_title, s.name AS student_name, i.name AS instructor_name
       FROM payments p
       JOIN courses c ON c.id = p.course_id
       JOIN users s ON s.id = p.student_id
       JOIN users i ON i.id = p.instructor_id
       ORDER BY p.created_at DESC LIMIT 100`
    );
    res.json({ payments: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch payments' });
  }
});

router.patch('/payments/:id/refund', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE payments SET payment_status = 'refunded' WHERE id = $1 AND payment_status = 'completed'
       RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Payment not found' });

    await createNotification({
      userId: rows[0].student_id,
      type: 'payment',
      title: 'Refund processed',
      message: `A refund of ৳${rows[0].amount} has been processed.`,
    });

    res.json({ payment: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Refund failed' });
  }
});

router.post('/announcements', async (req, res) => {
  try {
    const { title, message, target_role = 'all' } = req.body;
    if (!title || !message) return res.status(400).json({ message: 'Title and message required' });

    const { rows } = await query(
      `INSERT INTO announcements (admin_id, title, message, target_role)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.id, title, message, target_role]
    );

    let usersQuery = 'SELECT id FROM users WHERE is_banned = FALSE';
    const params = [];
    if (target_role !== 'all') {
      usersQuery += ' AND role = $1';
      params.push(target_role);
    }

    const { rows: users } = await query(usersQuery, params);
    for (const u of users) {
      await createNotification({
        userId: u.id,
        type: 'announcement',
        title,
        message,
        link: '/',
      });
    }

    res.status(201).json({ announcement: rows[0], recipients: users.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Announcement failed' });
  }
});

router.get('/settings', async (_req, res) => {
  try {
    const { rows } = await query('SELECT * FROM platform_settings');
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json({ settings: sanitizeSettings(settings) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load settings' });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const entries = Object.entries(req.body || {});
    for (const [key, value] of entries) {
      if (key === 'craftx_api_key') {
        if (value === null || value === '__CLEAR__') {
          await query(
            `INSERT INTO platform_settings (key, value, updated_at)
             VALUES ($1, $2::jsonb, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [key, JSON.stringify('')]
          );
          continue;
        }
        if (!isPlainSecretString(value)) continue;
      }

      await query(
        `INSERT INTO platform_settings (key, value, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, JSON.stringify(value)]
      );
    }
    res.json({ message: 'Settings updated' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update settings' });
  }
});

router.get('/reports', async (_req, res) => {
  try {
    const { rows: topCourses } = await query(
      `SELECT id, title, enrollment_count, average_rating, price
       FROM courses WHERE status = 'approved'
       ORDER BY enrollment_count DESC LIMIT 10`
    );
    const { rows: topInstructors } = await query(
      `SELECT u.id, u.name, COUNT(DISTINCT c.id) AS courses,
              COALESCE(SUM(DISTINCT c.enrollment_count),0) AS students,
              COALESCE((SELECT SUM(p.instructor_earning) FROM payments p
                        WHERE p.instructor_id = u.id AND p.payment_status = 'completed'),0) AS earnings
       FROM users u
       LEFT JOIN courses c ON c.instructor_id = u.id
       WHERE u.role = 'instructor'
       GROUP BY u.id
       ORDER BY earnings DESC LIMIT 10`
    );
    const { rows: revenueByMonth } = await query(
      `SELECT TO_CHAR(created_at, 'YYYY-MM') AS month,
              COALESCE(SUM(amount),0) AS gross,
              COALESCE(SUM(platform_fee),0) AS platform
       FROM payments WHERE payment_status = 'completed'
       GROUP BY 1 ORDER BY 1 ASC LIMIT 12`
    );
    const { rows: enrollmentsByMonth } = await query(
      `SELECT TO_CHAR(enrolled_at, 'YYYY-MM') AS month, COUNT(*)::int AS enrollments
       FROM enrollments GROUP BY 1 ORDER BY 1 ASC LIMIT 12`
    );
    const { rows: courseStatus } = await query(
      `SELECT status, COUNT(*)::int AS count FROM courses GROUP BY status`
    );
    const { rows: usersByRole } = await query(
      `SELECT role, COUNT(*)::int AS count FROM users GROUP BY role`
    );
    const { rows: categoryMix } = await query(
      `SELECT COALESCE(cat.name, 'Uncategorized') AS name, COUNT(c.id)::int AS count
       FROM courses c
       LEFT JOIN categories cat ON cat.id = c.category_id
       WHERE c.status = 'approved'
       GROUP BY 1 ORDER BY count DESC`
    );
    const { rows: kpis } = await query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'student') AS students,
        (SELECT COUNT(*) FROM users WHERE role = 'instructor') AS instructors,
        (SELECT COUNT(*) FROM courses WHERE status = 'approved') AS live_courses,
        (SELECT COUNT(*) FROM enrollments) AS enrollments,
        (SELECT COALESCE(SUM(amount),0) FROM payments WHERE payment_status = 'completed') AS gross,
        (SELECT COALESCE(SUM(platform_fee),0) FROM payments WHERE payment_status = 'completed') AS platform
    `);

    res.json({
      topCourses,
      topInstructors,
      revenueByMonth,
      enrollmentsByMonth,
      courseStatus,
      usersByRole,
      categoryMix,
      kpis: kpis[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Report generation failed' });
  }
});

export default router;
