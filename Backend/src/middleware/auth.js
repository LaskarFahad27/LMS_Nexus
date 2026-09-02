import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

export const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await query(
      'SELECT id, name, email, role, avatar_url, bio, headline, is_banned, is_verified FROM users WHERE id = $1',
      [decoded.id]
    );

    if (!rows[0]) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (rows[0].is_banned) {
      return res.status(403).json({ message: 'Account suspended' });
    }

    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const token = header.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { rows } = await query(
        'SELECT id, name, email, role, avatar_url FROM users WHERE id = $1 AND is_banned = FALSE',
        [decoded.id]
      );
      req.user = rows[0] || null;
    }
  } catch {
    req.user = null;
  }
  next();
};

export const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }
  next();
};

export const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
