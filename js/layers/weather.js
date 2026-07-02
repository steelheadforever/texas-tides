// Open-Meteo weather timeline: current + 12 hourly steps of wind (u/v) and
// precipitation over a lattice covering the current map viewport. Shared by
// the wind + radar layers and the scrubber. Mirrors the iOS WeatherGridService
// (which is Texas-boxed; here the lattice follows the map). Free, keyless.

// Lattice sizing: pad the viewport ~20% per side, then pick the finest step
// from the ladder that keeps the grid within ~350 points per request — city
// zoom gets a fine 0.25° grid, continental zoom a coarse multi-degree one.
// Edges snap outward to step multiples so small pans hit the same cached region.
const STEPS = [0.25, 0.5, 1, 2, 4, 8, 16];
const MAX_POINTS = 350;
const PAD = 0.2;          // fraction of viewport span added to each side
const TTL_MS = 15 * 60 * 1000;

// Fallback when no viewport is available yet (the legacy Texas-coast box).
const DEFAULT_VIEW = { minLat: 24.0, maxLat: 31.5, minLon: -100.5, maxLon: -90.5 };

function latticeFor(view) {
  const latSpan = Math.max(view.maxLat - view.minLat, 0.5);
  const lonSpan = Math.max(view.maxLon - view.minLon, 0.5);
  const minLat = Math.max(view.minLat - latSpan * PAD, -85);
  const maxLat = Math.min(view.maxLat + latSpan * PAD, 85);
  const minLon = Math.max(view.minLon - lonSpan * PAD, -180);
  const maxLon = Math.min(view.maxLon + lonSpan * PAD, 180);

  for (let idx = 0; ; idx++) {
    const step = STEPS[Math.min(idx, STEPS.length - 1)];
    const lats = axis(minLat, maxLat, step, -85, 85);
    const lons = axis(minLon, maxLon, step, -180, 180);
    if (lats.length * lons.length <= MAX_POINTS || idx >= STEPS.length - 1) {
      return { step, lats, lons };
    }
  }
}

// Snap [lo, hi] outward to step multiples (stable cache keys across small
// pans) and emit the inclusive coordinate list.
function axis(lo, hi, step, clampLo, clampHi) {
  let a = Math.max(Math.floor(lo / step) * step, clampLo);
  let b = Math.min(Math.ceil(hi / step) * step, clampHi);
  if (b - a < step * 2) { a = Math.max(a - step, clampLo); b = Math.min(b + step, clampHi); }
  const out = [];
  for (let v = a; v <= b + 1e-9; v += step) out.push(+v.toFixed(2));
  return out;
}

function bilinear(values, ext, lon, lat) {
  const { minLat, maxLat, minLon, maxLon, rows, cols } = ext;
  if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) return null;
  const colF = (lon - minLon) / (maxLon - minLon) * (cols - 1);
  const rowF = (lat - minLat) / (maxLat - minLat) * (rows - 1);
  const c0 = Math.min(Math.floor(colF), cols - 2);
  const r0 = Math.min(Math.floor(rowF), rows - 2);
  const cx = colF - c0, rx = rowF - r0;
  const i = (r, c) => values[r * cols + c];
  return i(r0, c0) * (1 - cx) * (1 - rx) + i(r0, c0 + 1) * cx * (1 - rx)
    + i(r0 + 1, c0) * (1 - cx) * rx + i(r0 + 1, c0 + 1) * cx * rx;
}

// Grids carry their own geographic extent (`ext`) so consumers keep working
// when the fetched region changes between viewport moves.
export function makeWindGrid(u, v, ext) {
  return { u, v, ext, sample(lon, lat) {
    const su = bilinear(u, ext, lon, lat); if (su == null) return null;
    return { u: su, v: bilinear(v, ext, lon, lat) };
  } };
}

export function makePrecipGrid(values, ext) {
  return { values, ext, sample: (lon, lat) => bilinear(values, ext, lon, lat), hasAny: values.some((x) => x >= 0.08) };
}

let cache = null;      // { key, step, bounds, timeline }
let cachedAt = 0;
let inflight = null;
let inflightKey = null;
let seq = 0;

const covers = (b, v) => v.minLat >= b.minLat - 1e-6 && v.maxLat <= b.maxLat + 1e-6
  && v.minLon >= b.minLon - 1e-6 && v.maxLon <= b.maxLon + 1e-6;

// Viewport-aware fetch. Reuses the cached timeline while it is fresh (<15 min),
// the viewport is still inside the fetched region, and zoom hasn't crossed a
// step-change threshold. Dedups concurrent callers (wind + radar may both
// request at once) and retries once on a transient failure, so the wind layer
// reliably gets its grid instead of silently staying blank.
export async function fetchTimeline(view) {
  const v = view || DEFAULT_VIEW;
  const { step, lats, lons } = latticeFor(v);
  const key = `${step}|${lats[0]},${lats[lats.length - 1]}|${lons[0]},${lons[lons.length - 1]}`;
  if (cache && Date.now() - cachedAt < TTL_MS
    && (cache.key === key || (cache.step === step && covers(cache.bounds, v)))) {
    return cache.timeline;
  }
  if (inflight && inflightKey === key) return inflight;

  const mySeq = ++seq;
  inflightKey = key;
  inflight = (async () => {
    let lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      try { return await buildTimeline(lats, lons); }
      catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 800)); }
    }
    throw lastErr;
  })();
  try {
    const timeline = await inflight;
    if (mySeq === seq) {  // a stale response must not clobber a newer fetch
      cache = { key, step, bounds: timeline.bounds, timeline };
      cachedAt = Date.now();
    }
    return timeline;
  } finally {
    if (inflightKey === key) { inflight = null; inflightKey = null; }
  }
}

async function buildTimeline(lats, lons) {
  const points = [];
  for (const la of lats) for (const lo of lons) points.push([la, lo]);
  const ext = {
    minLat: lats[0], maxLat: lats[lats.length - 1],
    minLon: lons[0], maxLon: lons[lons.length - 1],
    rows: lats.length, cols: lons.length,
  };
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', points.map((p) => p[0]).join(','));
  url.searchParams.set('longitude', points.map((p) => p[1]).join(','));
  url.searchParams.set('current', 'wind_speed_10m,wind_direction_10m');
  url.searchParams.set('hourly', 'wind_speed_10m,wind_direction_10m,precipitation');
  url.searchParams.set('forecast_hours', '13');
  url.searchParams.set('wind_speed_unit', 'ms');
  url.searchParams.set('timezone', 'UTC');

  const res = await fetch(url);
  const data = await res.json();
  if (!Array.isArray(data) || data.length !== points.length) throw new Error('Wind grid size mismatch');

  const n = points.length;
  const comp = (speed, dir) => { const r = (dir || 0) * Math.PI / 180; return [-speed * Math.sin(r), -speed * Math.cos(r)]; };

  // Hour 0 = current conditions.
  const u0 = new Float32Array(n), v0 = new Float32Array(n);
  data.forEach((d, idx) => {
    const [u, v] = comp(d.current?.wind_speed_10m || 0, d.current?.wind_direction_10m || 0);
    u0[idx] = u; v0[idx] = v;
  });

  const steps = data[0]?.hourly?.time?.length || 0;
  const windGrids = [makeWindGrid(u0, v0, ext)];
  const precipGrids = [makePrecipGrid(new Float32Array(n), ext)];
  const hours = [new Date()];

  for (let s = 1; s < steps; s++) {
    const u = new Float32Array(n), v = new Float32Array(n), p = new Float32Array(n);
    data.forEach((d, idx) => {
      const h = d.hourly;
      if (!h) return;
      const [cu, cv] = comp(h.wind_speed_10m[s] || 0, h.wind_direction_10m[s] || 0);
      u[idx] = cu; v[idx] = cv; p[idx] = h.precipitation[s] || 0;
    });
    windGrids.push(makeWindGrid(u, v, ext));
    precipGrids.push(makePrecipGrid(p, ext));
    hours.push(new Date(data[0].hourly.time[s] + ':00Z'));
  }

  return { windGrids, precipGrids, hours, stepCount: windGrids.length, bounds: ext };
}

// Shared color ramps (match iOS Theme).
export function windColor(speed) {
  if (speed < 3) return 'rgba(120,170,255,ALPHA)';
  if (speed < 8) return 'rgba(100,220,200,ALPHA)';
  if (speed < 15) return 'rgba(140,255,140,ALPHA)';
  if (speed < 22) return 'rgba(255,240,80,ALPHA)';
  if (speed < 30) return 'rgba(255,160,50,ALPHA)';
  return 'rgba(255,80,80,ALPHA)';
}

export function precipColor(mm) {
  if (mm < 0.08) return null;
  if (mm < 0.5) return [140, 212, 237, 0.45];
  if (mm < 1.5) return [51, 140, 242, 0.55];
  if (mm < 4) return [13, 77, 217, 0.62];
  if (mm < 8) return [255, 230, 51, 0.65];
  if (mm < 16) return [255, 140, 26, 0.70];
  return [242, 38, 38, 0.75];
}
