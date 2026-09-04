import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { coursePath, formatMoney, formatPrice } from '../lib/utils';

const accents = [
  'from-cyan/90 to-blue/80',
  'from-mint/90 to-cyan/80',
  'from-blue/90 to-violet-soft/80',
  'from-sun/90 to-coral/80',
];

export default function CourseCard({ course }) {
  const price = formatPrice(course.price, course.discount_price);
  const accent = accents[(course.title?.length || 0) % accents.length];

  return (
    <Link to={coursePath(course)} className="course-tile group">
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={course.thumbnail_url || '/hero.png'}
          alt={course.title}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
        />
        <div className={`absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t ${accent} opacity-40 mix-blend-multiply`} />
        <div className="absolute left-3 top-3 flex gap-2">
          {course.category_name && (
            <span className="chip bg-white/90 text-ink backdrop-blur-sm">{course.category_name}</span>
          )}
        </div>
        <div className="absolute right-3 top-3 chip bg-ink/80 text-white backdrop-blur-sm">
          <Star size={11} className="fill-sun text-sun" />
          {Number(course.average_rating || 0).toFixed(1)}
        </div>
      </div>

      <div className="space-y-3 p-5">
        <h3 className="font-display text-[1.2rem] font-bold leading-snug line-clamp-2 group-hover:text-cyan-deep transition-colors">
          {course.title}
        </h3>
        <p className="text-sm text-fog line-clamp-2 leading-relaxed">
          {course.short_description || course.description}
        </p>
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-line">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan to-blue text-xs font-bold text-white">
              {(course.instructor_name || 'I')[0]}
            </div>
            <span className="truncate text-sm font-medium text-ink/75">{course.instructor_name}</span>
          </div>
          <div className="text-right shrink-0">
            <div className="font-extrabold text-ink">{price.label}</div>
            {price.original != null && (
              <div className="text-xs text-fog line-through">{formatMoney(price.original)}</div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
