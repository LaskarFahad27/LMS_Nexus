import bcrypt from 'bcryptjs';
import { pool, query } from '../config/db.js';
import { ensureChatbotSchema } from './ensure.js';

const categories = [
  { name: 'Web Development', slug: 'web-development', description: 'Frontend, backend, and full-stack mastery', icon: 'code' },
  { name: 'Data Science', slug: 'data-science', description: 'Analytics, ML, and data engineering', icon: 'chart' },
  { name: 'UI/UX Design', slug: 'ui-ux-design', description: 'Product design and user experience', icon: 'palette' },
  { name: 'Business', slug: 'business', description: 'Entrepreneurship and strategy', icon: 'briefcase' },
  { name: 'Artificial Intelligence', slug: 'artificial-intelligence', description: 'AI, LLMs, and intelligent systems', icon: 'sparkles' },
  { name: 'Mobile Development', slug: 'mobile-development', description: 'iOS, Android, and cross-platform apps', icon: 'phone' },
];

