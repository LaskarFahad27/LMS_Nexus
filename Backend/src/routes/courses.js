import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { createNotification, isUsableSlug, uniqueSlug, updateCourseRating } from '../utils/helpers.js';
import { generateQuizQuestions, recommendCourses, chatAboutCourse } from '../services/ai.js';

const router = Router();

const courseSelect = `
  SELECT c.*,
    cat.name AS category_name, cat.slug AS category_slug,
    u.name AS instructor_name, u.avatar_url AS instructor_avatar,
    u.headline AS instructor_headline, u.bio AS instructor_bio
  FROM courses c
  LEFT JOIN categories cat ON cat.id = c.category_id
  JOIN users u ON u.id = c.instructor_id
`;

router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      search,
      category,
      minPrice,
      maxPrice,
      level,
      sort = 'newest',
      featured,
      trending,
      page = 1,
      limit = 12,
      instructor,
    } = req.query;

    const clauses = ["c.status = 'approved'"];
    const params = [];
    let i = 1;

    if (search) {
      clauses.push(`(c.title ILIKE $${i} OR c.description ILIKE $${i} OR $${i} = ANY(c.tags))`);
      params.push(`%${search}%`);
      i += 1;
    }
    if (category) {
      clauses.push(`(cat.slug = $${i} OR cat.id::text = $${i})`);
      params.push(category);
      i += 1;
    }
    if (minPrice !== undefined) {
      clauses.push(`c.price >= $${i}`);
      params.push(minPrice);
      i += 1;
    }
    if (maxPrice !== undefined) {
      clauses.push(`c.price <= $${i}`);
      params.push(maxPrice);
      i += 1;
    }
    if (level) {
      clauses.push(`c.level = $${i}`);
      params.push(level);
      i += 1;
    }
    if (featured === 'true') clauses.push('c.is_featured = TRUE');
    if (trending === 'true') clauses.push('c.is_trending = TRUE');
    if (instructor) {
      clauses.push(`c.instructor_id::text = $${i}`);
      params.push(instructor);
      i += 1;
    }

    const orderMap = {
      newest: 'c.published_at DESC NULLS LAST, c.created_at DESC',
      price_asc: 'c.price ASC',
      price_desc: 'c.price DESC',
      rating: 'c.average_rating DESC',
      popular: 'c.enrollment_count DESC',
    };
    const orderBy = orderMap[sort] || orderMap.newest;
    const offset = (Number(page) - 1) * Number(limit);

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const countRes = await query(
      `SELECT COUNT(*) FROM courses c LEFT JOIN categories cat ON cat.id = c.category_id ${where}`,
      params
    );

    params.push(limit, offset);
    const { rows } = await query(
      `${courseSelect} ${where} ORDER BY ${orderBy} LIMIT $${i} OFFSET $${i + 1}`,
      params
    );

    res.json({
      courses: rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(countRes.rows[0].count),
        pages: Math.ceil(Number(countRes.rows[0].count) / Number(limit)),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch courses' });
  }
});

router.get('/featured/list', async (_req, res) => {
  try {
    const { rows } = await query(
      `${courseSelect} WHERE c.status = 'approved' AND c.is_featured = TRUE
       ORDER BY c.average_rating DESC LIMIT 8`
    );
    res.json({ courses: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch featured courses' });
  }
});

router.get('/trending/list', async (_req, res) => {
  try {
    const { rows } = await query(
      `${courseSelect} WHERE c.status = 'approved' AND (c.is_trending = TRUE OR c.enrollment_count > 0)
       ORDER BY c.enrollment_count DESC, c.average_rating DESC LIMIT 8`
    );
    res.json({ courses: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch trending courses' });
  }
});

router.get('/recommendations', authenticate, async (req, res) => {
  try {
    const { rows: enrolled } = await query(
      'SELECT course_id FROM enrollments WHERE student_id = $1',
      [req.user.id]
    );
    const enrolledIds = enrolled.map((e) => e.course_id);

    const { rows: courses } = await query(
      `${courseSelect} WHERE c.status = 'approved'`
    );

    const interests = [
      ...(req.user.headline || '').split(/\s+/),
      ...(req.body?.interests || []),
    ].filter(Boolean);

    const recommended = recommendCourses(courses, { interests, enrolledIds });
    res.json({ courses: recommended });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to get recommendations' });
  }
});

router.get('/slug/:slug', optionalAuth, async (req, res) => {
  try {
    const raw = decodeURIComponent(req.params.slug || '').trim();
    let { rows } = await query(`${courseSelect} WHERE c.slug = $1`, [raw]);
    if (!rows[0] && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
      ({ rows } = await query(`${courseSelect} WHERE c.id = $1`, [raw]));
    }
    if (!rows[0]) return res.status(404).json({ message: 'Course not found' });

    const course = rows[0];
    if (course.status !== 'approved') {
      const isOwner = req.user?.id === course.instructor_id;
      const isAdmin = req.user?.role === 'admin';
      if (!isOwner && !isAdmin) return res.status(404).json({ message: 'Course not found' });
    }

    const modules = await query(
      `SELECT m.*,
        COALESCE(json_agg(
          json_build_object(
            'id', l.id, 'title', l.title, 'content_type', l.content_type,
            'video_url', CASE WHEN l.is_preview OR $2 THEN l.video_url ELSE NULL END,
            'document_url', CASE WHEN l.is_preview OR $2 THEN l.document_url ELSE NULL END,
            'duration', l.duration, 'is_preview', l.is_preview, 'sequence_order', l.sequence_order
          ) ORDER BY l.sequence_order
        ) FILTER (WHERE l.id IS NOT NULL), '[]') AS lessons
       FROM modules m
       LEFT JOIN lessons l ON l.module_id = m.id
       WHERE m.course_id = $1
       GROUP BY m.id
       ORDER BY m.sequence_order`,
      [course.id, false]
    );

    const reviews = await query(
      `SELECT r.*, u.name AS student_name, u.avatar_url AS student_avatar
       FROM reviews r JOIN users u ON u.id = r.student_id
       WHERE r.course_id = $1 ORDER BY r.created_at DESC LIMIT 20`,
      [course.id]
    );

    let enrolled = false;
    let enrollment = null;
    if (req.user) {
      const en = await query(
        'SELECT * FROM enrollments WHERE student_id = $1 AND course_id = $2',
        [req.user.id, course.id]
      );
      enrollment = en.rows[0] || null;
      enrolled = !!enrollment;
    }

    // If enrolled, return full lesson URLs
    let modulesData = modules.rows;
    if (enrolled || req.user?.id === course.instructor_id || req.user?.role === 'admin') {
      const full = await query(
        `SELECT m.*,
          COALESCE(json_agg(
            json_build_object(
              'id', l.id, 'title', l.title, 'content_type', l.content_type,
              'video_url', l.video_url, 'document_url', l.document_url, 'content', l.content,
              'duration', l.duration, 'is_preview', l.is_preview, 'sequence_order', l.sequence_order
            ) ORDER BY l.sequence_order
          ) FILTER (WHERE l.id IS NOT NULL), '[]') AS lessons
         FROM modules m
         LEFT JOIN lessons l ON l.module_id = m.id
         WHERE m.course_id = $1
         GROUP BY m.id
         ORDER BY m.sequence_order`,
        [course.id]
      );
      modulesData = full.rows;
    }

    const quizzes = await query(
      'SELECT id, title, description, pass_score, created_by_ai FROM quizzes WHERE course_id = $1',
      [course.id]
    );

    res.json({
      course,
      modules: modulesData,
      reviews: reviews.rows,
      quizzes: quizzes.rows,
      enrolled,
      enrollment,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch course' });
  }
});

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { rows } = await query(`${courseSelect} WHERE c.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Course not found' });
    res.json({ course: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch course' });
  }
});

router.post('/', authenticate, authorize('instructor', 'admin'), async (req, res) => {
  try {
    const {
      title,
      description,
      short_description,
      price = 0,
      category_id,
      thumbnail_url,
      preview_video_url,
      level = 'Beginner',
      language = 'English',
      requirements = [],
      learning_outcomes = [],
      tags = [],
      discount_percent = 0,
      status = 'draft',
    } = req.body;

    if (!title) return res.status(400).json({ message: 'Title is required' });

    const slug = await uniqueSlug(title);
    const discount_price =
      discount_percent > 0 ? Number(price) * (1 - Number(discount_percent) / 100) : null;

    const { rows } = await query(
      `INSERT INTO courses (
        instructor_id, category_id, title, slug, description, short_description,
        price, discount_price, discount_percent, status, thumbnail_url, preview_video_url,
        level, language, requirements, learning_outcomes, tags
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *`,
      [
        req.user.id,
        category_id || null,
        title,
        slug,
        description || '',
        short_description || '',
        price,
        discount_price,
        discount_percent,
        status === 'pending' ? 'pending' : 'draft',
        thumbnail_url || null,
        preview_video_url || null,
        level,
        language,
        requirements,
        learning_outcomes,
        tags,
      ]
    );

    res.status(201).json({ course: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create course' });
  }
});

router.put('/:id', authenticate, authorize('instructor', 'admin'), async (req, res) => {
  try {
    const { rows: existing } = await query('SELECT * FROM courses WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ message: 'Course not found' });
    if (req.user.role !== 'admin' && existing[0].instructor_id !== req.user.id) {
      return res.status(403).json({ message: 'Not your course' });
    }

    const fields = [
      'title', 'description', 'short_description', 'price', 'category_id',
      'thumbnail_url', 'preview_video_url', 'level', 'language',
      'requirements', 'learning_outcomes', 'tags', 'discount_percent',
    ];
    const updates = [];
    const params = [];
    let i = 1;

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = $${i}`);
        params.push(req.body[f]);
        i += 1;
      }
    }

    if (req.body.title && !isUsableSlug(existing[0].slug)) {
      updates.push(`slug = $${i}`);
      params.push(await uniqueSlug(req.body.title, 'courses', existing[0].id));
      i += 1;
    }

    if (req.body.discount_percent !== undefined || req.body.price !== undefined) {
      const price = req.body.price ?? existing[0].price;
      const dp = req.body.discount_percent ?? existing[0].discount_percent;
      updates.push(`discount_price = $${i}`);
      params.push(dp > 0 ? Number(price) * (1 - Number(dp) / 100) : null);
      i += 1;
    }

    updates.push('updated_at = NOW()');
    params.push(req.params.id);

    const { rows } = await query(
      `UPDATE courses SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      params
    );
    res.json({ course: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update course' });
  }
});

router.post('/:id/submit', authenticate, authorize('instructor', 'admin'), async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE courses SET status = 'pending', updated_at = NOW()
       WHERE id = $1 AND (instructor_id = $2 OR $3 = 'admin')
       RETURNING *`,
      [req.params.id, req.user.id, req.user.role]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Course not found' });

    const admins = await query(`SELECT id FROM users WHERE role = 'admin'`);
    for (const admin of admins.rows) {
      await createNotification({
        userId: admin.id,
        type: 'approval',
        title: 'Course pending review',
        message: `"${rows[0].title}" awaits approval.`,
        link: '/admin/courses',
      });
    }

    res.json({ course: rows[0], message: 'Course submitted for review' });
  } catch (err) {
    res.status(500).json({ message: 'Submit failed' });
  }
});

router.post('/:id/modules', authenticate, authorize('instructor', 'admin'), async (req, res) => {
  try {
    const { rows: course } = await query('SELECT * FROM courses WHERE id = $1', [req.params.id]);
    if (!course[0]) return res.status(404).json({ message: 'Course not found' });
    if (req.user.role !== 'admin' && course[0].instructor_id !== req.user.id) {
      return res.status(403).json({ message: 'Not your course' });
    }

    const { title, description, sequence_order } = req.body;
    const order =
      sequence_order ||
      (
        await query('SELECT COALESCE(MAX(sequence_order),0)+1 AS n FROM modules WHERE course_id = $1', [
          req.params.id,
        ])
      ).rows[0].n;

    const { rows } = await query(
      `INSERT INTO modules (course_id, title, description, sequence_order)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, title, description || '', order]
    );
    res.status(201).json({ module: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add module' });
  }
});

router.post('/modules/:moduleId/lessons', authenticate, authorize('instructor', 'admin'), async (req, res) => {
  try {
    const { rows: mod } = await query(
      `SELECT m.*, c.instructor_id FROM modules m JOIN courses c ON c.id = m.course_id WHERE m.id = $1`,
      [req.params.moduleId]
    );
    if (!mod[0]) return res.status(404).json({ message: 'Module not found' });
    if (req.user.role !== 'admin' && mod[0].instructor_id !== req.user.id) {
      return res.status(403).json({ message: 'Not your course' });
    }

    const {
      title,
      content_type = 'video',
      video_url,
      document_url,
      content,
      duration = 0,
      is_preview = false,
      sequence_order,
    } = req.body;

    const order =
      sequence_order ||
      (
        await query(
          'SELECT COALESCE(MAX(sequence_order),0)+1 AS n FROM lessons WHERE module_id = $1',
          [req.params.moduleId]
        )
      ).rows[0].n;

    const { rows } = await query(
      `INSERT INTO lessons (module_id, title, content_type, video_url, document_url, content, duration, is_preview, sequence_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.params.moduleId, title, content_type, video_url || null, document_url || null, content || null, duration, is_preview, order]
    );

    await query(
      `UPDATE courses SET total_duration = (
         SELECT COALESCE(SUM(l.duration),0) FROM lessons l
         JOIN modules m ON m.id = l.module_id WHERE m.course_id = $1
       ), updated_at = NOW() WHERE id = $1`,
      [mod[0].course_id]
    );

    res.status(201).json({ lesson: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to add lesson' });
  }
});

router.post('/:id/ai-quiz', authenticate, authorize('instructor', 'admin'), async (req, res) => {
  try {
    const { rows: course } = await query('SELECT * FROM courses WHERE id = $1', [req.params.id]);
    if (!course[0]) return res.status(404).json({ message: 'Course not found' });
    if (req.user.role !== 'admin' && course[0].instructor_id !== req.user.id) {
      return res.status(403).json({ message: 'Not your course' });
    }

    const count = Number(req.body.count) || 5;
    const questions = await generateQuizQuestions({
      title: course[0].title,
      description: course[0].description,
      count,
    });

    const { rows: quiz } = await query(
      `INSERT INTO quizzes (course_id, title, description, created_by_ai)
       VALUES ($1,$2,$3,TRUE) RETURNING *`,
      [course[0].id, `AI Quiz: ${course[0].title}`, 'Auto-generated from course content']
    );

    for (const q of questions) {
      await query(
        `INSERT INTO quiz_questions (quiz_id, question, options, correct_answer, explanation, sequence_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [quiz[0].id, q.question, JSON.stringify(q.options), q.correct_answer, q.explanation, q.sequence_order]
      );
    }

    const { rows: saved } = await query(
      'SELECT * FROM quiz_questions WHERE quiz_id = $1 ORDER BY sequence_order',
      [quiz[0].id]
    );

    res.status(201).json({ quiz: quiz[0], questions: saved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'AI quiz generation failed' });
  }
});

router.post('/:id/chat', authenticate, async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ message: 'Question required' });

    const { rows: course } = await query('SELECT * FROM courses WHERE id = $1', [req.params.id]);
    if (!course[0]) return res.status(404).json({ message: 'Course not found' });

    const { rows: modules } = await query(
      'SELECT title FROM modules WHERE course_id = $1 ORDER BY sequence_order',
      [req.params.id]
    );

    const answer = await chatAboutCourse({
      question,
      courseTitle: course[0].title,
      courseDescription: course[0].description,
      modules,
    });

    await query(
      `INSERT INTO ai_chat_logs (user_id, course_id, question, answer) VALUES ($1,$2,$3,$4)`,
      [req.user.id, course[0].id, question, answer]
    );

    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'AI chat failed' });
  }
});

router.post('/:id/reviews', authenticate, authorize('student', 'admin'), async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be 1-5' });
    }

    const enrolled = await query(
      'SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2',
      [req.user.id, req.params.id]
    );
    if (!enrolled.rows[0] && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Enroll before reviewing' });
    }

    const { rows } = await query(
      `INSERT INTO reviews (course_id, student_id, rating, comment)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (course_id, student_id)
       DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = NOW()
       RETURNING *`,
      [req.params.id, req.user.id, rating, comment || '']
    );

    await updateCourseRating(req.params.id);

    const { rows: course } = await query('SELECT instructor_id, title FROM courses WHERE id = $1', [
      req.params.id,
    ]);
    if (course[0]) {
      await createNotification({
        userId: course[0].instructor_id,
        type: 'review',
        title: 'New course review',
        message: `${req.user.name} rated "${course[0].title}" ${rating}/5`,
        link: `/courses/${req.params.id}`,
      });
    }

    res.status(201).json({ review: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to submit review' });
  }
});

router.post('/reviews/:reviewId/reply', authenticate, authorize('instructor', 'admin'), async (req, res) => {
  try {
    const { reply } = req.body;
    const { rows: review } = await query(
      `SELECT r.*, c.instructor_id FROM reviews r JOIN courses c ON c.id = r.course_id WHERE r.id = $1`,
      [req.params.reviewId]
    );
    if (!review[0]) return res.status(404).json({ message: 'Review not found' });
    if (req.user.role !== 'admin' && review[0].instructor_id !== req.user.id) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    const { rows } = await query(
      `UPDATE reviews SET instructor_reply = $1, replied_at = NOW() WHERE id = $2 RETURNING *`,
      [reply, req.params.reviewId]
    );
    res.json({ review: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Reply failed' });
  }
});

export default router;
