import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { roleHome } from '../lib/utils';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('student@lmsnexus.com');
  const [password, setPassword] = useState('Root@1234');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await login(email, password);
      navigate(roleHome(user.role));
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
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
        <h1 className="font-display text-3xl font-extrabold mb-2">Welcome back</h1>
        <p className="text-white/55 text-sm mb-8">Sign in and continue your colorful learning path.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 outline-none focus:border-cyan"
              required
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 outline-none focus:border-cyan"
              required
            />
          </div>
          {error && <div className="text-sm text-coral">{error}</div>}
          <button disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 text-sm text-white/50">
          No account?{' '}
          <Link to="/register" className="text-cyan font-semibold hover:underline">Create one</Link>
        </div>
        <div className="mt-5 rounded-2xl bg-white/5 border border-white/10 p-3 text-xs text-white/40 space-y-1">
          <div>student@lmsnexus.com · aria@lmsnexus.com · admin@lmsnexus.com</div>
          <div>Password: Root@1234</div>
        </div>
      </div>
    </div>
  );
}
