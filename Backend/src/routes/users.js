import { Router } from 'express';
import { query } from '../config/db.js';
import { optionalAuth } from '../middleware/auth.js';
import { createNotification } from '../utils/helpers.js';

const router = Router();

router.get('/instructors/:id', optionalAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, name, email, avatar_url, bio, headline, expertise, website, social_links, created_at, is_verified
       FROM users WHERE id = $1 AND role IN ('instructor', 'admin')`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Instructor not found' });

    const { rows: courses } = await query(
      `SELECT c.*, cat.name AS category_name
       FROM courses c
       LEFT JOIN categories cat ON cat.id = c.category_id
       WHERE c.instructor_id = $1 AND c.status = 'approved'
       ORDER BY c.average_rating DESC`,
      [req.params.id]
    );

    const { rows: stats } = await query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'approved') AS courses,
        COALESCE(SUM(enrollment_count),0) AS students,
        COALESCE(AVG(average_rating) FILTER (WHERE review_count > 0),0) AS rating
       FROM courses WHERE instructor_id = $1`,
      [req.params.id]
    );

    res.json({ instructor: rows[0], courses, stats: stats[0] });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load instructor' });
  }
});

router.post('/contact', async (req, res) => {
  try {
    const sender_name = (req.body.sender_name || req.body.name || '').trim();
    const sender_email = (req.body.sender_email || req.body.email || '').trim();
    const { instructor_id, course_id, subject, message } = req.body;
    if (!sender_name || !sender_email || !String(message || '').trim()) {
      return res.status(400).json({ message: 'Name, email, and message required' });
    }

    const { rows } = await query(
      `INSERT INTO contact_messages (sender_name, sender_email, instructor_id, course_id, subject, message)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [sender_name, sender_email, instructor_id || null, course_id || null, subject || 'Inquiry', message]
    );

    if (instructor_id) {
      await createNotification({
        userId: instructor_id,
        type: 'system',
        title: 'New contact message',
        message: `${sender_name}: ${(subject || message).slice(0, 80)}`,
        link: '/instructor/messages',
      });
    }

    res.status(201).json({ message: 'Message sent', contact: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Failed to send message' });
  }
});

export default router;
