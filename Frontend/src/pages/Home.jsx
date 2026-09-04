import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Bot, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import CourseCard from '../components/CourseCard';
import api from '../lib/api';

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [trending, setTrending] = useState([]);

  useEffect(() => {
    api.get('/courses/featured/list').then((r) => setFeatured(r.data.courses || [])).catch(() => {});
    api.get('/courses/trending/list').then((r) => setTrending(r.data.courses || [])).catch(() => {});
  }, []);

  return (
    <div className="page-shell">
      <Navbar transparent />

      {/* Full-bleed hero — brand + one line + one sentence + CTAs + hero.png */}
      <section className="relative min-h-[100svh] overflow-hidden -mt-[72px]">
        <div className="absolute inset-0">
          <img
            src="/hero.png"
            alt="Learner studying with LMS Nexus"
            className="h-full w-full object-cover hero-kenburns"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b1c18]/88 via-[#0b1c18]/55 to-[#0b1c18]/15" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1c18]/50 via-transparent to-[#0b1c18]/25" />
        </div>

        <div className="relative mx-auto flex min-h-[100svh] max-w-7xl items-center px-4 pb-16 pt-28 md:px-6 md:pt-24">
          <div className="max-w-2xl text-white">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-6xl font-extrabold leading-[0.92] tracking-tight sm:text-7xl md:text-8xl"
            >
              LMS{' '}
              <span className="bg-gradient-to-r from-cyan via-white to-lime bg-clip-text text-transparent">
                Nexus
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 font-display text-2xl font-semibold leading-snug text-white/95 sm:text-3xl md:text-[2rem]"
            >
              Learn brilliantly. Teach boldly. Grow with AI.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.22 }}
              className="mt-4 max-w-lg text-base leading-relaxed text-white/70 sm:text-lg"
            >
              A colorful multivendor academy where expert instructors publish premium courses and learners advance with intelligent tutoring.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.34 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Link to="/courses" className="btn-primary">
                Explore courses <ArrowRight size={18} />
              </Link>
              <Link to="/register?role=instructor" className="btn-secondary">
                Start teaching
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 md:px-6">
        <div className="mb-10 max-w-2xl">
          <div className="section-kicker">Why Nexus</div>
          <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-5xl">
            Built for serious learning energy
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Sparkles,
              title: 'AI that actually guides',
              desc: 'Personalized recommendations and an in-course tutor that answers when you get stuck.',
              tone: 'from-cyan/20 to-cyan/5 text-cyan-deep',
            },
            {
              icon: Bot,
              title: 'Quizzes in seconds',
              desc: 'Instructors generate sharp assessments from course content with one click.',
              tone: 'from-blue/20 to-blue/5 text-blue',
            },
            {
              icon: ShieldCheck,
              title: 'Quality-first marketplace',
              desc: 'Every listing is reviewed before it goes live — premium content, not noise.',
              tone: 'from-mint/20 to-mint/5 text-mint-deep',
            },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.08, duration: 0.55 }}
              className="relative overflow-hidden rounded-lg border border-line bg-white p-7"
            >
              <div className={`mb-5 inline-flex rounded-2xl bg-gradient-to-br p-3 ${f.tone}`}>
                <f.icon size={24} />
              </div>
              <h3 className="font-display text-2xl font-bold mb-2">{f.title}</h3>
              <p className="text-fog leading-relaxed text-[0.95rem]">{f.desc}</p>
              <div className="pointer-events-none absolute -right-8 -bottom-8 h-28 w-28 rounded-full bg-gradient-to-br from-cyan/10 to-blue/10" />
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="section-kicker">Curated picks</div>
            <h2 className="font-display text-3xl font-extrabold md:text-5xl">Top rated courses</h2>
          </div>
          <Link to="/courses?featured=true" className="inline-flex items-center gap-1.5 text-sm font-bold text-blue hover:text-blue-deep">
            View collection <ArrowRight size={16} />
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
            >
              <CourseCard course={c} />
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 md:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="section-kicker">
              <TrendingUp size={14} /> Rising now
            </div>
            <h2 className="font-display text-3xl font-extrabold md:text-5xl">Trending this week</h2>
          </div>
          <Link to="/courses?trending=true" className="inline-flex items-center gap-1.5 text-sm font-bold text-blue hover:text-blue-deep">
            See all <ArrowRight size={16} />
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {trending.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 md:px-6">
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-ink via-[#16352d] to-[#12324a] px-8 py-14 text-white md:px-14">
          <div className="absolute -right-10 top-0 h-56 w-56 rounded-full bg-cyan/25 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-blue/30 blur-3xl" />
          <div className="relative max-w-2xl">
            <h2 className="font-display text-3xl font-extrabold md:text-5xl leading-tight">
              Ready to publish your expertise?
            </h2>
            <p className="mt-4 text-white/65 text-lg max-w-xl">
              Join the instructor marketplace, ship AI-assisted courses, and earn with every enrollment.
            </p>
            <Link to="/register?role=instructor" className="btn-primary mt-8 !bg-white !text-ink hover:!bg-cyan">
              Become an instructor <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
