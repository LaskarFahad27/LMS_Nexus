import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import './config/loadEnv.js';
import { pool } from './config/db.js';

import authRoutes from './routes/auth.js';
import courseRoutes from './routes/courses.js';
import enrollmentRoutes from './routes/enrollments.js';
import categoryRoutes from './routes/categories.js';
import notificationRoutes from './routes/notifications.js';
import forumRoutes from './routes/forums.js';
import quizRoutes from './routes/quizzes.js';
import instructorRoutes from './routes/instructor.js';
import adminRoutes from './routes/admin.js';
import userRoutes from './routes/users.js';
import chatbotRoutes from './routes/chatbot.js';
import epsRoutes from './routes/eps.js';
import { authenticate } from './middleware/auth.js';
import { ensureChatbotSchema, ensurePaymentSchema, repairEmptyCourseSlugs } from './db/ensure.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
});

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    req.headers['access-control-request-headers'] ||
      'Content-Type, Authorization, X-Requested-With, Accept, Origin'
  );
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'LMS Nexus API', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

function publicBaseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

app.post('/api/upload', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const url = `${publicBaseUrl(req)}/uploads/${req.file.filename}`;
  res.json({
    url,
    filename: req.file.filename,
    mimetype: req.file.mimetype,
    originalname: req.file.originalname,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/forums', forumRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/instructor', instructorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chatbot', chatbotRoutes); // site-wide Nexus AI
app.use('/api', epsRoutes);

const frontendDist = path.join(__dirname, '..', '..', 'Frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Internal server error' });
});

app.listen(PORT, HOST, async () => {
  try {
    await ensurePaymentSchema();
    await ensureChatbotSchema();
    const repaired = await repairEmptyCourseSlugs();
    if (repaired) console.log(`Repaired ${repaired} course slug(s).`);
  } catch (err) {
    console.warn('Startup schema ensure skipped:', err.message);
  }
  console.log(`LMS Nexus API running on http://${HOST}:${PORT}`);
});


