import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import api from '../../lib/api';
import { coursePath, formatMoney } from '../../lib/utils';
import { useLiveData, getError } from '../../lib/async';
import { useToast } from '../../context/ToastContext';
import ChartPanel, { CHART, MetricCard, shortTitle } from '../../components/ChartPanel';

export { default as CreateCourse } from './CreateCourse';

export default function InstructorDashboard() {
  const { data, loading, error, reload } = useLiveData(
    async () => (await api.get('/instructor/dashboard')).data
  );

  if (loading && !data) return <div className="text-fog">Loading instructor studio...</div>;
  if (error) {
    return (
      <div className="rounded-2xl border border-coral/30 bg-coral/10 p-5">
        <div className="font-semibold mb-2">{error}</div>
        <button onClick={reload} className="btn-primary !py-2 !px-4 !text-sm">Retry</button>
      </div>
    );
  }

  const s = data?.stats || {};

  return (
    <div className="space-y-8">
      <div>
        <div className="section-kicker">Instructor studio</div>
        <h1 className="font-display text-3xl font-extrabold mb-2">Performance</h1>
        <p className="text-fog">Live enrollments, revenue, and course status.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total students" value={s.total_students} />
        <Kpi label="Total revenue" value={formatMoney(s.total_revenue)} />
        <Kpi label="Active courses" value={s.active_courses} />
        <Kpi label="Avg rating" value={Number(s.avg_rating || 0).toFixed(1)} />
      </div>

      <div className="rounded-lg border border-line bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-line font-semibold flex justify-between">
          <span>Course status</span>
          <Link to="/instructor/create" className="text-cyan-deep text-sm font-bold">Create course</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-paper-2 text-left">
            <tr>
              <th className="p-3">Title</th>
              <th className="p-3">Status</th>
              <th className="p-3">Students</th>
              <th className="p-3">Price</th>
            </tr>
          </thead>
          <tbody>
            {(data?.courses || []).map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="p-3 font-medium">{c.title}</td>
                <td className="p-3 capitalize"><StatusBadge status={c.status} /></td>
                <td className="p-3">{c.enrollment_count}</td>
                <td className="p-3">{formatMoney(c.price)}</td>
              </tr>
            ))}
            {(data?.courses || []).length === 0 && (
              <tr><td colSpan={4} className="p-6 text-fog">No courses yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function InstructorCourses() {
  const { success, error } = useToast();
  const { data, setData, loading, error: loadError, reload } = useLiveData(
    async () => (await api.get('/instructor/dashboard')).data.courses || []
  );
  const [busy, setBusy] = useState('');
  const courses = data || [];

  const act = async (id, fn, ok) => {
    setBusy(id);
    try {
      await fn();
      const r = await api.get('/instructor/dashboard');
      setData(r.data.courses || []);
      success(ok);
    } catch (err) {
      error(getError(err));
    } finally {
      setBusy('');
    }
  };

  if (loading && !data) return <div className="text-fog">Loading courses...</div>;
  if (loadError) return <div className="text-coral">{loadError} <button onClick={reload} className="underline">Retry</button></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display text-3xl font-extrabold">My courses</h1>
        <Link to="/instructor/create" className="btn-ink !py-2 !px-4 !text-sm">New course</Link>
      </div>
      <div className="space-y-3">
        {courses.map((c) => (
          <div key={c.id} className="rounded-lg border border-line bg-white p-4 flex flex-wrap gap-3 justify-between items-center">
            <div className="flex gap-3 min-w-0">
              {c.thumbnail_url && <img src={c.thumbnail_url} alt="" className="h-16 w-24 rounded-xl object-cover" />}
              <div>
                <div className="font-semibold">{c.title}</div>
                <div className="text-xs text-fog flex items-center gap-2 mt-1">
                  <StatusBadge status={c.status} />
                  <span>{c.enrollment_count} students</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {c.status === 'draft' && (
                <button
                  disabled={busy === c.id}
                  onClick={() => act(c.id, () => api.post(`/courses/${c.id}/submit`), 'Submitted for admin review')}
                  className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold"
                >
                  {busy === c.id ? 'Submitting...' : 'Submit for review'}
                </button>
              )}
              {c.status === 'rejected' && (
                <button
                  disabled={busy === c.id}
                  onClick={() => act(c.id, () => api.post(`/courses/${c.id}/submit`), 'Resubmitted for review')}
                  className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold"
                >
                  Resubmit
                </button>
              )}
              <button
                disabled={busy === c.id}
                onClick={() => act(c.id, () => api.post(`/courses/${c.id}/ai-quiz`, { count: 5 }), 'AI quiz generated')}
                className="rounded-full bg-cyan/15 text-cyan-deep px-3 py-1.5 text-xs font-semibold"
              >
                AI Quiz
              </button>
              <Link to={coursePath(c)} className="rounded-full bg-ink text-white px-3 py-1.5 text-xs">View</Link>
            </div>
          </div>
        ))}
        {courses.length === 0 && <div className="text-fog">No courses yet. Create your first listing.</div>}
      </div>
    </div>
  );
}

export function InstructorEarnings() {
  const { data, loading, error, reload } = useLiveData(
    async () => (await api.get('/instructor/earnings')).data
  );
  if (loading && !data) return <div className="text-fog">Loading earnings...</div>;
  if (error) return <div className="text-coral">{error} <button onClick={reload}>Retry</button></div>;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-extrabold">Earnings</h1>
      <div className="grid sm:grid-cols-3 gap-4">
        <Kpi label="Net earnings" value={formatMoney(data.summary.total_earnings)} />
        <Kpi label="Gross revenue" value={formatMoney(data.summary.gross_revenue)} />
        <Kpi label="Transactions" value={data.summary.transactions} />
      </div>
      <div className="rounded-lg border border-line bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-paper-2 text-left"><tr><th className="p-3">Course</th><th className="p-3">Student</th><th className="p-3">Earning</th><th className="p-3">Date</th></tr></thead>
          <tbody>
            {data.transactions.map((t) => (
              <tr key={t.id} className="border-t border-line">
                <td className="p-3">{t.course_title}</td>
                <td className="p-3">{t.student_name}</td>
                <td className="p-3">{formatMoney(t.instructor_earning)}</td>
                <td className="p-3">{new Date(t.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function InstructorAnalytics() {
  const { data, loading, error, reload } = useLiveData(async () => (await api.get('/instructor/analytics')).data);
  if (loading && !data) return <div className="text-fog">Loading analytics...</div>;
  if (error) return <div className="text-coral">{error} <button onClick={reload}>Retry</button></div>;

  const rows = data.engagement || [];
  const monthly = (data.monthlyEnrollments || []).map((m) => ({
    ...m,
    label: m.month?.slice(5) || m.month,
    enrollments: Number(m.enrollments),
  }));
  const revenue = (data.monthlyRevenue || []).map((m) => ({
    ...m,
    label: m.month?.slice(5) || m.month,
    earnings: Number(m.earnings),
  }));
  const t = data.totals || {};
  const bars = rows.map((r) => ({
    name: shortTitle(r.title, 14),
    full: r.title,
    enrolled: Number(r.enrollment_count || 0),
    progress: Number(r.avg_progress || 0),
    completions: Number(r.completions || 0),
  }));

  return (
    <div className="space-y-6">
      <div>
        <div className="section-kicker">Live performance</div>
        <h1 className="font-display text-3xl font-extrabold">Engagement analytics</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Students" value={Number(t.students || 0)} hint="Across all courses" />
        <MetricCard label="Courses" value={Number(t.courses || 0)} tone="from-blue/15 to-violet/10" />
        <MetricCard label="Avg progress" value={`${Number(t.avg_progress || 0).toFixed(0)}%`} tone="from-mint/15 to-cyan/10" />
        <MetricCard label="Completions" value={Number(t.completions || 0)} tone="from-sun/20 to-coral/10" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartPanel title="Enrollment trend" subtitle="New students by month">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly.length ? monthly : [{ label: '—', enrollments: 0 }]}>
                <defs>
                  <linearGradient id="enrollFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART.cyan} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={CHART.cyan} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="enrollments" stroke={CHART.cyan} fill="url(#enrollFill)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel title="Revenue trend" subtitle="Instructor earnings (BDT)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenue.length ? revenue : [{ label: '—', earnings: 0 }]}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatMoney(v)} />
                <Line type="monotone" dataKey="earnings" stroke={CHART.blue} strokeWidth={3} dot={{ r: 4, fill: CHART.blue }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
      </div>

      <ChartPanel title="Course comparison" subtitle="Enrollments vs completions">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bars.length ? bars : [{ name: 'No courses', enrolled: 0, completions: 0 }]}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="enrolled" fill={CHART.cyan} radius={[8, 8, 0, 0]} />
              <Bar dataKey="completions" fill={CHART.blue} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>

      <ChartPanel title="Learning progress" subtitle="Average completion per course">
        <div className="space-y-4">
          {rows.map((r) => (
            <div key={r.id}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-semibold">{r.title}</span>
                <span className="text-cyan-deep font-bold">{Number(r.avg_progress).toFixed(0)}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-paper-2 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan to-blue" style={{ width: `${Math.min(100, Number(r.avg_progress) || 0)}%` }} />
              </div>
              <div className="text-xs text-fog mt-1">{r.enrollment_count} enrolled · {r.completions} completed · {Number(r.average_rating || 0).toFixed(1)} rating</div>
            </div>
          ))}
          {rows.length === 0 && <div className="text-fog text-sm">Publish a course to see engagement.</div>}
        </div>
      </ChartPanel>
    </div>
  );
}

export function InstructorMessages() {
  const { data, loading } = useLiveData(async () => (await api.get('/instructor/messages')).data.messages || []);
  const messages = data || [];
  if (loading && !data) return <div className="text-fog">Loading messages...</div>;
  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold mb-6">Messages</h1>
      <div className="space-y-3">
        {messages.map((m) => (
          <div key={m.id} className="rounded-lg border border-line bg-white p-4">
            <div className="font-semibold">{m.subject}</div>
            <div className="text-xs text-fog mb-2">{m.sender_name} · {m.sender_email}</div>
            <p className="text-sm">{m.message}</p>
          </div>
        ))}
        {messages.length === 0 && <div className="text-fog">No messages yet.</div>}
      </div>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="rounded-lg border border-line bg-white p-5">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-fog mb-1">{label}</div>
      <div className="font-display text-2xl font-extrabold">{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = {
    approved: 'bg-mint/15 text-mint-deep',
    pending: 'bg-sun/20 text-ink',
    draft: 'bg-paper-2 text-fog',
    rejected: 'bg-coral/15 text-coral',
  };
  return <span className={`rounded-md px-2 py-1 text-xs font-semibold capitalize ${colors[status] || ''}`}>{status}</span>;
}
