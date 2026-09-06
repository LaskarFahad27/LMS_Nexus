import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { coursePath, formatMoney, learnPath } from '../../lib/utils';
import { useLiveData, getError } from '../../lib/async';
import { useToast } from '../../context/ToastContext';
import { useState } from 'react';

export function StudentCourses() {
  const { data, loading, error, reload } = useLiveData(
    async () => (await api.get('/enrollments/my-enrollments')).data.enrollments || []
  );
  const enrollments = data || [];

  if (loading && !data) return <div className="text-fog">Loading your courses...</div>;
  if (error) return <div className="text-coral">{error} <button onClick={reload} className="underline">Retry</button></div>;

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold mb-6">My courses</h1>
      <div className="grid gap-4">
        {enrollments.map((e) => (
          <Link key={e.id} to={learnPath(e)} className="flex gap-4 rounded-lg border border-line bg-white p-4 hover:border-cyan/40">
            <img src={e.thumbnail_url || '/hero.png'} alt="" className="h-20 w-32 rounded-xl object-cover" />
            <div className="flex-1">
              <div className="font-semibold">{e.title}</div>
              <div className="text-sm text-fog mb-2">{Number(e.progress_percentage).toFixed(0)}% complete</div>
              <div className="h-2 rounded-full bg-paper-2">
                <div className="h-full bg-gradient-to-r from-cyan to-blue rounded-full" style={{ width: `${e.progress_percentage}%` }} />
              </div>
            </div>
          </Link>
        ))}
        {enrollments.length === 0 && (
          <div className="text-fog">No enrolled courses.{' '}
            <Link className="text-cyan-deep font-bold" to="/courses">Explore marketplace</Link>
          </div>
        )}
      </div>
    </div>
  );
}

export function StudentWishlist() {
  const { success, error: toastError } = useToast();
  const { data, setData, loading, error, reload } = useLiveData(
    async () => (await api.get('/notifications/wishlist')).data.wishlist || []
  );
  const wishlist = data || [];

  const remove = async (courseId) => {
    try {
      await api.delete(`/notifications/wishlist/${courseId}`);
      setData(wishlist.filter((c) => c.id !== courseId));
      success('Removed from wishlist');
    } catch (err) {
      toastError(getError(err));
    }
  };

  if (loading && !data) return <div className="text-fog">Loading wishlist...</div>;
  if (error) return <div className="text-coral">{error} <button onClick={reload}>Retry</button></div>;

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold mb-6">Wishlist</h1>
      <div className="space-y-3">
        {wishlist.map((c) => (
          <div key={c.wishlist_id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white p-4">
            <div className="flex gap-3 min-w-0">
              <img src={c.thumbnail_url || '/hero.png'} alt="" className="h-14 w-20 rounded-lg object-cover" />
              <div>
                <div className="font-semibold">{c.title}</div>
                <div className="text-sm text-fog">{c.instructor_name}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Link to={coursePath(c)} className="text-sm font-semibold text-cyan-deep">View</Link>
              <button onClick={() => remove(c.id)} className="text-sm text-coral font-semibold">Remove</button>
            </div>
          </div>
        ))}
        {wishlist.length === 0 && <div className="text-fog">No saved courses yet.</div>}
      </div>
    </div>
  );
}

export function StudentPurchases() {
  const { data, loading, error, reload } = useLiveData(
    async () => (await api.get('/enrollments/history')).data.payments || []
  );
  const payments = data || [];
  if (loading && !data) return <div className="text-fog">Loading purchases...</div>;
  if (error) return <div className="text-coral">{error} <button onClick={reload}>Retry</button></div>;
  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold mb-6">Purchase history</h1>
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-paper-2 text-left">
            <tr>
              <th className="p-3">Course</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Method</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="p-3">{p.course_title}</td>
                <td className="p-3">{formatMoney(p.amount)}</td>
                <td className="p-3 uppercase">{p.payment_method || '—'}</td>
                <td className="p-3 capitalize">{p.payment_status}</td>
                <td className="p-3">{new Date(p.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td colSpan={5} className="p-6 text-fog">No purchases yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StudentQuizzes() {
  const { data, loading, error, reload } = useLiveData(
    async () => (await api.get('/quizzes/attempts/mine')).data.attempts || []
  );
  const attempts = data || [];
  if (loading && !data) return <div className="text-fog">Loading quiz scores...</div>;
  if (error) return <div className="text-coral">{error} <button onClick={reload}>Retry</button></div>;
  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold mb-6">Quiz scores</h1>
      <div className="space-y-3">
        {attempts.map((a) => (
          <div key={a.id} className="rounded-lg border border-line bg-white p-4 flex justify-between">
            <div>
              <div className="font-semibold">{a.quiz_title}</div>
              <div className="text-sm text-fog">{a.course_title}</div>
            </div>
            <div className={`font-display text-2xl ${a.passed ? 'text-mint-deep' : 'text-coral'}`}>{a.score}%</div>
          </div>
        ))}
        {attempts.length === 0 && <div className="text-fog">No quiz attempts yet.</div>}
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { success, error } = useToast();
  const [saving, setSaving] = useState(false);
  const { data, setData, loading } = useLiveData(async () => {
    const r = await api.get('/auth/me');
    return {
      name: r.data.user.name || '',
      bio: r.data.user.bio || '',
      headline: r.data.user.headline || '',
    };
  });
  const form = data || { name: '', bio: '', headline: '' };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: res } = await api.put('/auth/profile', form);
      setData({ name: res.user.name, bio: res.user.bio || '', headline: res.user.headline || '' });
      success('Profile updated');
    } catch (err) {
      error(getError(err, 'Profile update failed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) return <div className="text-fog">Loading profile...</div>;

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl font-extrabold mb-6">Profile</h1>
      <form onSubmit={save} className="space-y-4 rounded-lg border border-line bg-white p-6">
        <input className="input-field" value={form.name} onChange={(e) => setData({ ...form, name: e.target.value })} placeholder="Name" />
        <input className="input-field" value={form.headline} onChange={(e) => setData({ ...form, headline: e.target.value })} placeholder="Headline" />
        <textarea className="input-field" rows={4} value={form.bio} onChange={(e) => setData({ ...form, bio: e.target.value })} placeholder="Bio" />
        <button disabled={saving} className="btn-ink">{saving ? 'Saving...' : 'Save changes'}</button>
      </form>
    </div>
  );
}
