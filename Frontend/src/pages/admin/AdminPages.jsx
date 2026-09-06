import { useEffect, useState } from 'react';
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import api from '../../lib/api';
import { formatMoney } from '../../lib/utils';
import { useLiveData, getError } from '../../lib/async';
import { useToast } from '../../context/ToastContext';
import ChartPanel, { CHART, MetricCard, shortTitle } from '../../components/ChartPanel';

export default function AdminDashboard() {
  const { success, error } = useToast();
  const { data, setData, loading, error: loadError, reload } = useLiveData(
    async () => (await api.get('/admin/dashboard')).data
  );
  const [busy, setBusy] = useState('');

  const review = async (id, decision) => {
    const feedback = decision === 'reject' ? window.prompt('Rejection feedback') : '';
    if (decision === 'reject' && feedback === null) return;
    setBusy(id);
    try {
      await api.post(`/admin/courses/${id}/review`, { decision, feedback: feedback || 'Does not meet quality guidelines' });
      const r = await api.get('/admin/dashboard');
      setData(r.data);
      success(decision === 'approve' ? 'Course approved and published' : 'Course rejected');
    } catch (err) {
      error(getError(err, 'Review failed'));
    } finally {
      setBusy('');
    }
  };

  if (loading && !data) return <div className="text-fog">Loading admin dashboard...</div>;
  if (loadError) return <div className="text-coral">{loadError} <button onClick={reload}>Retry</button></div>;

  const s = data.stats;

  return (
    <div className="space-y-8">
      <div>
        <div className="section-kicker">Admin</div>
        <h1 className="font-display text-3xl font-extrabold mb-2">Marketplace control</h1>
        <p className="text-fog">Approve courses, monitor users, and track revenue.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="Students" value={s.students} />
        <Card label="Instructors" value={s.instructors} />
        <Card label="Pending courses" value={s.pending_courses} />
        <Card label="Platform revenue" value={formatMoney(s.platform_revenue)} />
      </div>

      <div className="rounded-lg border border-line bg-white overflow-hidden">
        <div className="px-4 py-3 font-semibold border-b border-line">Pending course approvals</div>
        <div className="divide-y border-line">
          {(data.pendingCourses || []).map((c) => (
            <div key={c.id} className="p-4 flex flex-wrap gap-3 justify-between items-center">
              <div className="flex gap-3 min-w-0">
                {c.thumbnail_url && <img src={c.thumbnail_url} alt="" className="h-14 w-20 rounded-lg object-cover" />}
                <div>
                  <div className="font-semibold">{c.title}</div>
                  <div className="text-xs text-fog">{c.instructor_name} · {c.category_name || 'Uncategorized'}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button disabled={busy === c.id} onClick={() => review(c.id, 'approve')} className="rounded-full bg-mint px-4 py-1.5 text-xs font-semibold text-ink disabled:opacity-50">
                  {busy === c.id ? 'Working...' : 'Approve'}
                </button>
                <button disabled={busy === c.id} onClick={() => review(c.id, 'reject')} className="rounded-full border border-coral text-coral px-4 py-1.5 text-xs disabled:opacity-50">
                  Reject
                </button>
              </div>
            </div>
          ))}
          {data.pendingCourses?.length === 0 && <div className="p-4 text-fog text-sm">No pending courses.</div>}
        </div>
      </div>
    </div>
  );
}

export function AdminCourses() {
  const { success, error } = useToast();
  const { data, setData, loading, reload, error: loadError } = useLiveData(
    async () => (await api.get('/admin/courses')).data.courses || []
  );
  const courses = data || [];
  const [busy, setBusy] = useState('');

  const feature = async (id, featured) => {
    setBusy(id);
    try {
      await api.patch(`/admin/courses/${id}/feature`, { featured, trending: featured });
      setData(courses.map((c) => (c.id === id ? { ...c, is_featured: featured, is_trending: featured } : c)));
      success(featured ? 'Course featured' : 'Course unfeatured');
    } catch (err) {
      error(getError(err));
    } finally {
      setBusy('');
    }
  };

  const review = async (id, decision) => {
    const feedback = decision === 'reject' ? window.prompt('Rejection feedback') : '';
    if (decision === 'reject' && feedback === null) return;
    setBusy(id);
    try {
      await api.post(`/admin/courses/${id}/review`, { decision, feedback });
      const r = await api.get('/admin/courses');
      setData(r.data.courses || []);
      success(decision === 'approve' ? 'Approved' : 'Rejected');
    } catch (err) {
      error(getError(err, 'Action failed'));
    } finally {
      setBusy('');
    }
  };

  if (loading && !data) return <div className="text-fog">Loading courses...</div>;
  if (loadError) return <div className="text-coral">{loadError} <button onClick={reload}>Retry</button></div>;

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold mb-6">All courses</h1>
      <div className="space-y-3">
        {courses.map((c) => (
          <div key={c.id} className="rounded-lg border border-line bg-white p-4 flex flex-wrap justify-between gap-3">
            <div>
              <div className="font-semibold">{c.title}</div>
              <div className="text-xs text-fog capitalize">{c.status} · {c.instructor_name}</div>
            </div>
            <div className="flex gap-2">
              {c.status === 'pending' && (
                <>
                  <button disabled={busy === c.id} onClick={() => review(c.id, 'approve')} className="rounded-full bg-mint px-3 py-1.5 text-xs font-semibold">Approve</button>
                  <button disabled={busy === c.id} onClick={() => review(c.id, 'reject')} className="rounded-full border border-coral text-coral px-3 py-1.5 text-xs">Reject</button>
                </>
              )}
              <button disabled={busy === c.id} onClick={() => feature(c.id, !c.is_featured)} className="rounded-full border border-line px-3 py-1.5 text-xs">
                {c.is_featured ? 'Unfeature' : 'Feature'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminUsers() {
  const { success, error } = useToast();
  const { data, setData, loading } = useLiveData(async () => (await api.get('/admin/users')).data.users || []);
  const users = data || [];

  const ban = async (id, nextBan) => {
    try {
      await api.patch(`/admin/users/${id}/ban`, { ban: nextBan });
      setData(users.map((u) => (u.id === id ? { ...u, is_banned: nextBan } : u)));
      success(nextBan ? 'User banned' : 'User reinstated');
    } catch (err) {
      error(getError(err));
    }
  };

  if (loading && !data) return <div className="text-fog">Loading users...</div>;

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold mb-6">Users</h1>
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-paper-2 text-left"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="p-3">{u.name}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3 capitalize">{u.role}</td>
                <td className="p-3">{u.is_banned ? 'Banned' : 'Active'}</td>
                <td className="p-3">
                  {u.role !== 'admin' && (
                    <button onClick={() => ban(u.id, !u.is_banned)} className="text-xs font-semibold text-coral">
                      {u.is_banned ? 'Reinstate' : 'Ban'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminPayments() {
  const { success, error } = useToast();
  const { data, setData, loading } = useLiveData(async () => (await api.get('/admin/payments')).data.payments || []);
  const payments = data || [];

  const refund = async (id) => {
    try {
      await api.patch(`/admin/payments/${id}/refund`);
      setData(payments.map((p) => (p.id === id ? { ...p, payment_status: 'refunded' } : p)));
      success('Refund processed');
    } catch (err) {
      error(getError(err, 'Refund failed'));
    }
  };

  if (loading && !data) return <div className="text-fog">Loading payments...</div>;

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold mb-6">Payments</h1>
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-paper-2 text-left"><tr><th className="p-3">Course</th><th className="p-3">Student</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="p-3">{p.course_title}</td>
                <td className="p-3">{p.student_name}</td>
                <td className="p-3">{formatMoney(p.amount)}</td>
                <td className="p-3 capitalize">{p.payment_status}</td>
                <td className="p-3">
                  {p.payment_status === 'completed' && (
                    <button onClick={() => refund(p.id)} className="text-xs text-coral font-semibold">Refund</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminCategories() {
  const { success, error } = useToast();
  const [name, setName] = useState('');
  const { data, setData, loading } = useLiveData(async () => (await api.get('/categories')).data.categories || []);
  const categories = data || [];

  const add = async (e) => {
    e.preventDefault();
    try {
      const { data: res } = await api.post('/categories', { name });
      setData([res.category, ...categories.filter((c) => c.id !== res.category.id)]);
      setName('');
      success('Category added');
    } catch (err) {
      error(getError(err));
    }
  };

  if (loading && !data) return <div className="text-fog">Loading categories...</div>;

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold mb-6">Categories</h1>
      <form onSubmit={add} className="flex gap-2 mb-4">
        <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="New category" required />
        <button className="btn-ink !px-4">Add</button>
      </form>
      <div className="space-y-2">
        {categories.map((c) => (
          <div key={c.id} className="rounded-xl border border-line bg-white px-4 py-3 flex justify-between text-sm">
            <span>{c.name}</span>
            <span className="text-fog">{c.course_count} courses</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminAnnouncements() {
  const { success, error } = useToast();
  const [form, setForm] = useState({ title: '', message: '', target_role: 'all' });
  const [saving, setSaving] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post('/admin/announcements', form);
      success(`Announcement sent to ${data.recipients} users`);
      setForm({ title: '', message: '', target_role: 'all' });
    } catch (err) {
      error(getError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl font-extrabold mb-6">Announcements</h1>
      <form onSubmit={send} className="space-y-3 rounded-lg border border-line bg-white p-6">
        <input className="input-field" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <textarea className="input-field" rows={4} placeholder="Message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
        <select className="input-field" value={form.target_role} onChange={(e) => setForm({ ...form, target_role: e.target.value })}>
          <option value="all">Everyone</option>
          <option value="student">Students</option>
          <option value="instructor">Instructors</option>
        </select>
        <button disabled={saving} className="btn-ink">{saving ? 'Sending...' : 'Send announcement'}</button>
      </form>
    </div>
  );
}

export function AdminReports() {
  const { data, loading, error, reload } = useLiveData(async () => (await api.get('/admin/reports')).data);
  if (loading && !data) return <div className="text-fog">Loading reports...</div>;
  if (error) return <div className="text-coral">{error} <button onClick={reload}>Retry</button></div>;
  if (!data) return null;

  const k = data.kpis || {};
  const revenue = (data.revenueByMonth || []).map((m) => ({
    label: m.month?.slice(5) || m.month,
    gross: Number(m.gross),
    platform: Number(m.platform),
  }));
  const enrollments = (data.enrollmentsByMonth || []).map((m) => ({
    label: m.month?.slice(5) || m.month,
    enrollments: Number(m.enrollments),
  }));
  const courseBars = (data.topCourses || []).map((c) => ({
    name: shortTitle(c.title, 14),
    students: Number(c.enrollment_count),
    rating: Number(c.average_rating),
  }));
  const instructorBars = (data.topInstructors || []).map((i) => ({
    name: i.name.split(' ')[0],
    earnings: Number(i.earnings),
    students: Number(i.students),
  }));
  const statusColors = { approved: CHART.mint, pending: CHART.sun, draft: CHART.blue, rejected: CHART.coral };
  const statusPie = (data.courseStatus || []).map((s) => ({
    name: s.status,
    value: Number(s.count),
    color: statusColors[s.status] || CHART.violet,
  }));
  const rolePie = (data.usersByRole || []).map((s, i) => ({
    name: s.role,
    value: Number(s.count),
    color: [CHART.cyan, CHART.blue, CHART.violet][i % 3],
  }));
  const categories = (data.categoryMix || []).map((c) => ({
    name: shortTitle(c.name, 12),
    count: Number(c.count),
  }));

  return (
    <div className="space-y-6">
      <div>
        <div className="section-kicker">Platform intelligence</div>
        <h1 className="font-display text-3xl font-extrabold">Reports</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Students" value={Number(k.students || 0)} />
        <MetricCard label="Instructors" value={Number(k.instructors || 0)} tone="from-blue/15 to-violet/10" />
        <MetricCard label="Live courses" value={Number(k.live_courses || 0)} tone="from-mint/15 to-cyan/10" />
        <MetricCard label="Platform revenue" value={formatMoney(k.platform)} hint={`${Number(k.enrollments || 0)} enrollments`} tone="from-sun/20 to-coral/10" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartPanel title="Revenue over time" subtitle="Gross vs platform commission (BDT)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={revenue.length ? revenue : [{ label: '—', gross: 0, platform: 0 }]}>
                <defs>
                  <linearGradient id="grossFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART.blue} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART.blue} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatMoney(v)} />
                <Legend />
                <Area type="monotone" dataKey="gross" stroke={CHART.blue} fill="url(#grossFill)" strokeWidth={3} />
                <Line type="monotone" dataKey="platform" stroke={CHART.mint} strokeWidth={3} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel title="Enrollment momentum" subtitle="New enrollments by month">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={enrollments.length ? enrollments : [{ label: '—', enrollments: 0 }]}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="enrollments" stroke={CHART.cyan} strokeWidth={3} dot={{ r: 4, fill: CHART.cyan }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartPanel title="Top courses" subtitle="Students enrolled">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={courseBars.length ? courseBars : [{ name: '—', students: 0 }]} layout="vertical">
                <CartesianGrid stroke={CHART.grid} horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="students" fill={CHART.cyan} radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel title="Top instructors" subtitle="Earnings in BDT">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={instructorBars.length ? instructorBars : [{ name: '—', earnings: 0 }]}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip formatter={(v) => formatMoney(v)} />
                <Bar dataKey="earnings" fill={CHART.blue} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <ChartPanel title="Course status" subtitle="Marketplace pipeline">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusPie.length ? statusPie : [{ name: 'none', value: 1, color: CHART.grid }]} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={3}>
                  {(statusPie.length ? statusPie : []).map((s) => <Cell key={s.name} fill={s.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
        <ChartPanel title="Users by role" subtitle="Platform mix">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={rolePie.length ? rolePie : [{ name: 'none', value: 1 }]} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={3}>
                  {rolePie.map((s) => <Cell key={s.name} fill={s.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
        <ChartPanel title="Categories" subtitle="Approved courses">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categories.length ? categories : [{ name: '—', count: 0 }]}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill={CHART.mint} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
      </div>
    </div>
  );
}

export function AdminSettings() {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [commission, setCommission] = useState(0.2);
  const [siteName, setSiteName] = useState('LMS Nexus');
  const [chatbotEnabled, setChatbotEnabled] = useState(true);
  const [craftxModel, setCraftxModel] = useState('Qwen3 VL 30B');
  const [craftxKey, setCraftxKey] = useState('');
  const [keyMeta, setKeyMeta] = useState({ configured: false, masked: '' });
  const [clearKey, setClearKey] = useState(false);

  useEffect(() => {
    let active = true;
    api.get('/admin/settings')
      .then((r) => {
        if (!active) return;
        const s = r.data.settings || {};
        if (s.commission_rate != null) setCommission(Number(s.commission_rate));
        if (s.site_name) setSiteName(String(s.site_name));
        if (s.chatbot_enabled != null) setChatbotEnabled(s.chatbot_enabled !== false && s.chatbot_enabled !== 'false');
        if (s.craftx_model) setCraftxModel(String(s.craftx_model));
        if (s.craftx_api_key && typeof s.craftx_api_key === 'object') {
          setKeyMeta({
            configured: Boolean(s.craftx_api_key.configured),
            masked: s.craftx_api_key.masked || '',
          });
        }
      })
      .catch((err) => error(getError(err, 'Failed to load settings')))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        commission_rate: commission,
        site_name: siteName || 'LMS Nexus',
        chatbot_enabled: chatbotEnabled,
        craftx_model: craftxModel || 'Qwen3 VL 30B',
      };
      if (clearKey) payload.craftx_api_key = '__CLEAR__';
      else if (craftxKey.trim()) payload.craftx_api_key = craftxKey.trim();

      await api.put('/admin/settings', payload);

      if (clearKey) setKeyMeta({ configured: false, masked: '' });
      else if (craftxKey.trim()) {
        setKeyMeta({ configured: true, masked: `••••••••${craftxKey.trim().slice(-4)}` });
      }
      setCraftxKey('');
      setClearKey(false);
      success('Settings saved');
    } catch (err) {
      error(getError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-fog">Loading settings...</div>;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="section-kicker">Admin</div>
        <h1 className="font-display text-3xl font-extrabold">Platform settings</h1>
        <p className="mt-1 text-fog">Marketplace commission and Nexus AI (CraftX) configuration.</p>
      </div>

      <form onSubmit={save} className="space-y-5">
        <section className="rounded-lg border border-line bg-white p-6 space-y-3">
          <h2 className="font-display text-xl font-bold">Marketplace</h2>
          <label className="text-sm font-semibold">Site name</label>
          <input className="input-field" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
          <label className="text-sm font-semibold">Commission rate</label>
          <input type="number" step="0.01" min="0" max="1" value={commission} onChange={(e) => setCommission(Number(e.target.value))} className="input-field" />
          <p className="text-xs text-fog">Use a decimal between 0 and 1. Example: 0.20 = 20%.</p>
        </section>

        <section className="rounded-lg border border-line bg-white p-6 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold">Nexus AI / CraftX</h2>
              <p className="text-sm text-fog">The site-wide chatbot uses this key on the server. Visitors never see it.</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold shrink-0">
              <input type="checkbox" checked={chatbotEnabled} onChange={(e) => setChatbotEnabled(e.target.checked)} />
              Enabled
            </label>
          </div>

          <label className="text-sm font-semibold">CraftX API key</label>
          <input
            type="password"
            autoComplete="new-password"
            className="input-field font-mono"
            value={craftxKey}
            onChange={(e) => { setCraftxKey(e.target.value); setClearKey(false); }}
            placeholder={keyMeta.configured ? keyMeta.masked || 'Key saved — enter a new one to replace' : 'Paste your CraftX API key'}
          />
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className={keyMeta.configured ? 'font-semibold text-mint-deep' : 'text-fog'}>
              {keyMeta.configured ? `Saved key ${keyMeta.masked}` : 'No key saved yet'}
            </span>
            {keyMeta.configured && (
              <button
                type="button"
                onClick={() => { setClearKey(true); setCraftxKey(''); setKeyMeta({ configured: false, masked: '' }); }}
                className="font-semibold text-coral"
              >
                Remove key
              </button>
            )}
          </div>

          <label className="text-sm font-semibold">Model</label>
          <input className="input-field" value={craftxModel} onChange={(e) => setCraftxModel(e.target.value)} placeholder="Qwen3 VL 30B" />
          <p className="text-xs text-fog">
            Default model is <span className="font-semibold">Qwen3 VL 30B</span>. Endpoint: api.craftx.corecraftsolutions.com
          </p>
        </section>

        <button disabled={saving} className="btn-ink">{saving ? 'Saving...' : 'Save settings'}</button>
      </form>
    </div>
  );
}

function Card({ label, value }) {
  return (
    <div className="rounded-lg border border-line bg-white p-5">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-fog mb-1">{label}</div>
      <div className="font-display text-3xl font-extrabold">{value}</div>
    </div>
  );
}
