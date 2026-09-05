import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { roleHome } from '../lib/utils';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: params.get('role') === 'instructor' ? 'instructor' : 'student',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await register(form);
      navigate(roleHome(user.role));
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-lg border border-white/15 bg-white/10 p-8 text-white backdrop-blur-2xl">
        <Link to="/" className="inline-flex items-center gap-2 mb-8">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan to-blue">
            <Zap size={16} fill="white" />
          </span>
          <span className="font-display text-xl font-extrabold">LMS Nexus</span>
        </Link>
        <h1 className="font-display text-3xl font-extrabold mb-2">Join LMS Nexus</h1>
        <p className="text-white/55 text-sm mb-8">Create a learner or instructor profile in seconds.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-white/5 border border-white/10">
            {['student', 'instructor'].map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setForm((f) => ({ ...f, role }))}
                className={`rounded-xl py-2.5 text-sm capitalize font-bold transition ${
                  form.role === role
                    ? 'bg-gradient-to-r from-cyan to-blue text-white'
                    : 'text-white/55 hover:text-white'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
          <input
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 outline-none focus:border-cyan"
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 outline-none focus:border-cyan"
            required
          />
          <input
            type="password"
            placeholder="Password (min 6)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 outline-none focus:border-cyan"
            required
            minLength={6}
          />
          {error && <div className="text-sm text-coral">{error}</div>}
          <button disabled={loading} className="btn-primary w-full">
            {loading ? 'Creating...' : 'Create account'}
          </button>
        </form>

        <div className="mt-6 text-sm text-white/50">
          Already have an account?{' '}
          <Link to="/login" className="text-cyan font-semibold hover:underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
