import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import CourseCard from '../components/CourseCard';
import api from '../lib/api';

export default function Courses() {
  const [params, setParams] = useSearchParams();
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: params.get('search') || '',
    category: params.get('category') || '',
    minPrice: '',
    maxPrice: '',
    level: '',
    sort: 'newest',
    featured: params.get('featured') || '',
    trending: params.get('trending') || '',
  });

  useEffect(() => {
    api.get('/categories').then((r) => setCategories(r.data.categories || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) q.set(k, v);
    });
    api
      .get(`/courses?${q.toString()}`)
      .then((r) => setCourses(r.data.courses || []))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, [filters]);

  const update = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    if (key === 'search' || key === 'category') {
      const next = new URLSearchParams(params);
      if (value) next.set(key, value);
      else next.delete(key);
      setParams(next);
    }
  };

  return (
    <div className="page-shell">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-12">
        <div className="mb-10 max-w-2xl">
          <div className="section-kicker">Marketplace</div>
          <h1 className="font-display text-4xl font-extrabold md:text-6xl tracking-tight">Explore courses</h1>
          <p className="mt-3 text-fog text-lg">Filter by craft, price, and level — find the skill that moves you forward.</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4 rounded-lg border border-line bg-white p-6 h-fit sticky top-24">
            <Filter label="Search">
              <input
                value={filters.search}
                onChange={(e) => update('search', e.target.value)}
                className="input-field"
                placeholder="Keywords..."
              />
            </Filter>
            <Filter label="Category">
              <select value={filters.category} onChange={(e) => update('category', e.target.value)} className="input-field">
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </Filter>
            <div className="grid grid-cols-2 gap-2">
              <Filter label="Min ৳">
                <input type="number" value={filters.minPrice} onChange={(e) => update('minPrice', e.target.value)} className="input-field" />
              </Filter>
              <Filter label="Max ৳">
                <input type="number" value={filters.maxPrice} onChange={(e) => update('maxPrice', e.target.value)} className="input-field" />
              </Filter>
            </div>
            <Filter label="Level">
              <select value={filters.level} onChange={(e) => update('level', e.target.value)} className="input-field">
                <option value="">Any</option>
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </Filter>
            <Filter label="Sort">
              <select value={filters.sort} onChange={(e) => update('sort', e.target.value)} className="input-field">
                <option value="newest">Newest</option>
                <option value="popular">Most popular</option>
                <option value="rating">Top rated</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
              </select>
            </Filter>
          </aside>

          <div>
            {loading ? (
              <div className="py-24 text-center text-fog">Loading courses...</div>
            ) : courses.length === 0 ? (
              <div className="py-24 text-center text-fog">No courses matched your filters.</div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {courses.map((c) => (
                  <CourseCard key={c.id} course={c} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function Filter({ label, children }) {
  return (
    <div>
      <label className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-fog">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
