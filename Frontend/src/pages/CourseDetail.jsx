import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bookmark, Bot, CheckCircle2, PlayCircle, Star } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import MediaPlayer from '../components/MediaPlayer';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { coursePath, formatMoney, formatPrice, learnPath } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import { getError } from '../lib/async';

export default function CourseDetail() {
  const { slug } = useParams();
  const { user, isAuth } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState('');
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('overview');
  const [chatQ, setChatQ] = useState('');
  const [chatA, setChatA] = useState('');
  const [review, setReview] = useState({ rating: 5, comment: '' });
  const [msg, setMsg] = useState({ name: '', email: '', message: '' });
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const load = () => {
    if (!slug) {
      setMissing(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setMissing(false);
    api
      .get(`/courses/slug/${encodeURIComponent(slug)}`)
      .then((r) => setData(r.data))
      .catch(() => {
        setData(null);
        setMissing(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [slug]);

  if (loading && !data?.course) {
    return (
      <div className="page-shell">
        <Navbar />
        <div className="py-32 text-center text-fog">Loading course...</div>
      </div>
    );
  }

  if (missing || !data?.course) {
    return (
      <div className="page-shell">
        <Navbar />
        <div className="py-32 text-center">
          <div className="font-display text-2xl font-extrabold mb-2">Course not found</div>
          <p className="text-fog mb-6">This listing may still be in review, or the link is invalid.</p>
          <Link to="/courses" className="btn-primary">Browse courses</Link>
        </div>
      </div>
    );
  }

  const { course, modules, reviews, quizzes, enrolled } = data;
  const price = formatPrice(course.price, course.discount_price);

  const wishlist = async () => {
    if (!isAuth) return navigate('/login');
    setBusy('wish');
    try {
      await api.post(`/notifications/wishlist/${course.id}`);
      success('Saved to wishlist');
    } catch (err) {
      error(getError(err, 'Could not save course'));
    } finally {
      setBusy('');
    }
  };

  const askAI = async (e) => {
    e.preventDefault();
    if (!isAuth) return navigate('/login');
    setBusy('ai');
    try {
      const { data: res } = await api.post(`/courses/${course.id}/chat`, { question: chatQ });
      setChatA(res.answer);
    } catch (err) {
      error(getError(err, 'AI tutor is unavailable'));
    } finally {
      setBusy('');
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    setBusy('review');
    try {
      await api.post(`/courses/${course.id}/reviews`, review);
      setReview({ rating: 5, comment: '' });
      success('Review published');
      load();
    } catch (err) {
      error(getError(err, 'Could not publish review'));
    } finally {
      setBusy('');
    }
  };

  const contact = async (e) => {
    e.preventDefault();
    setBusy('contact');
    try {
      await api.post('/users/contact', {
        sender_name: msg.name,
        sender_email: msg.email,
        message: msg.message,
        instructor_id: course.instructor_id,
        course_id: course.id,
        subject: `Question about ${course.title}`,
      });
      setMsg({ name: '', email: '', message: '' });
      success('Message sent to instructor');
    } catch (err) {
      error(getError(err, 'Could not send message'));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="page-shell">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="overflow-hidden rounded-lg bg-ink aspect-video mb-6 relative">
            {course.preview_video_url || modules?.[0]?.lessons?.[0]?.video_url ? (
              <MediaPlayer
                title="preview"
                url={course.preview_video_url || modules[0].lessons.find((l) => l.is_preview)?.video_url || modules[0].lessons[0].video_url}
              />
            ) : (
              <img src={course.thumbnail_url || '/hero.png'} alt="" className="h-full w-full object-cover opacity-80" />
            )}
          </div>

          <div className="mb-2 text-sm text-cyan-deep font-extrabold uppercase tracking-[0.12em]">{course.category_name}</div>
          <h1 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight mb-4">{course.title}</h1>
          <p className="text-fog text-lg mb-6 max-w-3xl leading-relaxed">{course.short_description}</p>

          <div className="flex flex-wrap items-center gap-4 text-sm mb-8">
            <span className="inline-flex items-center gap-1">
              <Star size={14} className="fill-gold text-gold" /> {Number(course.average_rating).toFixed(1)} ({course.review_count} reviews)
            </span>
            <span>{course.enrollment_count} students</span>
            <span>{course.level}</span>
            <Link to={`/instructors/${course.instructor_id}`} className="font-semibold hover:text-cyan-deep">
              {course.instructor_name}
            </Link>
          </div>

          <div className="flex gap-2 border-b border-line mb-6 overflow-x-auto">
            {['overview', 'curriculum', 'reviews', 'ai', 'forum'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-3 text-sm capitalize whitespace-nowrap border-b-2 font-semibold ${
                  tab === t ? 'border-cyan text-ink' : 'border-transparent text-fog'
                }`}
              >
                {t === 'ai' ? 'AI Q&A' : t}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="space-y-6">
              <p className="leading-relaxed text-ink/80 whitespace-pre-wrap">{course.description}</p>
              <div>
                <h3 className="font-display text-xl mb-3">What you&apos;ll learn</h3>
                <ul className="grid sm:grid-cols-2 gap-2">
                  {(course.learning_outcomes || []).map((o) => (
                    <li key={o} className="flex gap-2 text-sm">
                      <CheckCircle2 size={16} className="text-accent-deep shrink-0 mt-0.5" /> {o}
                    </li>
                  ))}
                </ul>
              </div>
              <form onSubmit={contact} className="rounded-2xl border border-line bg-white p-5 space-y-3">
                <h3 className="font-display text-lg">Contact instructor</h3>
                <input className="w-full rounded-xl border border-line px-3 py-2 text-sm" placeholder="Your name" value={msg.name} onChange={(e) => setMsg({ ...msg, name: e.target.value })} required />
                <input className="w-full rounded-xl border border-line px-3 py-2 text-sm" placeholder="Email" type="email" value={msg.email} onChange={(e) => setMsg({ ...msg, email: e.target.value })} required />
                <textarea className="w-full rounded-xl border border-line px-3 py-2 text-sm" rows={3} placeholder="Message" value={msg.message} onChange={(e) => setMsg({ ...msg, message: e.target.value })} required />
                <button disabled={busy === 'contact'} className="btn-ink !py-2 !px-5 !text-sm">{busy === 'contact' ? 'Sending...' : 'Send message'}</button>
              </form>
            </div>
          )}

          {tab === 'curriculum' && (
            <div className="space-y-4">
              {(modules || []).map((m) => (
                <div key={m.id} className="rounded-2xl border border-line bg-white overflow-hidden">
                  <div className="px-4 py-3 font-semibold bg-surface">{m.title}</div>
                  <ul>
                    {(m.lessons || []).map((l) => (
                      <li key={l.id} className="flex items-center justify-between px-4 py-3 border-t border-line text-sm">
                        <span className="inline-flex items-center gap-2">
                          <PlayCircle size={16} className="text-accent-deep" /> {l.title}
                          {l.is_preview && <span className="text-[10px] uppercase text-accent-deep">Preview</span>}
                        </span>
                        <span className="text-fog">{l.duration} min</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {quizzes?.length > 0 && (
                <div className="rounded-2xl border border-line bg-white p-4">
                  <h3 className="font-semibold mb-2">Quizzes</h3>
                  {quizzes.map((q) => (
                    <div key={q.id} className="text-sm text-fog flex justify-between py-1">
                      <span>{q.title} {q.created_by_ai ? '· AI' : ''}</span>
                      {enrolled && (
                        <Link to={learnPath(course, `quiz/${q.id}`)} className="text-accent-deep font-medium">
                          Take quiz
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'reviews' && (
            <div className="space-y-4">
              {(reviews || []).map((r) => (
                <div key={r.id} className="rounded-2xl border border-line bg-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">{r.student_name}</div>
                    <div className="text-sm inline-flex items-center gap-1">
                      <Star size={12} className="fill-gold text-gold" /> {r.rating}
                    </div>
                  </div>
                  <p className="text-sm text-ink/70">{r.comment}</p>
                  {r.instructor_reply && (
                    <div className="mt-3 rounded-xl bg-surface p-3 text-sm text-fog">
                      <span className="font-semibold text-ink">Instructor: </span>
                      {r.instructor_reply}
                    </div>
                  )}
                </div>
              ))}
              {enrolled && (
                <form onSubmit={submitReview} className="rounded-2xl border border-line bg-white p-4 space-y-3">
                  <h3 className="font-semibold">Leave a review</h3>
                  <select value={review.rating} onChange={(e) => setReview({ ...review, rating: Number(e.target.value) })} className="rounded-xl border border-line px-3 py-2 text-sm">
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>{n} stars</option>
                    ))}
                  </select>
                  <textarea value={review.comment} onChange={(e) => setReview({ ...review, comment: e.target.value })} className="w-full rounded-xl border border-line px-3 py-2 text-sm" rows={3} />
                  <button disabled={busy === 'review'} className="btn-ink !py-2 !px-5 !text-sm">{busy === 'review' ? 'Publishing...' : 'Submit review'}</button>
                </form>
              )}
            </div>
          )}

          {tab === 'ai' && (
            <div className="rounded-2xl border border-line bg-white p-5 space-y-4">
              <div className="flex items-center gap-2 font-display text-xl font-bold">
                <Bot className="text-cyan-deep" /> AI Course Tutor
              </div>
              <form onSubmit={askAI} className="flex gap-2">
                <input value={chatQ} onChange={(e) => setChatQ(e.target.value)} placeholder="Ask anything about this course..." className="input-field flex-1" />
                <button disabled={busy === 'ai'} className="btn-primary !py-2.5 !px-5 !text-sm">{busy === 'ai' ? 'Thinking...' : 'Ask'}</button>
              </form>
              {chatA && <div className="rounded-xl bg-surface p-4 text-sm whitespace-pre-wrap leading-relaxed">{chatA}</div>}
            </div>
          )}

          {tab === 'forum' && <ForumPanel courseId={course.id} enrolled={enrolled} isAuth={isAuth} />}
        </div>

        <aside className="lg:sticky lg:top-24 h-fit rounded-lg border border-line bg-white p-6 space-y-4">
          <img src={course.thumbnail_url} alt="" className="rounded-2xl aspect-video object-cover w-full" />
          <div className="flex items-end gap-2">
            <div className="font-display text-3xl font-extrabold text-aurora">{price.label}</div>
            {price.original != null && <div className="text-fog line-through mb-1">{formatMoney(price.original)}</div>}
          </div>
          {enrolled || user?.id === course.instructor_id ? (
            <Link to={learnPath(course)} className="btn-primary w-full">
              Go to course
            </Link>
          ) : (
            <button
              onClick={() => (isAuth ? navigate(`/checkout/${course.id}`) : navigate('/login'))}
              className="btn-ink w-full"
            >
              Enroll now
            </button>
          )}
          <button disabled={busy === 'wish'} onClick={wishlist} className="w-full rounded-2xl border border-line py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-paper-2">
            <Bookmark size={16} /> {busy === 'wish' ? 'Saving...' : 'Save for later'}
          </button>
          <div className="text-xs text-fog space-y-1 pt-2">
            <div>Lifetime access</div>
            <div>Certificate on completion</div>
            <div>AI tutor & quizzes included</div>
          </div>
        </aside>
      </div>
      <Footer />
    </div>
  );
}

function ForumPanel({ courseId, enrolled, isAuth }) {
  const [threads, setThreads] = useState([]);
  const [form, setForm] = useState({ title: '', content: '' });

  const load = () => {
    if (!isAuth) return;
    api.get(`/forums/course/${courseId}`).then((r) => setThreads(r.data.threads || [])).catch(() => {});
  };

  useEffect(() => {
    load();
  }, [courseId, isAuth]);

  const create = async (e) => {
    e.preventDefault();
    await api.post(`/forums/course/${courseId}`, form);
    setForm({ title: '', content: '' });
    load();
  };

  if (!isAuth) return <div className="text-fog text-sm">Sign in to join discussions.</div>;

  return (
    <div className="space-y-4">
      {(enrolled || true) && (
        <form onSubmit={create} className="rounded-2xl border border-line bg-white p-4 space-y-2">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Thread title" className="w-full rounded-xl border border-line px-3 py-2 text-sm" required />
          <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Start a discussion..." className="w-full rounded-xl border border-line px-3 py-2 text-sm" rows={3} required />
          <button className="rounded-full bg-ink text-white px-4 py-2 text-sm">Post</button>
        </form>
      )}
      {threads.map((t) => (
        <div key={t.id} className="rounded-2xl border border-line bg-white p-4">
          <div className="font-semibold">{t.title}</div>
          <div className="text-xs text-fog mb-2">{t.author_name} · {t.reply_count} replies</div>
          <p className="text-sm text-ink/70">{t.content}</p>
        </div>
      ))}
    </div>
  );
}
