// Display formatting + Phosphor icon mapping (mirrors the iOS Format/Theme).
// Times render in the selected station's timezone (see setDisplayTz).

// Display timezone — set from the selected station's IANA tz (the catalog's
// `tz` field) whenever a station opens. Defaults to Central so stations
// without a tz (the legacy Texas list) render exactly as before.
const DEFAULT_TZ = 'America/Chicago';
let displayTz = DEFAULT_TZ;

export function setDisplayTz(tz) {
  displayTz = tz || DEFAULT_TZ;
}

export function getDisplayTz() {
  return displayTz;
}

export function fmtTime(date, tz) {
  if (!(date instanceof Date) || isNaN(date)) return '—';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz || displayTz });
}

export function fmtHour(date, tz) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true, timeZone: tz || displayTz });
}

export function fmtDay(date, tz) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz || displayTz });
}

// YYYY-MM-DD key for a Date in a station's timezone — for bucketing tide
// events and forecast rows into station-local calendar days.
export function dayKey(date, tz) {
  return date.toLocaleDateString('en-CA', { timeZone: tz || displayTz });
}

// UTC offset (hours) of `tz` at `date`, via Intl so DST and the odd zones
// (Adak, Puerto Rico, Guam) come out right without a zone table.
export function tzOffsetHours(date, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz || displayTz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const o = {};
  for (const p of parts) o[p.type] = p.value;
  const wallUTC = Date.UTC(+o.year, o.month - 1, +o.day, o.hour === '24' ? 0 : +o.hour, +o.minute, +o.second);
  // Sub-second remainder would leak into the offset — Intl only reports whole
  // seconds — so compare against the date floored to the second.
  return (wallUTC - Math.floor(date.getTime() / 1000) * 1000) / 3600000;
}

// Absolute instant of local midnight starting calendar day (y, mo, d) in `tz`.
// Probes the zone's offset near local noon, so a DST jump at 2am doesn't skew
// which day the midnight lands on. Day overflow (d = 32, …) is fine — Date.UTC
// normalizes it.
export function tzMidnight(y, mo, d, tz) {
  const probe = new Date(Date.UTC(y, mo, d, 12));
  const off = tzOffsetHours(probe, tz);
  return new Date(Date.UTC(y, mo, d) - off * 3600000);
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
