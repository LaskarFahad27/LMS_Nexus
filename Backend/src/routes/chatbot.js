import { Router } from 'express';
import { query } from '../config/db.js';
import { optionalAuth } from '../middleware/auth.js';
import { replyToChat, getChatbotConfig } from '../services/chatbot.js';

const router = Router();

const rateBuckets = new Map();

const rateLimit = (req, res, next) => {
  const key = req.user?.id || req.ip || 'anon';
  const now = Date.now();
  const windowMs = 60_000;
  const max = 24;
  const bucket = rateBuckets.get(key) || [];
  const recent = bucket.filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    return res.status(429).json({ message: 'You are sending messages too quickly. Please wait a moment.' });
  }
  recent.push(now);
  rateBuckets.set(key, recent);
  next();
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveSession(sessionId, userId) {
  if (sessionId && UUID_RE.test(sessionId)) {
    const { rows } = await query('SELECT * FROM chatbot_sessions WHERE id = $1', [sessionId]);
    const existing = rows[0];
    if (existing) {
      if (userId && existing.user_id && existing.user_id !== userId) {
        /* fall through and create a fresh session */
      } else {
        if (userId && !existing.user_id) {
          await query('UPDATE chatbot_sessions SET user_id = $1, updated_at = NOW() WHERE id = $2', [userId, existing.id]);
        }
        return existing.id;
      }
    }
  }
  const { rows } = await query(
    'INSERT INTO chatbot_sessions (user_id) VALUES ($1) RETURNING id',
    [userId || null]
  );
  return rows[0].id;
}

async function loadHistory(sessionId, limit = 24) {
  const { rows } = await query(
    `SELECT id, role, content, courses, sources, created_at
     FROM chatbot_messages
     WHERE session_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [sessionId, limit]
  );
  return rows;
}

router.get('/status', async (_req, res) => {
  try {
    const config = await getChatbotConfig();
    res.json({
      enabled: config.enabled,
      configured: Boolean(config.apiKey),
      model: config.model,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load chatbot status' });
  }
});

router.get('/history', optionalAuth, async (req, res) => {
  try {
    const sessionId = String(req.query.session_id || '');
    if (!UUID_RE.test(sessionId)) return res.json({ session_id: null, messages: [] });

    const { rows } = await query('SELECT * FROM chatbot_sessions WHERE id = $1', [sessionId]);
    if (!rows[0]) return res.json({ session_id: sessionId, messages: [] });
    if (req.user?.id && rows[0].user_id && rows[0].user_id !== req.user.id) {
      return res.json({ session_id: null, messages: [] });
    }

    const messages = await loadHistory(sessionId);
    res.json({ session_id: sessionId, messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load chat history' });
  }
});

router.delete('/history', optionalAuth, async (req, res) => {
  try {
    const sessionId = String(req.query.session_id || req.body?.session_id || '');
    if (UUID_RE.test(sessionId)) {
      await query('DELETE FROM chatbot_messages WHERE session_id = $1', [sessionId]);
      await query('UPDATE chatbot_sessions SET updated_at = NOW() WHERE id = $1', [sessionId]);
    }
    res.json({ message: 'Chat cleared' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to clear chat' });
  }
});

router.post('/message', optionalAuth, rateLimit, async (req, res) => {
  try {
    const question = String(req.body?.message || req.body?.question || '').trim();
    if (!question) return res.status(400).json({ message: 'Please type a question.' });
    if (question.length > 4000) return res.status(400).json({ message: 'Message is too long.' });

    const sessionId = await resolveSession(req.body?.session_id, req.user?.id || null);
    const prior = await loadHistory(sessionId, 16);

    await query(
      `INSERT INTO chatbot_messages (session_id, role, content) VALUES ($1, 'user', $2)`,
      [sessionId, question]
    );

    const reply = await replyToChat({
      question,
      history: prior,
      user: req.user || null,
    });

    const { rows } = await query(
      `INSERT INTO chatbot_messages (session_id, role, content, courses, sources)
       VALUES ($1, 'assistant', $2, $3::jsonb, $4::jsonb)
       RETURNING id, role, content, courses, sources, created_at`,
      [sessionId, reply.content, JSON.stringify(reply.courses || []), JSON.stringify(reply.sources || [])]
    );

    await query('UPDATE chatbot_sessions SET updated_at = NOW() WHERE id = $1', [sessionId]);

    res.json({
      session_id: sessionId,
      message: rows[0],
      warning: reply.warning || null,
    });
  } catch (err) {
    console.error('Chatbot error:', err.message);
    res.status(err.status || 500).json({
      message: err.message || 'Nexus AI could not reply just now.',
    });
  }
});

export default router;
