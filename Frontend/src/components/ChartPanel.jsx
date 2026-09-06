export default function ChartPanel({ title, subtitle, children, className = '' }) {
  return (
    <div className={`rounded-lg border border-line bg-white p-5 ${className}`}>
      <div className="mb-4">
        <div className="font-display text-lg font-bold">{title}</div>
        {subtitle && <div className="text-xs text-fog mt-0.5">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

export function MetricCard({ label, value, hint, tone = 'from-cyan/15 to-blue/10' }) {
  return (
    <div className={`rounded-lg border border-line bg-gradient-to-br ${tone} p-5`}>
      <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-fog mb-1">{label}</div>
      <div className="font-display text-3xl font-extrabold">{value}</div>
      {hint && <div className="text-xs text-fog mt-1">{hint}</div>}
    </div>
  );
}

export const CHART = {
  cyan: '#00c2d4',
  blue: '#2f6bff',
  mint: '#14b8a6',
  sun: '#ffb020',
  coral: '#ff5a4f',
  violet: '#6d5efc',
  ink: '#14201b',
  grid: 'rgba(20,32,27,0.08)',
};

export const shortTitle = (title = '', n = 16) =>
  title.length > n ? `${title.slice(0, n)}…` : title;
