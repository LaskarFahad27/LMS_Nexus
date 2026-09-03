import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT cat.*, COUNT(c.id) FILTER (WHERE c.status = 'approved') AS course_count
       FROM categories cat
       LEFT JOIN courses c ON c.category_id = cat.id
       GROUP BY cat.id
       ORDER BY cat.name`
    );
    res.json({ categories: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
});

router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    if (!name) return res.status(400).json({ message: 'Name required' });
    const slug = name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

    const { rows } = await query(
      `INSERT INTO categories (name, slug, description, icon)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
       RETURNING *`,
      [name, slug, description || '', icon || 'book']
    );
    res.status(201).json({ category: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create category' });
  }
});

router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    const { rows } = await query(
      `UPDATE categories SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        icon = COALESCE($3, icon)
       WHERE id = $4 RETURNING *`,
      [name || null, description ?? null, icon ?? null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Category not found' });
    res.json({ category: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update category' });
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete category' });
  }
});

export default router;
