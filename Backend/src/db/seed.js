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

async function seed() {
  console.log('Seeding LMS Nexus...');
  await ensureChatbotSchema();

  await query('DELETE FROM chatbot_messages');
  await query('DELETE FROM chatbot_sessions');
  await query('DELETE FROM ai_chat_logs');
  await query('DELETE FROM forum_replies');
  await query('DELETE FROM forum_threads');
  await query('DELETE FROM certificates');
  await query('DELETE FROM quiz_attempts');
  await query('DELETE FROM quiz_questions');
  await query('DELETE FROM quizzes');
  await query('DELETE FROM wishlists');
  await query('DELETE FROM notifications');
  await query('DELETE FROM contact_messages');
  await query('DELETE FROM announcements');
  await query('DELETE FROM reviews');
  await query('DELETE FROM payments');
  await query('DELETE FROM enrollments');
  await query('DELETE FROM lessons');
  await query('DELETE FROM modules');
  await query('DELETE FROM courses');
  await query('DELETE FROM categories');
  await query('DELETE FROM platform_settings');
  await query('DELETE FROM users');

  const password_hash = await bcrypt.hash('Root@1234', 12);

  const { rows: adminRows } = await query(
    `INSERT INTO users (name, email, password_hash, role, bio, headline, is_verified)
     VALUES ($1,$2,$3,'admin',$4,$5,TRUE) RETURNING *`,
    ['Platform Admin', 'admin@lmsnexus.com', password_hash, 'Oversees marketplace quality and operations.', 'LMS Nexus Administrator']
  );

  const instructors = [];
  const instructorData = [
    ['Aria Chen', 'aria@lmsnexus.com', 'Senior full-stack engineer & educator', 'I help builders ship production-grade React systems.'],
    ['Marcus Webb', 'marcus@lmsnexus.com', 'AI researcher & ML engineer', 'Practical AI systems for real products.'],
    ['Sofia Rahman', 'sofia@lmsnexus.com', 'Product designer at scale', 'Design systems that feel inevitable.'],
  ];

  for (const [name, email, headline, bio] of instructorData) {
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role, bio, headline, expertise, is_verified)
       VALUES ($1,$2,$3,'instructor',$4,$5,$6,TRUE) RETURNING *`,
      [name, email, password_hash, bio, headline, ['Teaching', 'Mentorship']]
    );
    instructors.push(rows[0]);
  }

  const { rows: studentRows } = await query(
    `INSERT INTO users (name, email, password_hash, role, bio, headline)
     VALUES ($1,$2,$3,'student',$4,$5) RETURNING *`,
    ['Alex Rivera', 'student@lmsnexus.com', password_hash, 'Curious learner exploring modern tech.', 'Aspiring product engineer']
  );

  const catIds = {};
  for (const c of categories) {
    const { rows } = await query(
      `INSERT INTO categories (name, slug, description, icon) VALUES ($1,$2,$3,$4) RETURNING *`,
      [c.name, c.slug, c.description, c.icon]
    );
    catIds[c.slug] = rows[0].id;
  }

  const courseDefs = [
    {
      instructor: 0,
      category: 'web-development',
      title: 'Modern React Mastery: Design Systems to Production',
      short: 'Build premium React apps with advanced patterns, performance, and polished UX.',
      description:
        'A complete path from component architecture to shipping production React applications. Learn hooks deeply, state orchestration, design tokens, accessibility, and deployment workflows used by top product teams.',
      price: 89.99,
      discount_percent: 15,
      level: 'Intermediate',
      featured: true,
      trending: true,
      tags: ['react', 'javascript', 'frontend'],
      outcomes: ['Ship production React apps', 'Design scalable component systems', 'Optimize rendering performance'],
      requirements: ['Basic JavaScript', 'HTML & CSS fundamentals'],
      modules: [
        {
          title: 'Foundations & Architecture',
          lessons: [
            { title: 'Course orientation', duration: 8, is_preview: true, video_url: 'https://www.youtube.com/embed/dGcsHMXbSOA' },
            { title: 'Component mental models', duration: 18, video_url: 'https://www.youtube.com/embed/bMknfKXIFA8' },
          ],
        },
        {
          title: 'Advanced Patterns',
          lessons: [
            { title: 'Composition over configuration', duration: 22, video_url: 'https://www.youtube.com/embed/dpw9EHDh2bM' },
            { title: 'Server and client boundaries', duration: 20, document_url: '/uploads/sample-notes.pdf', content_type: 'document' },
          ],
        },
      ],
    },
    {
      instructor: 1,
      category: 'artificial-intelligence',
      title: 'Applied AI for Product Builders',
      short: 'Ship intelligent features with LLMs, embeddings, and responsible AI practices.',
      description:
        'Learn how to integrate AI into real products: prompt systems, retrieval pipelines, evaluation, cost control, and UX patterns that make AI feel magical rather than unreliable.',
      price: 129.0,
      discount_percent: 10,
      level: 'Advanced',
      featured: true,
      trending: true,
      tags: ['ai', 'llm', 'openai'],
      outcomes: ['Build RAG pipelines', 'Evaluate model quality', 'Design AI-native UX'],
      requirements: ['Python or JavaScript basics', 'API familiarity'],
      modules: [
        {
          title: 'AI Product Thinking',
          lessons: [
            { title: 'Where AI creates leverage', duration: 14, is_preview: true, video_url: 'https://www.youtube.com/embed/aircAruvnKk' },
            { title: 'Prompt systems that scale', duration: 24, video_url: 'https://www.youtube.com/embed/zjkBMFhNj_g' },
          ],
        },
      ],
    },
    {
      instructor: 2,
      category: 'ui-ux-design',
      title: 'Premium Interface Design Studio',
      short: 'Craft ultra-premium digital experiences with typography, motion, and hierarchy.',
      description:
        'A studio-style course on designing interfaces that feel expensive: expressive type, intentional motion, spatial rhythm, and critique frameworks used by elite product teams.',
      price: 79.0,
      level: 'Beginner',
      featured: true,
      trending: false,
      tags: ['design', 'figma', 'ux'],
      outcomes: ['Design premium landing pages', 'Build motion principles', 'Run design critiques'],
      requirements: ['Curiosity and a Figma account'],
      modules: [
        {
          title: 'Visual Direction',
          lessons: [
            { title: 'Brand as first viewport signal', duration: 16, is_preview: true, video_url: 'https://www.youtube.com/embed/c9Wg6CbTfgw' },
            { title: 'Typography systems', duration: 21, video_url: 'https://www.youtube.com/embed/sByzjkvpNw0' },
          ],
        },
      ],
    },
    {
      instructor: 0,
      category: 'web-development',
      title: 'Node & Express API Engineering',
      short: 'Design secure, scalable REST APIs with authentication and clean architecture.',
      description:
        'From Express fundamentals to JWT auth, validation, PostgreSQL modeling, and production hardening for multivendor platforms.',
      price: 69.99,
      level: 'Intermediate',
      featured: false,
      trending: true,
      tags: ['node', 'express', 'api'],
      outcomes: ['Build secure REST APIs', 'Model relational data', 'Ship auth correctly'],
      requirements: ['JavaScript fundamentals'],
      modules: [
        {
          title: 'API Foundations',
          lessons: [
            { title: 'Routing & middleware', duration: 15, is_preview: true, video_url: 'https://www.youtube.com/embed/Oe421EPjeBE' },
          ],
        },
      ],
    },
    {
      instructor: 1,
      category: 'data-science',
      title: 'Practical Data Science with Python',
      short: 'Analyze datasets, visualize insight, and communicate findings that drive decisions.',
      description:
        'A pragmatic introduction to data science workflows: cleaning, exploration, modeling, and storytelling with real datasets.',
      price: 99.0,
      discount_percent: 20,
      level: 'Beginner',
      featured: false,
      trending: true,
      tags: ['python', 'data', 'pandas'],
      outcomes: ['Clean and explore data', 'Build baseline models', 'Present insights clearly'],
      requirements: ['Basic Python'],
      modules: [
        {
          title: 'Data Wrangling',
          lessons: [
            { title: 'Pandas essentials', duration: 19, is_preview: true, video_url: 'https://www.youtube.com/embed/vmEHCJofslg' },
          ],
        },
      ],
    },
    {
      instructor: 2,
      category: 'business',
      title: 'Creator Economy Business Systems',
      short: 'Turn expertise into a scalable education business with pricing and retention systems.',
      description:
        'Learn how top instructors package knowledge, price courses, build funnels, and retain students with community and certificates.',
      price: 59.0,
      level: 'Beginner',
      featured: true,
      trending: false,
      tags: ['business', 'creators', 'monetization'],
      outcomes: ['Price courses strategically', 'Build student retention loops', 'Launch a course offer'],
      requirements: ['An idea you want to teach'],
      modules: [
        {
          title: 'Offer Design',
          lessons: [
            { title: 'Positioning for premium buyers', duration: 17, is_preview: true, video_url: 'https://www.youtube.com/embed/2ephuZUqUoE' },
          ],
        },
      ],
    },
  ];

  for (const def of courseDefs) {
    const instructor = instructors[def.instructor];
    const slug = def.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 200);
    const discount_price =
      def.discount_percent > 0 ? Number((def.price * (1 - def.discount_percent / 100)).toFixed(2)) : null;

    const { rows: courseRows } = await query(
      `INSERT INTO courses (
        instructor_id, category_id, title, slug, description, short_description,
        price, discount_price, discount_percent, status, thumbnail_url, level,
        requirements, learning_outcomes, tags, is_featured, is_trending,
        published_at, enrollment_count, average_rating, review_count
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'approved',$10,$11,$12,$13,$14,$15,$16,NOW(),$17,$18,$19)
      RETURNING *`,
      [
        instructor.id,
        catIds[def.category],
        def.title,
        slug,
        def.description,
        def.short,
        def.price,
        discount_price,
        def.discount_percent || 0,
        `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80&auto=format&fit=crop`,
        def.level,
        def.requirements,
        def.outcomes,
        def.tags,
        def.featured,
        def.trending,
        Math.floor(Math.random() * 40) + 5,
        (4 + Math.random()).toFixed(2),
        Math.floor(Math.random() * 30) + 3,
      ]
    );
    const course = courseRows[0];

    for (let mi = 0; mi < def.modules.length; mi++) {
      const mod = def.modules[mi];
      const { rows: modRows } = await query(
        `INSERT INTO modules (course_id, title, description, sequence_order) VALUES ($1,$2,$3,$4) RETURNING *`,
        [course.id, mod.title, '', mi + 1]
      );
      for (let li = 0; li < mod.lessons.length; li++) {
        const lesson = mod.lessons[li];
        await query(
          `INSERT INTO lessons (module_id, title, content_type, video_url, document_url, duration, is_preview, sequence_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            modRows[0].id,
            lesson.title,
            lesson.content_type || 'video',
            lesson.video_url || null,
            lesson.document_url || null,
            lesson.duration || 10,
            !!lesson.is_preview,
            li + 1,
          ]
        );
      }
    }

    // AI quiz
    const { rows: quizRows } = await query(
      `INSERT INTO quizzes (course_id, title, description, created_by_ai)
       VALUES ($1,$2,$3,TRUE) RETURNING *`,
      [course.id, `Knowledge Check: ${def.title}`, 'AI-assisted quiz']
    );
    const sampleQ = [
      {
        q: `What is the primary focus of "${def.title}"?`,
        options: ['Practical mastery of the subject', 'Random trivia', 'Unrelated history', 'Marketing only'],
        a: 0,
      },
      {
        q: 'Which learning approach works best?',
        options: ['Passive watching only', 'Practice with feedback', 'Skipping assessments', 'Avoiding projects'],
        a: 1,
      },
      {
        q: 'What signals course completion readiness?',
        options: ['Ignoring quizzes', 'Never opening modules', 'Applying concepts independently', 'Avoiding discussion'],
        a: 2,
      },
    ];
    for (let i = 0; i < sampleQ.length; i++) {
      await query(
        `INSERT INTO quiz_questions (quiz_id, question, options, correct_answer, explanation, sequence_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [quizRows[0].id, sampleQ[i].q, JSON.stringify(sampleQ[i].options), sampleQ[i].a, 'Reinforces course mastery.', i + 1]
      );
    }

    // Sample review
    await query(
      `INSERT INTO reviews (course_id, student_id, rating, comment)
       VALUES ($1,$2,$3,$4)`,
      [course.id, studentRows[0].id, 5, 'Exceptionally polished course. Clear structure and premium production quality.']
    );
  }

  // Enroll student in first course with payment
  const { rows: firstCourse } = await query(`SELECT * FROM courses ORDER BY created_at ASC LIMIT 1`);
  if (firstCourse[0]) {
    const amount = Number(firstCourse[0].discount_price ?? firstCourse[0].price);
    const fee = Number((amount * 0.2).toFixed(2));
    const { rows: enr } = await query(
      `INSERT INTO enrollments (student_id, course_id, progress_percentage)
       VALUES ($1,$2,35) RETURNING *`,
      [studentRows[0].id, firstCourse[0].id]
    );
    await query(
      `INSERT INTO payments (enrollment_id, student_id, course_id, instructor_id, amount, platform_fee, instructor_earning, payment_status, transaction_id, card_last4)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'completed',$8,'4242')`,
      [enr[0].id, studentRows[0].id, firstCourse[0].id, firstCourse[0].instructor_id, amount, fee, amount - fee, 'TXN-SEED001']
    );
  }

  await query(
    `INSERT INTO platform_settings (key, value) VALUES
     ('commission_rate', '0.20'),
     ('site_name', '"LMS Nexus"'),
     ('support_email', '"support@lmsnexus.com"'),
     ('chatbot_enabled', 'true'),
     ('craftx_api_key', '""'),
     ('craftx_model', '"Qwen3 VL 30B"')
     ON CONFLICT DO NOTHING`
  );

  await query(
    `INSERT INTO notifications (user_id, type, title, message, link)
     VALUES ($1,'system','Welcome to LMS Nexus','Explore curated courses tailored for ambitious learners.','/courses')`,
    [studentRows[0].id]
  );

  console.log('Seed complete.');
  console.log('Accounts (password: Root@1234):');
  console.log('  Admin:      admin@lmsnexus.com');
  console.log('  Instructor: aria@lmsnexus.com');
  console.log('  Student:    student@lmsnexus.com');
  await pool.end();
}

seed().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
