import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Award, CheckCircle2 } from 'lucide-react';
import api from '../lib/api';
import MediaPlayer from '../components/MediaPlayer';
import { useToast } from '../context/ToastContext';
import { getError } from '../lib/async';
import { coursePath } from '../lib/utils';

export default function Learn() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [cert, setCert] = useState(null);
  const { success, error } = useToast();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/courses/slug/${encodeURIComponent(slug)}`).then((r) => {
      setData(r.data);
      setEnrollment(r.data.enrollment);
      const first = r.data.modules?.[0]?.lessons?.[0];
      setActiveLesson(first || null);
      if (!r.data.enrolled) navigate(coursePath(r.data.course || { slug }));
    });
  }, [slug]);

  const markComplete = async (lessonId) => {
    setBusy(true);
    try {
      const { data: res } = await api.post('/enrollments/progress', {
        course_id: data.course.id,
        lesson_id: lessonId,
      });
      setEnrollment(res.enrollment);
      success(res.enrollment.is_completed ? 'Course completed' : 'Progress saved');
    } catch (err) {
      error(getError(err, 'Could not update progress'));
    } finally {
      setBusy(false);
    }
  };

  const issueCert = async () => {
    setBusy(true);
    try {
      const { data: res } = await api.post(`/enrollments/certificate/${enrollment.id}`);
      setCert(res.certificate);
      success('Certificate issued');
    } catch (err) {
      error(getError(err, 'Certificate not ready yet'));
    } finally {
      setBusy(false);
    }
  };

  if (!data?.course) {
    return <div className="min-h-screen dark-mesh text-white flex items-center justify-center">Loading classroom...</div>;
  }

  const completed = new Set(enrollment?.completed_lessons || []);

  return (
    <div className="min-h-screen bg-ink text-white flex flex-col">
      <header className="border-b border-white/10 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/student" className="text-white/60 hover:text-white"><ArrowLeft size={18} /></Link>
          <div className="truncate font-display text-lg">{data.course.title}</div>
        </div>
        <div className="text-sm text-accent">{Number(enrollment?.progress_percentage || 0).toFixed(0)}%</div>
      </header>

      <div className="flex-1 grid lg:grid-cols-[1fr_320px]">
        <div className="p-4 md:p-6">
          <div className="aspect-video rounded-2xl overflow-hidden bg-black mb-4">
            {activeLesson?.video_url ? (
              <MediaPlayer url={activeLesson.video_url} title={activeLesson.title} />
            ) : (
              <div className="h-full flex items-center justify-center text-white/40">
                {activeLesson?.document_url || activeLesson?.content ? 'Open the notes below' : 'Select a lesson'}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h1 className="font-display text-2xl">{activeLesson?.title}</h1>
            {activeLesson && (
              <button
                disabled={busy}
                onClick={() => markComplete(activeLesson.id)}
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink inline-flex items-center gap-2 disabled:opacity-60"
              >
                <CheckCircle2 size={16} /> {busy ? 'Saving...' : 'Mark complete'}
              </button>
            )}
          </div>
          {activeLesson?.content && (
            <div className="mb-4 rounded-2xl bg-white/5 border border-white/10 p-4 text-sm text-white/75 whitespace-pre-wrap">
              {activeLesson.content}
            </div>
          )}
          {activeLesson?.document_url && (
            <a href={activeLesson.document_url} className="text-accent text-sm hover:underline" target="_blank" rel="noreferrer">
              Download class notes / materials
            </a>
          )}

          {Number(enrollment?.progress_percentage) >= 100 && (
            <div className="mt-6 rounded-2xl border border-accent/30 bg-white/5 p-4 flex flex-wrap gap-3 items-center justify-between">
              <div>
                <div className="font-semibold">Course completed</div>
                <div className="text-sm text-white/50">Download your certificate of achievement.</div>
              </div>
              <button onClick={issueCert} className="rounded-full border border-accent text-accent px-4 py-2 text-sm inline-flex items-center gap-2">
                <Award size={16} /> Get certificate
              </button>
            </div>
          )}
          {cert && (
            <div className="mt-4 rounded-2xl bg-accent/10 border border-accent/20 p-4 text-sm">
              Certificate code: <span className="font-mono text-accent">{cert.certificate_code}</span>
            </div>
          )}
        </div>

        <aside className="border-l border-white/10 p-4 overflow-y-auto max-h-[calc(100vh-57px)]">
          <div className="text-xs uppercase tracking-wider text-white/40 mb-3">Curriculum</div>
          {(data.modules || []).map((m) => (
            <div key={m.id} className="mb-4">
              <div className="text-sm font-semibold mb-2 text-white/80">{m.title}</div>
              <div className="space-y-1">
                {(m.lessons || []).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setActiveLesson(l)}
                    className={`w-full text-left rounded-xl px-3 py-2 text-sm flex items-center justify-between ${
                      activeLesson?.id === l.id ? 'bg-accent/20 text-accent' : 'hover:bg-white/5 text-white/70'
                    }`}
                  >
                    <span className="truncate pr-2">{l.title}</span>
                    {completed.has(l.id) && <CheckCircle2 size={14} className="text-accent shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {(data.quizzes || []).length > 0 && (
            <div className="mt-6">
              <div className="text-xs uppercase tracking-wider text-white/40 mb-3">Quizzes</div>
              {data.quizzes.map((q) => (
                <Link key={q.id} to={`/learn/${slug}/quiz/${q.id}`} className="block rounded-xl px-3 py-2 text-sm text-accent hover:bg-white/5">
                  {q.title}
                </Link>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
