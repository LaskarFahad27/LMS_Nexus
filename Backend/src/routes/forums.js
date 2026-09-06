import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/course/:courseId', authenticate, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT t.*, u.name AS author_name, u.avatar_url AS author_avatar,
              (SELECT COUNT(*) FROM forum_replies fr WHERE fr.thread_id = t.id) AS reply_count
       FROM forum_threads t
       JOIN users u ON u.id = t.author_id
       WHERE t.course_id = $1
       ORDER BY t.is_pinned DESC, t.created_at DESC`,
      [req.params.courseId]
    );
    res.json({ threads: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch threads' });
  }
});

router.post('/course/:courseId', authenticate, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ message: 'Title and content required' });

    const { rows } = await query(
      `INSERT INTO forum_threads (course_id, author_id, title, content)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.courseId, req.user.id, title, content]
    );
    res.status(201).json({ thread: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create thread' });
  }
});

router.get('/threads/:threadId', authenticate, async (req, res) => {
  try {
    const { rows: threads } = await query(
      `SELECT t.*, u.name AS author_name, u.avatar_url AS author_avatar
       FROM forum_threads t JOIN users u ON u.id = t.author_id WHERE t.id = $1`,
      [req.params.threadId]
    );
    if (!threads[0]) return res.status(404).json({ message: 'Thread not found' });

    const { rows: replies } = await query(
      `SELECT r.*, u.name AS author_name, u.avatar_url AS author_avatar, u.role AS author_role
       FROM forum_replies r JOIN users u ON u.id = r.author_id
       WHERE r.thread_id = $1 ORDER BY r.created_at ASC`,
      [req.params.threadId]
    );

    res.json({ thread: threads[0], replies });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch thread' });
  }
});

router.post('/threads/:threadId/replies', authenticate, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ message: 'Content required' });

    const { rows } = await query(
      `INSERT INTO forum_replies (thread_id, author_id, content) VALUES ($1,$2,$3) RETURNING *`,
      [req.params.threadId, req.user.id, content]
    );
    await query('UPDATE forum_threads SET updated_at = NOW() WHERE id = $1', [req.params.threadId]);
    res.status(201).json({ reply: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reply' });
  }
});

export default router;
