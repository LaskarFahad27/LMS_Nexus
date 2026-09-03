import { query } from '../config/db.js';

export const createNotification = async ({ userId, type, title, message, link }) => {
  await query(
    `INSERT INTO notifications (user_id, type, title, message, link)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, type || 'system', title, message, link || null]
  );
};

export const slugify = (text) => {
  const slug = String(text || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
  return slug;
};

export const isUsableSlug = (value) => {
  const slug = String(value || '').trim();
  return Boolean(slug) && slug !== '-' && !/^-+$/.test(slug);
};

export const uniqueSlug = async (base, table = 'courses', excludeId = null) => {
  let slug = slugify(base);
  if (!isUsableSlug(slug)) {
    slug = `course-${Date.now().toString(36)}`;
  }
  let counter = 0;
  while (true) {
    const candidate = counter === 0 ? slug : `${slug}-${counter}`;
    const { rows } = excludeId
      ? await query(`SELECT id FROM ${table} WHERE slug = $1 AND id <> $2`, [candidate, excludeId])
      : await query(`SELECT id FROM ${table} WHERE slug = $1`, [candidate]);
    if (!rows[0]) return candidate;
    counter += 1;
  }
};

export const updateCourseRating = async (courseId) => {
  await query(
    `UPDATE courses SET
      average_rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE course_id = $1), 0),
      review_count = (SELECT COUNT(*) FROM reviews WHERE course_id = $1),
      updated_at = NOW()
     WHERE id = $1`,
    [courseId]
  );
};
