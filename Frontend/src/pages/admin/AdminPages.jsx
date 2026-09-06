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

