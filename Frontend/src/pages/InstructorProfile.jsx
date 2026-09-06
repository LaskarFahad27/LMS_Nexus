import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import CourseCard from '../components/CourseCard';
import api from '../lib/api';

export default function InstructorProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/users/instructors/${id}`).then((r) => setData(r.data)).catch(() => {});
  }, [id]);

  if (!data?.instructor) {
    return (
      <div className="page-shell">
        <Navbar />
        <div className="py-24 text-center text-fog">Loading instructor...</div>
      </div>
    );
  }

  const { instructor, courses, stats } = data;

  return (
    <div className="page-shell">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-12">
        <div className="rounded-lg border border-line bg-white p-8 mb-10 flex flex-wrap gap-6 items-start overflow-hidden relative">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cyan/15 blur-2xl" />
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan to-blue text-white font-display text-3xl font-extrabold relative">
            {instructor.name[0]}
          </div>
          <div className="flex-1 min-w-0 relative">
            <h1 className="font-display text-4xl font-extrabold mb-2">{instructor.name}</h1>
            <p className="text-cyan-deep font-semibold mb-3">{instructor.headline}</p>
            <p className="text-fog max-w-2xl leading-relaxed">{instructor.bio}</p>
            <div className="flex gap-6 mt-4 text-sm font-semibold">
              <span>{stats.courses} courses</span>
              <span>{stats.students} students</span>
              <span>{Number(stats.rating).toFixed(1)} avg rating</span>
            </div>
          </div>
        </div>
        <h2 className="font-display text-2xl font-bold mb-6">Courses by {instructor.name.split(' ')[0]}</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <CourseCard key={c.id} course={{ ...c, instructor_name: instructor.name }} />
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}

export function InstructorsList() {
  const [courses, setCourses] = useState([]);
  useEffect(() => {
    api.get('/courses?limit=50').then((r) => setCourses(r.data.courses || []));
  }, []);

  const map = new Map();
  courses.forEach((c) => {
    if (!map.has(c.instructor_id)) {
      map.set(c.instructor_id, {
        id: c.instructor_id,
        name: c.instructor_name,
        headline: c.instructor_headline,
        avatar: c.instructor_avatar,
        courses: 0,
      });
    }
    map.get(c.instructor_id).courses += 1;
  });

  const instructors = [...map.values()];

  return (
    <div className="page-shell">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-12">
        <div className="section-kicker">Mentors</div>
        <h1 className="font-display text-4xl font-extrabold md:text-6xl mb-8">Instructors</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {instructors.map((i) => (
            <Link
              key={i.id}
              to={`/instructors/${i.id}`}
              className="rounded-lg border border-line bg-white p-6 hover:border-cyan/40 transition"
            >
              <div className="font-display text-xl font-bold mb-1">{i.name}</div>
              <div className="text-sm text-fog mb-3">{i.headline || 'Instructor'}</div>
              <div className="text-xs text-cyan-deep font-extrabold uppercase tracking-wider">
                {i.courses} courses
              </div>
            </Link>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
