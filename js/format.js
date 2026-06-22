// Display formatting + Phosphor icon mapping (mirrors the iOS Format/Theme).
// Times render in Central — every Texas station lives there.

const CENTRAL = 'America/Chicago';

export function fmtTime(date) {
  if (!(date instanceof Date) || isNaN(date)) return '—';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: CENTRAL });
}

export function fmtHour(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true, timeZone: CENTRAL });
}

export function fmtDay(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: CENTRAL });
}

export function fmtFeet(v) {
  return (v == null || isNaN(v)) ? '—' : `${v.toFixed(2)} ft`;
}

export function fmtDegrees(v) {
  return (v == null || isNaN(v)) ? '—' : `${v.toFixed(1)}°F`;
}

// Wind speed comes from NOAA/NWS in mph; format per unit preference.
export function fmtWind(mph, unit) {
  if (mph == null || isNaN(mph)) return '—';
  return unit === 'knots' ? `${Math.round(mph / 1.15078)} kn` : `${Math.round(mph)} mph`;
}

export function knotsToMph(kn) {
  return kn == null ? null : kn * 1.15078;
}

// NWS short-forecast string → Phosphor icon + CSS color var.
export function conditionIcon(condition) {
  const c = (condition || '').toLowerCase();
  if (c.includes('fog') || c.includes('haze')) return { icon: 'ph-fill ph-cloud-fog', color: 'var(--text-secondary)' };
  if (c.includes('thunder') || c.includes('storm')) return { icon: 'ph-fill ph-cloud-lightning', color: 'var(--pressure)' };
  if (c.includes('snow') || c.includes('sleet')) return { icon: 'ph-fill ph-cloud-snow', color: 'var(--low)' };
  if (c.includes('drizzle')) return { icon: 'ph-fill ph-cloud-rain', color: 'var(--wind)' };
  if (c.includes('shower') || c.includes('rain')) return { icon: 'ph-fill ph-cloud-rain', color: 'var(--wind)' };
  if (c.includes('mostly cloudy') || c.includes('overcast')) return { icon: 'ph-fill ph-cloud', color: 'var(--text-secondary)' };
  if (c.includes('partly')) return { icon: 'ph-fill ph-cloud-sun', color: 'var(--sun)' };
  if (c.includes('cloud')) return { icon: 'ph-fill ph-cloud', color: 'var(--text-secondary)' };
  if (c.includes('sunny') || c.includes('clear')) return { icon: 'ph-fill ph-sun', color: 'var(--sun)' };
  if (c.includes('wind') || c.includes('breezy')) return { icon: 'ph ph-wind', color: 'var(--wind)' };
  return { icon: 'ph-fill ph-cloud-sun', color: 'var(--sun)' };
}

// Tide trend → icon + class (matches iOS rising green / falling orange).
export function trendIcon(trend) {
  switch (trend) {
    case 'rising': return { icon: 'ph-bold ph-arrow-up-right', cls: 'trend-rising', label: 'Rising' };
    case 'falling': return { icon: 'ph-bold ph-arrow-down-right', cls: 'trend-falling', label: 'Falling' };
    case 'steady': return { icon: 'ph-bold ph-arrow-right', cls: '', label: 'Steady' };
    default: return { icon: 'ph-bold ph-minus', cls: '', label: '—' };
  }
}

export function pressureTrendIcon(trend) {
  if (trend === 'rising') return 'ph-bold ph-arrow-up-right';
  if (trend === 'falling') return 'ph-bold ph-arrow-down-right';
  return 'ph-bold ph-arrow-right';
}

// Moon phase label → Phosphor (Phosphor lacks 8 phases; pair with % + name).
export function moonIcon(phase) {
  const p = (phase || '').toLowerCase();
  if (p.includes('new')) return 'ph ph-moon';
  return 'ph-fill ph-moon-stars';
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}
