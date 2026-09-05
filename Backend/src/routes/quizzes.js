import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/:quizId', authenticate, async (req, res) => {
  try {
    const { rows: quizzes } = await query('SELECT * FROM quizzes WHERE id = $1', [req.params.quizId]);
    if (!quizzes[0]) return res.status(404).json({ message: 'Quiz not found' });

    const { rows: questions } = await query(
      `SELECT id, quiz_id, question, options, sequence_order, explanation
       FROM quiz_questions WHERE quiz_id = $1 ORDER BY sequence_order`,
      [req.params.quizId]
    );

    // Hide correct answers for students taking quiz
    const safe = questions.map((q) => ({
      id: q.id,
      quiz_id: q.quiz_id,
      question: q.question,
      options: q.options,
      sequence_order: q.sequence_order,
    }));

    res.json({ quiz: quizzes[0], questions: safe });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch quiz' });
  }
});

router.post('/:quizId/attempt', authenticate, authorize('student'), async (req, res) => {
  try {
    const { answers } = req.body; // [{question_id, selected}]
    if (!Array.isArray(answers)) {
      return res.status(400).json({ message: 'Answers array required' });
    }

    const { rows: quizzes } = await query('SELECT * FROM quizzes WHERE id = $1', [req.params.quizId]);
    if (!quizzes[0]) return res.status(404).json({ message: 'Quiz not found' });

    const { rows: questions } = await query(
      'SELECT * FROM quiz_questions WHERE quiz_id = $1',
      [req.params.quizId]
    );

    let correct = 0;
    const detailed = questions.map((q) => {
      const ans = answers.find((a) => a.question_id === q.id);
      const selected = ans?.selected ?? -1;
      const isCorrect = selected === q.correct_answer;
      if (isCorrect) correct += 1;
      return {
        question_id: q.id,
        selected,
        correct_answer: q.correct_answer,
        is_correct: isCorrect,
        explanation: q.explanation,
      };
    });

    const total = questions.length || 1;
    const score = Math.round((correct / total) * 100);
    const passed = score >= (quizzes[0].pass_score || 70);

    const enrollment = await query(
      'SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2',
      [req.user.id, quizzes[0].course_id]
    );

    const { rows } = await query(
      `INSERT INTO quiz_attempts (quiz_id, student_id, enrollment_id, score, total_questions, answers, passed)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        req.params.quizId,
        req.user.id,
        enrollment.rows[0]?.id || null,
        score,
        total,
        JSON.stringify(detailed),
        passed,
      ]
    );

    res.status(201).json({
      attempt: rows[0],
      results: detailed,
      score,
      passed,
      correct,
      total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Quiz attempt failed' });
  }
});

router.get('/attempts/mine', authenticate, authorize('student'), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT qa.*, q.title AS quiz_title, c.title AS course_title
       FROM quiz_attempts qa
       JOIN quizzes q ON q.id = qa.quiz_id
       JOIN courses c ON c.id = q.course_id
       WHERE qa.student_id = $1
       ORDER BY qa.attempted_at DESC`,
      [req.user.id]
    );
    res.json({ attempts: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch attempts' });
  }
});

router.post('/', authenticate, authorize('instructor', 'admin'), async (req, res) => {
  try {
    const { course_id, title, description, pass_score = 70, questions = [] } = req.body;
    const { rows: course } = await query('SELECT * FROM courses WHERE id = $1', [course_id]);
    if (!course[0]) return res.status(404).json({ message: 'Course not found' });
    if (req.user.role !== 'admin' && course[0].instructor_id !== req.user.id) {
      return res.status(403).json({ message: 'Not your course' });
    }

    const { rows: quiz } = await query(
      `INSERT INTO quizzes (course_id, title, description, pass_score)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [course_id, title, description || '', pass_score]
    );

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await query(
        `INSERT INTO quiz_questions (quiz_id, question, options, correct_answer, explanation, sequence_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [quiz[0].id, q.question, JSON.stringify(q.options), q.correct_answer, q.explanation || '', i + 1]
      );
    }

    res.status(201).json({ quiz: quiz[0] });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create quiz' });
  }
});

export default router;
