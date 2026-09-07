/**
 * AI service with OpenAI when available, intelligent local fallback otherwise.
 */

const generateLocalQuiz = (title, description, count = 5) => {
  const topics = [
    ...(title || '').split(/\s+/).filter((w) => w.length > 3),
    ...(description || '')
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 4)
      .slice(0, 12),
  ];

  const unique = [...new Set(topics.map((t) => t.toLowerCase()))].slice(0, 8);
  const subject = title || 'this course';

  const templates = [
    {
      question: `What is a core concept covered in "${subject}"?`,
      options: [
        unique[0] ? `Understanding ${unique[0]}` : 'Foundational principles',
        'Irrelevant trivia',
        'Unrelated marketing',
        'Random speculation',
      ],
      correct_answer: 0,
      explanation: `The course focuses on practical mastery of ${subject}.`,
    },
    {
      question: `Which approach best supports learning ${subject}?`,
      options: [
        'Skipping practice entirely',
        'Hands-on application with feedback',
        'Memorizing only definitions',
        'Avoiding real-world examples',
      ],
      correct_answer: 1,
      explanation: 'Active practice with feedback produces durable learning outcomes.',
    },
    {
      question: `Why is structured curriculum important in ${subject}?`,
      options: [
        'It slows learners down unnecessarily',
        'It has no measurable benefit',
        'It builds skills progressively from basics to advanced topics',
        'It replaces the need for practice',
      ],
      correct_answer: 2,
      explanation: 'Progressive sequencing reduces cognitive overload and improves retention.',
    },
    {
      question: unique[1]
        ? `How does "${unique[1]}" relate to ${subject}?`
        : `What should learners prioritize when studying ${subject}?`,
      options: [
        'Ignoring fundamentals',
        'Copying answers without understanding',
        'Avoiding assessments',
        'Connecting theory with practical exercises',
      ],
      correct_answer: 3,
      explanation: 'Connecting concepts to practice deepens comprehension.',
    },
    {
      question: `Which outcome indicates successful completion of ${subject}?`,
      options: [
        'Ability to apply concepts independently',
        'Never attempting quizzes',
        'Skipping all modules',
        'Avoiding peer discussion',
      ],
      correct_answer: 0,
      explanation: 'Independent application is the strongest signal of mastery.',
    },
    {
      question: `What is a recommended study habit for ${subject}?`,
      options: [
        'Cramming once without review',
        'Spaced practice and periodic self-testing',
        'Never revisiting difficult topics',
        'Only watching videos passively',
      ],
      correct_answer: 1,
      explanation: 'Spaced repetition and retrieval practice improve long-term memory.',
    },
    {
      question: unique[2]
        ? `In the context of ${subject}, what role does "${unique[2]}" typically play?`
        : `What improves learner engagement in ${subject}?`,
      options: [
        'Removing all challenges',
        'Hiding progress metrics',
        'Clear goals, feedback, and interactive assessments',
        'Disabling discussion forums',
      ],
      correct_answer: 2,
      explanation: 'Goals, feedback loops, and interaction sustain motivation.',
    },
    {
      question: `Which statement about assessing progress in ${subject} is most accurate?`,
      options: [
        'Quizzes provide no useful signal',
        'Only certificates matter',
        'Completion percentage alone is enough',
        'Quizzes plus project practice give a fuller picture of mastery',
      ],
      correct_answer: 3,
      explanation: 'Multiple assessment modes give richer insight into competence.',
    },
  ];

  return templates.slice(0, Math.min(count, templates.length)).map((q, i) => ({
    ...q,
    sequence_order: i + 1,
  }));
};

export const generateQuizQuestions = async ({ title, description, count = 5 }) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return generateLocalQuiz(title, description, count);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content:
              'You generate multiple-choice quiz questions for online courses. Return ONLY valid JSON array. Each item: {question, options: string[4], correct_answer: 0-3, explanation}.',
          },
          {
            role: 'user',
            content: `Create ${count} MCQ questions for course "${title}". Context: ${description || 'General course concepts'}`,
          },
        ],
      }),
    });

    if (!response.ok) throw new Error('OpenAI request failed');
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '[]';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed.slice(0, count).map((q, i) => ({
      question: q.question,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation || '',
      sequence_order: i + 1,
    }));
  } catch (err) {
    console.warn('AI quiz fallback:', err.message);
    return generateLocalQuiz(title, description, count);
  }
};

export const chatAboutCourse = async ({ question, courseTitle, courseDescription, modules }) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const moduleList = (modules || []).map((m) => m.title).join(', ');

  if (!apiKey) {
    return (
      `Great question about "${courseTitle}"!\n\n` +
      `Based on this course's focus (${(courseDescription || '').slice(0, 220)}...), ` +
      `here's a helpful clarification:\n\n` +
      `• Break the topic into smaller concepts and review related lessons (${moduleList || 'course modules'}).\n` +
      `• Re-watch practical demos, then try a short practice exercise.\n` +
      `• Use quizzes to check understanding before moving forward.\n\n` +
      `Your question: "${question}"\n` +
      `Tip: Compare examples in the curriculum with a real-world use case — that usually unlocks the concept quickly.\n\n` +
      `(AI tutor is running in local mode. Add OPENAI_API_KEY for richer answers.)`
    );
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.5,
        messages: [
          {
            role: 'system',
            content: `You are an expert tutor for the course "${courseTitle}". Course description: ${courseDescription}. Modules: ${moduleList}. Answer clearly and helpfully.`,
          },
          { role: 'user', content: question },
        ],
      }),
    });
    if (!response.ok) throw new Error('OpenAI chat failed');
    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'I could not generate an answer right now.';
  } catch (err) {
    console.warn('AI chat fallback:', err.message);
    return `I understand you're asking about "${question}" in ${courseTitle}. Review the related modules (${moduleList}) and try the practice quizzes — that path usually clarifies this topic.`;
  }
};

export const recommendCourses = (courses, { interests = [], enrolledIds = [] } = {}) => {
  const interestSet = new Set(interests.map((i) => i.toLowerCase()));
  return [...courses]
    .filter((c) => !enrolledIds.includes(c.id))
    .map((c) => {
      let score = Number(c.average_rating || 0) * 2 + Number(c.enrollment_count || 0) * 0.01;
      if (c.is_featured) score += 3;
      if (c.is_trending) score += 2;
      const hay = `${c.title} ${c.description || ''} ${(c.tags || []).join(' ')} ${c.category_name || ''}`.toLowerCase();
      for (const interest of interestSet) {
        if (hay.includes(interest)) score += 4;
      }
      return { ...c, ai_score: score };
    })
    .sort((a, b) => b.ai_score - a.ai_score)
    .slice(0, 8);
};
