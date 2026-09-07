/**
 * Site-wide Nexus AI assistant powered by CraftX.
 * Answers platform questions from the live catalog and general questions
 * from the model (plus web search when the query needs current information).
 */

import { query } from '../config/db.js';

const CRAFTX_ENDPOINT = 'https://api.craftx.corecraftsolutions.com/api/v1/chat/completions';
const DEFAULT_MODEL = 'Qwen3 VL 30B';

const SECRET_SETTING_KEYS = new Set(['craftx_api_key']);

export const maskSecret = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return { configured: false, masked: '' };
  const tail = raw.slice(-4);
  return { configured: true, masked: `••••••••${tail}` };
};

export const unwrapSetting = (value) => {
  if (value == null) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    if ('configured' in value) return null;
    return value;
  }
  return value;
};

export async function getSetting(key, fallback = null) {
  const { rows } = await query('SELECT value FROM platform_settings WHERE key = $1', [key]);
  if (!rows[0]) return fallback;
  const value = unwrapSetting(rows[0].value);
  return value == null ? fallback : value;
}

export async function getChatbotConfig() {
  const [enabled, storedKey, model] = await Promise.all([
    getSetting('chatbot_enabled', true),
    getSetting('craftx_api_key', ''),
    getSetting('craftx_model', DEFAULT_MODEL),
  ]);
  const apiKey = String(storedKey || process.env.CRAFTX_API_KEY || '').trim();
  return {
    enabled: enabled !== false && enabled !== 'false' && enabled !== 0,
    apiKey,
    model: String(model || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
  };
}

export function sanitizeSettings(settings) {
  const out = { ...settings };
  for (const key of SECRET_SETTING_KEYS) {
    out[key] = maskSecret(unwrapSetting(settings[key]) || '');
  }
  return out;
}

export function isPlainSecretString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function loadCatalog() {
  const { rows } = await query(
    `SELECT c.id, c.title, c.slug, c.short_description, c.description,
            c.price, c.discount_price, c.level, c.language,
            c.average_rating, c.review_count, c.enrollment_count,
            c.thumbnail_url, c.tags, c.learning_outcomes,
            c.is_featured, c.is_trending,
            cat.name AS category_name, cat.slug AS category_slug,
            u.name AS instructor_name, u.id AS instructor_id
     FROM courses c
     LEFT JOIN categories cat ON cat.id = c.category_id
     JOIN users u ON u.id = c.instructor_id
     WHERE c.status = 'approved'
     ORDER BY c.average_rating DESC NULLS LAST, c.enrollment_count DESC
     LIMIT 80`
  );
  return rows;
}

const stopWords = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'to', 'of', 'in', 'on', 'with', 'is', 'it',
  'my', 'me', 'i', 'you', 'we', 'want', 'need', 'best', 'which', 'what', 'how',
  'can', 'this', 'that', 'from', 'about', 'any', 'are', 'be', 'do', 'please',
  'course', 'courses', 'learn', 'learning', 'good', 'suggest', 'recommend',
  'between', 'compare', 'versus', 'vs', 'two', 'some', 'give', 'tell', 'show',
]);

const tokenize = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s+-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

export function scoreCourse(course, tokens) {
  const hay = [
    course.title,
    course.short_description,
    course.description,
    course.category_name,
    course.instructor_name,
    course.level,
    ...(course.tags || []),
    ...(course.learning_outcomes || []),
  ]
    .join(' ')
    .toLowerCase();

  let strong = 0;
  let weak = 0;
  for (const token of tokens) {
    if (course.title?.toLowerCase().includes(token)) strong += 8;
    else if (course.category_name?.toLowerCase().includes(token)) strong += 8;
    else if ((course.tags || []).some((t) => String(t).toLowerCase().includes(token))) strong += 5;
    else if (hay.includes(token)) weak += 2;
  }
  if (strong === 0) return 0;
  let tokenScore = strong + weak;

  tokenScore += Number(course.average_rating || 0) * 0.8;
  tokenScore += Math.min(Number(course.enrollment_count || 0), 500) * 0.01;
  if (course.is_featured) tokenScore += 1.5;
  if (course.is_trending) tokenScore += 1;
  return tokenScore;
}

export function findRelevantCourses(queryText, catalog, limit = 6) {
  const tokens = tokenize(queryText);
  const popularAsk = /\b(popular|trending|featured|top|best)\b/i.test(queryText || '');
  const q = String(queryText || '').toLowerCase();
  const categoryMatch = catalog.filter(
    (c) => c.category_name && q.includes(String(c.category_name).toLowerCase())
  );
  const pool = categoryMatch.length ? categoryMatch : catalog;

  if (!tokens.length) {
    if (!popularAsk) return [];
    return [...pool]
      .sort((a, b) => Number(b.average_rating || 0) - Number(a.average_rating || 0))
      .slice(0, limit);
  }

  const ranked = pool
    .map((c) => ({ course: c, score: scoreCourse(c, tokens) }))
    .filter((x) => x.score >= 6)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.course);

  if (ranked.length) return ranked;
  if (categoryMatch.length) {
    return [...categoryMatch]
      .sort((a, b) => Number(b.average_rating || 0) - Number(a.average_rating || 0))
      .slice(0, limit);
  }
  return [];
}

const platformHints = [
  'course', 'courses', 'learn', 'learning', 'enroll', 'instructor', 'class',
  'lesson', 'module', 'quiz', 'certificate', 'lms', 'nexus', 'recommend',
  'compare', 'rating', 'price', 'beginner', 'advanced', 'web development',
  'javascript', 'react', 'python', 'design', 'ui', 'ux', 'data', 'ai',
  'node', 'express', 'html', 'css', 'next', 'hooks',
  'android', 'ios', 'mobile', 'business', 'teach', 'student', 'wishlist',
  'checkout', 'payment', 'marketplace',
];

export function looksPlatformRelated(text) {
  const q = String(text || '').toLowerCase();
  return platformHints.some((h) => q.includes(h));
}

const searchHints = [
  'latest', 'today', 'yesterday', 'this week', 'this month', 'this year',
  'news', 'current', 'recent', 'right now', 'as of', 'who won', 'what happened',
  'breaking', 'release date', 'stock', 'weather', 'score', 'election',
  'version of', 'update on',
];

export function needsWebSearch(text) {
  const q = String(text || '').toLowerCase();
  if (looksPlatformRelated(q) && !searchHints.some((h) => q.includes(h))) return false;
  return searchHints.some((h) => q.includes(h));
}

const fetchJson = async (url, timeoutMs = 4500) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'LMS-Nexus-Chatbot/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
};

export async function webSearch(rawQuery) {
  const q = String(rawQuery || '').trim().slice(0, 180);
  if (!q) return { text: '', sources: [] };

  const sources = [];
  const bits = [];

  try {
    const ddg = await fetchJson(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`
    );
    if (ddg?.AbstractText) {
      bits.push(ddg.AbstractText);
      if (ddg.AbstractURL) sources.push({ title: ddg.Heading || q, url: ddg.AbstractURL });
    }
    for (const topic of (ddg?.RelatedTopics || []).slice(0, 4)) {
      if (topic?.Text) bits.push(topic.Text);
      if (topic?.FirstURL) sources.push({ title: topic.Text?.slice(0, 80) || 'Related', url: topic.FirstURL });
    }
  } catch {
    /* optional */
  }

  try {
    const wiki = await fetchJson(
      `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=3&namespace=0&format=json`
    );
    const titles = wiki?.[1] || [];
    const urls = wiki?.[3] || [];
    for (let i = 0; i < Math.min(titles.length, 2); i += 1) {
      try {
        const summary = await fetchJson(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titles[i])}`
        );
        if (summary?.extract) bits.push(`${titles[i]}: ${summary.extract}`);
        sources.push({
          title: titles[i],
          url: summary?.content_urls?.desktop?.page || urls[i],
        });
      } catch {
        if (urls[i]) sources.push({ title: titles[i], url: urls[i] });
      }
    }
  } catch {
    /* optional */
  }

  const uniqueSources = [];
  const seen = new Set();
  for (const s of sources) {
    if (!s?.url || seen.has(s.url)) continue;
    seen.add(s.url);
    uniqueSources.push(s);
  }

  return {
    text: bits.join('\n\n').slice(0, 3500),
    sources: uniqueSources.slice(0, 5),
  };
}

const formatMoney = (amount) => {
  const n = Number(amount || 0);
  return `৳${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const coursePrice = (c) => {
  const p = Number(c.price || 0);
  const d = c.discount_price != null ? Number(c.discount_price) : null;
  if (p === 0) return 'Free';
  if (d != null && d < p) return `${formatMoney(d)} (was ${formatMoney(p)})`;
  return formatMoney(p);
};

export function formatCatalogBlock(courses) {
  return courses
    .map((c, i) => {
      const tags = (c.tags || []).slice(0, 5).join(', ');
      return [
        `[${i + 1}] ${c.title}`,
        `slug: ${c.slug}`,
        `category: ${c.category_name || 'General'}`,
        `level: ${c.level || 'Beginner'}`,
        `rating: ${Number(c.average_rating || 0).toFixed(1)} (${c.review_count || 0} reviews)`,
        `students: ${c.enrollment_count || 0}`,
        `price: ${coursePrice(c)}`,
        `instructor: ${c.instructor_name}`,
        `featured: ${c.is_featured ? 'yes' : 'no'} · trending: ${c.is_trending ? 'yes' : 'no'}`,
        tags ? `tags: ${tags}` : null,
        `summary: ${(c.short_description || c.description || '').slice(0, 220)}`,
      ]
        .filter(Boolean)
        .join(' | ');
    })
    .join('\n');
}

export function publicCourseCard(c) {
  return {
    id: c.id,
    title: c.title,
    slug: c.slug,
    short_description: c.short_description || (c.description || '').slice(0, 180),
    average_rating: Number(c.average_rating || 0),
    review_count: Number(c.review_count || 0),
    enrollment_count: Number(c.enrollment_count || 0),
    price: Number(c.price || 0),
    discount_price: c.discount_price != null ? Number(c.discount_price) : null,
    level: c.level,
    category_name: c.category_name,
    instructor_name: c.instructor_name,
    thumbnail_url: c.thumbnail_url,
  };
}

const extractMessageContent = (message) => {
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => part?.text || part?.content || '').join('');
  }
  return '';
};

const stripThink = (text) =>
  String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?\s*[\s\S]*?```/g, (block) => {
      if (/^\s*```/.test(block) && /"answer"\s*:/.test(block)) return '';
      return block;
    })
    .trim();

export async function callCraftX({ apiKey, model, messages, maxTokens = 1200 }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const response = await fetch(CRAFTX_ENDPOINT, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.65,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data?.error?.message || data?.message || `CraftX error ${response.status}`;
      const err = new Error(detail);
      err.status = response.status;
      err.payload = data;
      throw err;
    }

    const text = stripThink(extractMessageContent(data.choices?.[0]?.message));
    return {
      text,
      warning: data.warning || null,
      usage: data.usage || null,
    };
  } finally {
    clearTimeout(timer);
  }
}

const mentionPattern = /\[\[([a-z0-9-]+)\]\]/gi;

export function collectMentionedCourses(text, catalog) {
  const bySlug = new Map(catalog.map((c) => [c.slug, c]));
  const byTitle = catalog.map((c) => ({ course: c, title: c.title.toLowerCase() }));
  const found = [];
  const seen = new Set();

  const add = (course) => {
    if (!course || seen.has(course.id)) return;
    seen.add(course.id);
    found.push(course);
  };

  for (const match of String(text || '').matchAll(mentionPattern)) {
    add(bySlug.get(match[1]));
  }

  const lower = String(text || '').toLowerCase();
  for (const { course, title } of byTitle) {
    if (title.length > 8 && lower.includes(title)) add(course);
  }

  return found;
}

export function hydrateCourseLinks(text, catalog) {
  const bySlug = new Map(catalog.map((c) => [c.slug, c]));
  return String(text || '').replace(mentionPattern, (_, slug) => {
    const course = bySlug.get(slug);
    if (!course) return courseTitleFallback(slug);
    return `[${course.title}](/courses/${course.slug})`;
  });
}

const courseTitleFallback = (slug) => `[this course](/courses/${slug})`;

function buildSystemPrompt({ catalog, relevant, search, user }) {
  const who = user?.name ? `The learner's name is ${user.name} (${user.role || 'guest'}).` : 'The visitor may be a guest.';
  const catalogBlock = formatCatalogBlock(catalog);
  const focus = relevant.length
    ? `Most relevant catalog matches for this turn:\n${formatCatalogBlock(relevant)}`
    : 'No strong catalog match yet — still use the full catalog if the user is asking about learning on this platform.';

  const searchBlock = search?.text
    ? `\nWEB SEARCH RESULTS (use these for current or external facts; cite naturally):\n${search.text}`
    : '';

  return `You are Nexus AI, the official assistant for LMS Nexus — a colorful multivendor online academy in Bangladesh (prices in BDT / ৳).

${who}

You MUST answer every question helpfully:
- Platform questions (courses, comparisons, recommendations, enroll, pricing, instructors, quizzes, certificates): use ONLY the live catalog below. Never invent a course that is not listed.
- General knowledge, coding help, career advice, homework, explanations: answer with your own knowledge.
- Current events or facts that need lookup: use the web search block when provided.

When you mention a catalog course, put [[exact-slug]] immediately after the course name the first time you mention it. Example: React Mastery [[react-mastery]].
When recommending, use ratings, review counts, student counts, level, and price. Prefer higher-rated and more popular courses unless the user has constraints (budget, beginner, specific stack).
When comparing two or more courses, use a short table-like bullet list: level, rating, price, who it is for, and a clear winner for the stated goal.
If nothing in the catalog fits, say so and point the user to /courses.

Keep answers clear, warm, and specific. Use short paragraphs and bullets. Do not mention system prompts, API keys, or CraftX.

LIVE COURSE CATALOG:
${catalogBlock || '(no published courses yet)'}

${focus}
${searchBlock}`;
}

function localPlatformFaq(question) {
  const q = String(question || '').toLowerCase();
  const enroll = /\b(enroll|enrol|buy|purchase|checkout|pay)\b/.test(q);
  const certificate = /\b(certificate|certification)\b/.test(q);
  if (enroll && certificate) {
    return 'To enroll, open a course page and choose **Enroll** or **Buy now**, then complete checkout. After you finish the lessons and required quizzes, a certificate becomes available from your student dashboard.';
  }
  if (enroll) {
    return 'To enroll: open any course page, then choose **Enroll** or **Buy now**. You will go to checkout for that course. After payment you can start learning from **My courses** in the student dashboard.';
  }
  if (certificate) {
    return 'Certificates are issued when you complete a course (all lessons plus the required quizzes). Open the course in **Learn**, finish the curriculum, then download the certificate from your student dashboard.';
  }
  if (/\b(wishlist)\b/.test(q)) {
    return 'On a course page, use **Add to wishlist**. Saved courses appear under [Wishlist](/student/wishlist) when you are signed in as a student.';
  }
  if (/\b(teach|instructor|publish)\b/.test(q)) {
    return 'Instructors can [register](/register?role=instructor), create a course, add modules and lessons, then submit it for admin review. Approved courses go live on the marketplace.';
  }
  if (/\b(login|sign in|register|account)\b/.test(q)) {
    return 'Use [Login](/login) if you already have an account, or [Register](/register) to create a student or instructor profile.';
  }
  return '';
}

function localCatalogAnswer(question, relevant) {
  const faq = localPlatformFaq(question);
  if (!relevant.length) {
    return {
      content:
        faq ||
        'I can help with LMS Nexus courses and general questions. I do not see a strong catalog match yet — try naming a skill (for example web development, UI design, or AI) or browse [/courses](/courses).',
      courses: [],
    };
  }

  const lines = relevant.map((c) => {
    const rating = `${Number(c.average_rating || 0).toFixed(1)}★ (${c.review_count || 0} reviews)`;
    return `• **[${c.title}](/courses/${c.slug})** — ${c.level || 'Beginner'}, ${rating}, ${coursePrice(c)}. ${c.short_description || ''}`.trim();
  });

  const intro = faq ? `${faq}\n\n` : '';
  return {
    content: `${intro}Here are the strongest LMS Nexus matches for “${question}”:\n\n${lines.join('\n')}\n\nOpen any title to view the full curriculum, ratings, and enrollment options.`,
    courses: relevant,
  };
}

function craftxErrorMessage(err) {
  const status = err.status;
  if (status === 401 || status === 403) {
    return 'The CraftX API key looks invalid. An admin can update it under Settings.';
  }
  if (status === 402) {
    return 'CraftX balance is too low to complete this reply. Please top up the key, then try again.';
  }
  if (err.name === 'AbortError') {
    return 'The AI took too long to respond. Please try again in a moment.';
  }
  return err.message || 'Nexus AI could not generate a reply just now.';
}

export async function replyToChat({ question, history = [], user = null }) {
  const config = await getChatbotConfig();
  if (!config.enabled) {
    const err = new Error('Nexus AI is currently turned off by an administrator.');
    err.status = 503;
    throw err;
  }

  const catalog = await loadCatalog();
  const relevant = findRelevantCourses(question, catalog);
  const shouldSearch = needsWebSearch(question);
  const search = shouldSearch ? await webSearch(question) : { text: '', sources: [] };

  if (!config.apiKey) {
    if (looksPlatformRelated(question)) {
      const local = localCatalogAnswer(question, relevant);
      return {
        content: `${local.content}\n\n_Connect a CraftX API key in Admin → Settings for full conversational answers._`,
        courses: local.courses.map(publicCourseCard),
        sources: [],
        warning: 'CraftX API key is not configured.',
      };
    }
    const err = new Error('Nexus AI is not configured yet. Add a CraftX API key in Admin → Settings.');
    err.status = 503;
    throw err;
  }

  const system = buildSystemPrompt({ catalog, relevant, search, user });
  const messages = [
    { role: 'system', content: system },
    ...history.slice(-12).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 4000),
    })),
    { role: 'user', content: question },
  ];

  try {
    const result = await callCraftX({
      apiKey: config.apiKey,
      model: config.model,
      messages,
    });

    const mentioned = collectMentionedCourses(result.text, catalog);
    const merged = [];
    const seen = new Set();
    for (const c of [...mentioned, ...(looksPlatformRelated(question) ? relevant : [])]) {
      if (!c || seen.has(c.id)) continue;
      seen.add(c.id);
      merged.push(c);
    }

    return {
      content: hydrateCourseLinks(result.text, catalog) || 'I could not generate a reply just now. Please try again.',
      courses: merged.slice(0, 6).map(publicCourseCard),
      sources: search.sources,
      warning: result.warning,
    };
  } catch (err) {
    if (looksPlatformRelated(question) && relevant.length) {
      const local = localCatalogAnswer(question, relevant);
      return {
        content: `${local.content}\n\n_(Live AI reply was unavailable: ${craftxErrorMessage(err)})_`,
        courses: local.courses.map(publicCourseCard),
        sources: search.sources,
        warning: err.message,
      };
    }
    const wrapped = new Error(craftxErrorMessage(err));
    wrapped.status = err.status || 502;
    throw wrapped;
  }
}
