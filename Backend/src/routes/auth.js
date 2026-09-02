import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { query } from '../config/db.js';
import { authenticate, signToken } from '../middleware/auth.js';
import { createNotification } from '../utils/helpers.js';

const router = Router();

router.post(
  '/register',
  [
    body('name').trim().isLength({ min: 2 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('role').optional().isIn(['student', 'instructor']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { name, email, password, role = 'student', bio, headline } = req.body;

    try {
      const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows[0]) {
        return res.status(409).json({ message: 'Email already registered' });
      }

      const password_hash = await bcrypt.hash(password, 12);
      const { rows } = await query(
        `INSERT INTO users (name, email, password_hash, role, bio, headline, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, email, role, avatar_url, bio, headline, created_at`,
        [name, email, password_hash, role, bio || null, headline || null, role === 'instructor']
      );

      const user = rows[0];
      const token = signToken(user);

      await createNotification({
        userId: user.id,
        type: 'system',
        title: 'Welcome to LMS Nexus',
        message: `Your ${role} account is ready. Start exploring premium courses.`,
        link: role === 'instructor' ? '/instructor' : '/student',
      });

      res.status(201).json({ token, user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Registration failed' });
    }
  }
);

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
      const user = rows[0];
      if (!user) return res.status(401).json({ message: 'Invalid email or password' });
      if (user.is_banned) return res.status(403).json({ message: 'Account suspended' });

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ message: 'Invalid email or password' });

      await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

      const token = signToken(user);
      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar_url: user.avatar_url,
          bio: user.bio,
          headline: user.headline,
          is_verified: user.is_verified,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Login failed' });
    }
  }
);

router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

router.put('/profile', authenticate, async (req, res) => {
  const { name, bio, headline, avatar_url, expertise, website, social_links } = req.body;
  try {
    const { rows } = await query(
      `UPDATE users SET
        name = COALESCE($1, name),
        bio = COALESCE($2, bio),
        headline = COALESCE($3, headline),
        avatar_url = COALESCE($4, avatar_url),
        expertise = COALESCE($5, expertise),
        website = COALESCE($6, website),
        social_links = COALESCE($7, social_links),
        updated_at = NOW()
       WHERE id = $8
       RETURNING id, name, email, role, avatar_url, bio, headline, expertise, website, social_links, is_verified`,
      [
        name || null,
        bio ?? null,
        headline ?? null,
        avatar_url ?? null,
        expertise || null,
        website ?? null,
        social_links ? JSON.stringify(social_links) : null,
        req.user.id,
      ]
    );
    res.json({ user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Profile update failed' });
  }
});

router.post('/reset-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters' });
  }

  try {
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword || '', rows[0].password_hash);
    if (!valid) return res.status(400).json({ message: 'Current password is incorrect' });

    const password_hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      password_hash,
      req.user.id,
    ]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Password reset failed' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email required' });

  const { rows } = await query('SELECT id FROM users WHERE email = $1', [email]);
  // Always return success for security (demo: reset token logged)
  if (rows[0]) {
    const temp = await bcrypt.hash('TempReset@123', 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [temp, rows[0].id]);
    await createNotification({
      userId: rows[0].id,
      type: 'system',
      title: 'Password reset',
      message: 'Your temporary password is TempReset@123 — please change it after login.',
    });
  }
  res.json({
    message: 'If that email exists, a temporary password has been issued (demo: TempReset@123).',
  });
});

export default router;
