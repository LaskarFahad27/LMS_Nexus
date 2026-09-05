import { Link } from 'react-router-dom';
import api from '../../lib/api';
import CourseCard from '../../components/CourseCard';
import { useLiveData } from '../../lib/async';
import { learnPath } from '../../lib/utils';

export default function StudentDashboard() {
  const { data, loading, error, reload } = useLiveData(async () => {
    const [enrollments, recs, marketplace] = await Promise.all([
      api.get('/enrollments/my-enrollments'),
      api.get('/courses/recommendations').catch(() => ({ data: { courses: [] } })),
      api.get('/courses?limit=6&sort=popular'),
    ]);
    return {
      enrollments: enrollments.data.enrollments || [],
      recs: recs.data.courses || [],
      marketplace: marketplace.data.courses || [],
    };
  });

  const enrollments = data?.enrollments || [];
  const recs = data?.recs || [];
  const marketplace = data?.marketplace || [];

  if (loading && !data) {
    return <div className="text-fog">Loading your learning data...</div>;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-coral/30 bg-coral/10 p-5">
        <div className="font-semibold mb-2">Could not load your courses</div>
        <p className="text-sm text-fog mb-3">{error}</p>
        <button onClick={reload} className="btn-primary !py-2 !px-4 !text-sm">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="section-kicker">Student studio</div>
        <h1 className="font-display text-3xl font-extrabold md:text-4xl mb-2">Your learning</h1>
        <p className="text-fog">Live progress from your enrolled courses.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Enrolled" value={enrollments.length} tone="from-cyan/20 to-cyan/5" />
        <Stat label="In progress" value={enrollments.filter((e) => !e.is_completed).length} tone="from-blue/20 to-blue/5" />
        <Stat label="Completed" value={enrollments.filter((e) => e.is_completed).length} tone="from-mint/20 to-mint/5" />
      </div>

      <section>
        <h2 className="font-display text-2xl font-bold mb-4">Continue learning</h2>
        <div className="space-y-3">
          {enrollments.map((e) => (
            <Link
              key={e.id}
              to={learnPath(e)}
              className="flex gap-4 rounded-lg border border-line bg-white p-4 hover:border-cyan/40 transition"
            >
              <img src={e.thumbnail_url || '/hero.png'} alt="" className="h-20 w-32 rounded-xl object-cover" />
              <div className="flex-1 min-w-0">
                <div className="font-bold">{e.title}</div>
                <div className="text-xs text-fog mb-2">{e.instructor_name}</div>
                <div className="h-2.5 rounded-full bg-paper-2 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan to-blue" style={{ width: `${e.progress_percentage}%` }} />
                </div>
              </div>
              <div className="text-sm font-extrabold text-cyan-deep self-center">{Number(e.progress_percentage).toFixed(0)}%</div>
            </Link>
          ))}
          {enrollments.length === 0 && (
            <div className="rounded-lg border border-dashed border-line p-6 text-fog">
              You have not enrolled yet.{' '}
              <Link to="/courses" className="font-bold text-cyan-deep">Browse the marketplace</Link>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between mb-4">
          <h2 className="font-display text-2xl font-bold">Recommended for you</h2>
          <Link to="/courses" className="text-sm font-bold text-cyan-deep">See all</Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {(recs.length ? recs : marketplace).slice(0, 6).map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className={`rounded-lg border border-line bg-gradient-to-br ${tone} p-5`}>
      <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-fog mb-1">{label}</div>
      <div className="font-display text-3xl font-extrabold">{value}</div>
    </div>
  );
}
