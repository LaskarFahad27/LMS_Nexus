import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Bell, Menu, Search, X, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { roleHome } from '../lib/utils';
import api from '../lib/api';

export default function Navbar({ transparent = false }) {
  const { user, logout, isAuth } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [unread, setUnread] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!isAuth) return;
    api.get('/notifications').then((r) => setUnread(r.data.unread || 0)).catch(() => {});
  }, [isAuth]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const onSearch = (e) => {
    e.preventDefault();
    navigate(`/courses?search=${encodeURIComponent(q)}`);
    setOpen(false);
  };

  const solid = !transparent || scrolled || open;

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        solid
          ? 'border-b border-line bg-white/85 backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3.5 md:px-6">
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan to-blue text-white shadow-[0_10px_30px_-12px_rgba(47,107,255,0.65)]">
            <Zap size={18} fill="currentColor" />
          </span>
          <span className={`font-display text-[1.35rem] font-extrabold tracking-tight ${solid ? 'text-ink' : 'text-white'}`}>
            LMS <span className={solid ? 'text-aurora' : 'text-cyan'}>Nexus</span>
          </span>
        </Link>

        <form
          onSubmit={onSearch}
          className={`hidden md:flex flex-1 max-w-md mx-2 items-center gap-2 rounded-2xl px-4 py-2.5 ${
            solid ? 'bg-paper-2 border border-line' : 'bg-white/15 border border-white/20 backdrop-blur-md'
          }`}
        >
          <Search size={16} className={solid ? 'text-fog' : 'text-white/70'} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search skills, courses, mentors..."
            className={`w-full bg-transparent text-sm outline-none ${
              solid ? 'text-ink placeholder:text-fog' : 'text-white placeholder:text-white/55'
            }`}
          />
        </form>

        <nav className={`ml-auto hidden lg:flex items-center gap-1 text-sm font-semibold ${solid ? 'text-ink/70' : 'text-white/80'}`}>
          {[
            ['Explore', '/courses'],
            ['Instructors', '/instructors'],
          ].map(([label, to]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `rounded-xl px-3 py-2 transition ${
                  isActive
                    ? solid
                      ? 'bg-paper-2 text-ink'
                      : 'bg-white/15 text-white'
                    : solid
                      ? 'hover:bg-paper-2 hover:text-ink'
                      : 'hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {label}
            </NavLink>
          ))}

          {isAuth ? (
            <>
              <Link
                to={roleHome(user.role)}
                className={`rounded-xl px-3 py-2 ${solid ? 'hover:bg-paper-2' : 'hover:bg-white/10'}`}
              >
                Dashboard
              </Link>
              <Link to="/notifications" className={`relative rounded-xl p-2 ${solid ? 'hover:bg-paper-2' : 'hover:bg-white/10'}`}>
                <Bell size={18} />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-coral" />
                )}
              </Link>
              <button
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                className={`ml-1 rounded-xl px-4 py-2 border ${
                  solid ? 'border-line hover:bg-paper-2' : 'border-white/25 hover:bg-white/10'
                }`}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className={`rounded-xl px-3 py-2 ${solid ? 'hover:bg-paper-2' : 'hover:bg-white/10'}`}>
                Sign in
              </Link>
              <Link to="/register" className="ml-1 btn-primary !py-2.5 !px-4 !text-sm">
                Get started
              </Link>
            </>
          )}
        </nav>

        <button
          className={`lg:hidden ml-auto p-2 rounded-xl ${solid ? 'text-ink' : 'text-white'}`}
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-line bg-white px-4 py-4 space-y-3">
          <form onSubmit={onSearch} className="flex items-center gap-2 rounded-2xl border border-line bg-paper-2 px-3 py-2.5">
            <Search size={16} className="text-fog" />
            <input value={q} onChange={(e) => setQ(e.target.value)} className="w-full outline-none text-sm" placeholder="Search courses" />
          </form>
          <Link to="/courses" onClick={() => setOpen(false)} className="block py-2 font-semibold">Explore</Link>
          <Link to="/instructors" onClick={() => setOpen(false)} className="block py-2 font-semibold">Instructors</Link>
          {isAuth ? (
            <>
              <Link to={roleHome(user.role)} onClick={() => setOpen(false)} className="block py-2 font-semibold">Dashboard</Link>
              <button onClick={() => { logout(); navigate('/'); }} className="block py-2 font-semibold">Sign out</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setOpen(false)} className="block py-2 font-semibold">Sign in</Link>
              <Link to="/register" onClick={() => setOpen(false)} className="btn-primary w-full">Get started</Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
