import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    const unread = rows.filter((n) => !n.is_read).length;
    res.json({ notifications: rows, unread });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    await query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update notification' });
  }
});

router.post('/read-all', authenticate, async (req, res) => {
  try {
    await query(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1`, [req.user.id]);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Failed' });
  }
});

router.get('/wishlist', authenticate, authorize('student'), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT w.id AS wishlist_id, w.created_at AS wishlisted_at, c.*,
              u.name AS instructor_name, cat.name AS category_name
       FROM wishlists w
       JOIN courses c ON c.id = w.course_id
       JOIN users u ON u.id = c.instructor_id
       LEFT JOIN categories cat ON cat.id = c.category_id
       WHERE w.student_id = $1
       ORDER BY w.created_at DESC`,
      [req.user.id]
    );
    res.json({ wishlist: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch wishlist' });
  }
});

router.post('/wishlist/:courseId', authenticate, authorize('student'), async (req, res) => {
  try {
    const { rows } = await query(
      `INSERT INTO wishlists (student_id, course_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING RETURNING *`,
      [req.user.id, req.params.courseId]
    );
    res.status(201).json({ wishlist: rows[0] || { message: 'Already wishlisted' } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add wishlist' });
  }
});

router.delete('/wishlist/:courseId', authenticate, authorize('student'), async (req, res) => {
  try {
    await query('DELETE FROM wishlists WHERE student_id = $1 AND course_id = $2', [
      req.user.id,
      req.params.courseId,
    ]);
    res.json({ message: 'Removed from wishlist' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to remove wishlist' });
  }
});

export default router;
