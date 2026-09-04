export const formatMoney = (amount) => {
  const n = Number(amount || 0);
  return `৳${n.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatPrice = (price, discountPrice) => {
  const p = Number(price || 0);
  const d = discountPrice != null ? Number(discountPrice) : null;
  if (p === 0) return { label: 'Free', current: 0, original: null };
  if (d != null && d < p) {
    return { label: formatMoney(d), current: d, original: p };
  }
  return { label: formatMoney(p), current: p, original: null };
};

export const roleHome = (role) => {
  if (role === 'admin') return '/admin';
  if (role === 'instructor') return '/instructor';
  return '/student';
};

export const cn = (...classes) => classes.filter(Boolean).join(' ');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const courseKey = (course) => {
  const slug = String(course?.slug || '').trim();
  if (slug && slug !== '-' && !/^-+/.test(slug)) return slug;
  return course?.id || '';
};

export const coursePath = (course) => {
  const key = courseKey(course);
  return key ? `/courses/${key}` : '/courses';
};

export const learnPath = (course, suffix = '') => {
  const key = courseKey(course) || course?.slug || course?.id || '';
  if (!key) return '/courses';
  return suffix ? `/learn/${key}/${suffix}` : `/learn/${key}`;
};

export const isCourseUuid = (value) => UUID_RE.test(String(value || ''));
