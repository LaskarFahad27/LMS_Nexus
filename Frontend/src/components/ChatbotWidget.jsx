import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Loader2, RotateCcw, Send, Sparkles, Star, X } from 'lucide-react';
import api from '../lib/api';
import { coursePath, formatPrice } from '../lib/utils';

const SESSION_KEY = 'lms_chat_session_id';
const SUGGESTIONS = [
  'I want to learn web development — which course is best?',
  'Compare the top AI courses',
  'How do I enroll and get a certificate?',
  'Explain React hooks simply',
];

function renderRichText(text) {
  const lines = String(text || '').split('\n');
  return lines.map((line, lineIdx) => {
    const parts = [];
    const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
    let last = 0;
    let match;
    let key = 0;
    while ((match = pattern.exec(line)) !== null) {
      if (match.index > last) parts.push(line.slice(last, match.index));
      const token = match[0];
      if (token.startsWith('**')) {
        parts.push(<strong key={`${lineIdx}-b-${key++}`}>{token.slice(2, -2)}</strong>);
      } else if (token.startsWith('`')) {
        parts.push(
          <code key={`${lineIdx}-c-${key++}`} className="rounded bg-mist px-1 py-0.5 text-[12px]">
            {token.slice(1, -1)}
          </code>
        );
      } else {
        const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        const href = link[2];
        const label = link[1];
        if (href.startsWith('/')) {
          parts.push(
            <Link key={`${lineIdx}-l-${key++}`} to={href} className="font-semibold text-cyan-deep underline underline-offset-2 hover:text-blue">
              {label}
            </Link>
          );
        } else {
          parts.push(
            <a key={`${lineIdx}-a-${key++}`} href={href} target="_blank" rel="noreferrer" className="font-semibold text-blue underline underline-offset-2">
              {label}
            </a>
          );
        }
      }
      last = match.index + token.length;
    }
    if (last < line.length) parts.push(line.slice(last));
    const isBullet = /^\s*[-•]\s+/.test(line);
    return (
      <div key={lineIdx} className={isBullet ? 'pl-1' : undefined}>
        {parts.length ? parts : <span className="block h-2" />}
      </div>
    );
  });
}

function CourseChip({ course }) {
  const price = formatPrice(course.price, course.discount_price);
  return (
    <Link
      to={coursePath(course)}
      className="flex gap-3 rounded-md border border-line bg-white p-2.5 transition hover:border-cyan/40 hover:shadow-sm"
    >
      <img
        src={course.thumbnail_url || '/hero.png'}
        alt=""
        className="h-14 w-20 shrink-0 rounded-md object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-[13px] font-bold leading-snug">{course.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-fog">
          <span className="inline-flex items-center gap-0.5 font-semibold text-ink">
            <Star size={10} className="fill-sun text-sun" />
            {Number(course.average_rating || 0).toFixed(1)}
          </span>
          <span>{course.level}</span>
          <span className="font-bold text-ink">{price.label}</span>
        </div>
      </div>
    </Link>
  );
}

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(SESSION_KEY) || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const welcome = useMemo(
    () => ({
      id: 'welcome',
      role: 'assistant',
      content:
        'Hi — I am **Nexus AI**. Ask me anything: the best course for a skill, a comparison between two courses, how enrollment works, or a question completely outside the platform.',
      courses: [],
      sources: [],
    }),
    []
  );

  useEffect(() => {
    if (!sessionId) return;
    api
      .get('/chatbot/history', { params: { session_id: sessionId } })
      .then((r) => {
        if (r.data.session_id && r.data.session_id !== sessionId) {
          setSessionId(r.data.session_id);
          localStorage.setItem(SESSION_KEY, r.data.session_id);
        }
        setMessages(r.data.messages || []);
      })
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    inputRef.current?.focus();
  }, [open, messages, busy]);

  useEffect(() => {
    document.body.classList.toggle('chatbot-open', open);
    return () => document.body.classList.remove('chatbot-open');
  }, [open]);

  const send = async (raw) => {
    const text = String(raw ?? input).trim();
    if (!text || busy) return;
    setInput('');
    setError('');
    setBusy(true);
    const optimistic = { id: `u-${Date.now()}`, role: 'user', content: text, courses: [], sources: [] };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const { data } = await api.post('/chatbot/message', {
        message: text,
        session_id: sessionId || undefined,
      });
      if (data.session_id) {
        setSessionId(data.session_id);
        localStorage.setItem(SESSION_KEY, data.session_id);
      }
      setMessages((prev) => [...prev, data.message]);
    } catch (err) {
      setError(err.response?.data?.message || 'Nexus AI could not reply just now.');
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text);
    } finally {
      setBusy(false);
    }
  };

  const resetChat = async () => {
    try {
      if (sessionId) await api.delete('/chatbot/history', { params: { session_id: sessionId } });
    } catch {
      /* still reset locally */
    }
    localStorage.removeItem(SESSION_KEY);
    setSessionId('');
    setMessages([]);
    setError('');
  };

  const thread = messages.length ? messages : [welcome];

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.button
            type="button"
            key="chatbot-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="chatbot-backdrop"
            aria-label="Close Nexus AI"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.aside
            key="chatbot-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="chatbot-panel"
          >
            <div className="flex items-center gap-3 border-b border-white/10 bg-gradient-to-r from-ink via-ink-soft to-[#123247] px-4 py-3.5 text-white">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-to-br from-cyan to-blue">
                <Sparkles size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg font-extrabold leading-none">Nexus AI</div>
                <div className="mt-1 text-[11px] text-white/65">Courses, comparisons, and anything else</div>
              </div>
              <button type="button" onClick={resetChat} className="rounded-md p-2 text-white/70 hover:bg-white/10" title="New chat">
                <RotateCcw size={16} />
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-2 text-white/70 hover:bg-white/10" title="Close">
                <X size={18} />
              </button>
            </div>

            <div ref={listRef} className="chatbot-thread">
              {thread.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={m.role === 'user' ? 'chatbot-bubble-user' : 'chatbot-bubble-ai'}>
                    <div className="space-y-1 text-[13.5px] leading-relaxed">{renderRichText(m.content)}</div>
                    {m.role === 'assistant' && m.courses?.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {m.courses.map((c) => (
                          <CourseChip key={c.id || c.slug} course={c} />
                        ))}
                      </div>
                    )}
                    {m.role === 'assistant' && m.sources?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {m.sources.map((s) => (
                          <a
                            key={s.url}
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md bg-paper-2 px-2 py-0.5 text-[10px] font-semibold text-fog hover:text-ink"
                          >
                            {s.title || 'Source'}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="chatbot-bubble-ai flex items-center gap-2 text-fog">
                    <Loader2 size={14} className="animate-spin" />
                    Thinking…
                  </div>
                </div>
              )}
              {!messages.length && !busy && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-md border border-line bg-white px-3 py-1.5 text-left text-[12px] font-semibold text-ink/80 hover:border-cyan/40"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {error && <div className="rounded-md bg-coral/10 px-3 py-2 text-xs font-semibold text-coral">{error}</div>}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-end gap-2 border-t border-line bg-white p-3"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Ask about a course, or anything else…"
                className="max-h-28 min-h-[44px] flex-1 resize-none rounded-md border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-cyan"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-cyan to-blue text-white disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="chatbot-fab"
          aria-label="Open Nexus AI"
        >
          <Bot size={22} />
        </button>
      )}
    </>
  );
}
