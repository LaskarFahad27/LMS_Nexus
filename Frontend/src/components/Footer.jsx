import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-line bg-ink text-white">
      <div className="absolute -left-20 top-0 h-64 w-64 rounded-full bg-cyan/20 blur-3xl" />
      <div className="absolute right-0 bottom-0 h-64 w-64 rounded-full bg-blue/20 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 py-16 md:px-6 grid gap-12 md:grid-cols-4">
        <div className="md:col-span-2 space-y-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan to-blue">
              <Zap size={18} fill="white" />
            </span>
            <span className="font-display text-2xl font-extrabold">
              LMS <span className="text-cyan">Nexus</span>
            </span>
          </div>
          <p className="max-w-md text-white/55 text-sm leading-relaxed">
            The colorful, AI-enabled multivendor learning platform for creators who teach and learners who ship skills.
          </p>
        </div>

        <div>
          <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-cyan mb-4">Platform</div>
          <div className="space-y-2.5 text-sm text-white/60">
            <Link to="/courses" className="block hover:text-white transition">Browse courses</Link>
            <Link to="/register?role=instructor" className="block hover:text-white transition">Teach on Nexus</Link>
            <Link to="/register" className="block hover:text-white transition">Create account</Link>
          </div>
        </div>

        <div>
          <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-mint mb-4">Demo access</div>
          <div className="space-y-2 text-sm text-white/55">
            <div>admin@lmsnexus.com</div>
            <div>aria@lmsnexus.com</div>
            <div>student@lmsnexus.com</div>
            <div className="pt-2 text-white/35">Password · Root@1234</div>
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10 py-5 text-center text-xs text-white/35">
        © {new Date().getFullYear()} LMS Nexus · Designed for ambitious learning
      </div>
    </footer>
  );
}
