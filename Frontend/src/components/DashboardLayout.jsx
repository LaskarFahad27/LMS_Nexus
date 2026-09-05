import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
  ShoppingBag,
  Users,
  Wallet,
  PlusCircle,
  Heart,
  MessageSquare,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const menus = {
  student: [
    { to: '/student', icon: LayoutDashboard, label: 'Overview', end: true },
    { to: '/student/courses', icon: BookOpen, label: 'My courses' },
    { to: '/student/wishlist', icon: Heart, label: 'Wishlist' },
    { to: '/student/purchases', icon: ShoppingBag, label: 'Purchases' },
    { to: '/student/quizzes', icon: GraduationCap, label: 'Quiz scores' },
    { to: '/student/profile', icon: Settings, label: 'Profile' },
  ],
  instructor: [
    { to: '/instructor', icon: LayoutDashboard, label: 'Overview', end: true },
    { to: '/instructor/courses', icon: BookOpen, label: 'My courses' },
    { to: '/instructor/create', icon: PlusCircle, label: 'Create course' },
    { to: '/instructor/earnings', icon: Wallet, label: 'Earnings' },
    { to: '/instructor/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/instructor/messages', icon: MessageSquare, label: 'Messages' },
    { to: '/instructor/profile', icon: Settings, label: 'Profile' },
  ],
  admin: [
    { to: '/admin', icon: LayoutDashboard, label: 'Overview', end: true },
    { to: '/admin/courses', icon: BookOpen, label: 'Courses' },
    { to: '/admin/users', icon: Users, label: 'Users' },
    { to: '/admin/payments', icon: Wallet, label: 'Payments' },
    { to: '/admin/categories', icon: GraduationCap, label: 'Categories' },
    { to: '/admin/announcements', icon: Bell, label: 'Announcements' },
    { to: '/admin/reports', icon: BarChart3, label: 'Reports' },
    { to: '/admin/settings', icon: Settings, label: 'Settings' },
  ],
};

const roleAccent = {
  student: 'from-cyan to-blue',
  instructor: 'from-mint to-cyan',
  admin: 'from-blue to-violet-soft',
};

export default function DashboardLayout({ role }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = menus[role] || [];

  return (
    <div className="min-h-screen dash-shell">
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-line bg-ink text-white">
        <Link to="/" className="px-5 py-6 flex items-center gap-2.5">
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${roleAccent[role]}`}>
            <Zap size={16} fill="white" />
          </span>
          <span className="font-display text-lg font-extrabold">LMS Nexus</span>
        </Link>
        <nav className="flex-1 px-3 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan/25 to-blue/20 text-white'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => {
            logout();
            navigate('/');
          }}
          className="m-3 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-white/55 hover:bg-white/5"
        >
          <LogOut size={18} /> Sign out
        </button>
      </aside>

      <div className="min-w-0 md:ml-64">
        <header className="sticky top-0 z-20 border-b border-line bg-white/75 backdrop-blur-xl px-4 md:px-8 py-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan-deep">{role} studio</div>
            <div className="font-display text-xl font-bold">Hello, {user?.name?.split(' ')[0]}</div>
          </div>
          <Link to="/courses" className="btn-primary !py-2 !px-4 !text-sm">
            Marketplace
          </Link>
        </header>
        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
