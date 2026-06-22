// Open-Meteo weather timeline: current + 12 hourly steps of wind (u/v) and
// precipitation over a Texas-coast lattice. Shared by the wind + radar layers
// and the scrubber. Mirrors the iOS WeatherGridService. Free, keyless.

// Generous lattice so the wind layer fills the whole initial map view, not
// just the coastal band (the initial fit shows Gulf + inland on wide screens).
const LATS = [];
for (let v = 24.0; v <= 31.5 + 1e-9; v += 0.5) LATS.push(+v.toFixed(2));
const LONS = [];
for (let v = -100.5; v <= -90.5 + 1e-9; v += 0.5) LONS.push(+v.toFixed(2));

export const COAST_BOUNDS = {
  minLat: LATS[0], maxLat: LATS[LATS.length - 1],
  minLon: LONS[0], maxLon: LONS[LONS.length - 1],
};

function bilinear(values, lon, lat) {
  const { minLat, maxLat, minLon, maxLon } = COAST_BOUNDS;
  const rows = LATS.length, cols = LONS.length;
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

export function makeWindGrid(u, v) {
  return { u, v, sample(lon, lat) {
    const su = bilinear(u, lon, lat); if (su == null) return null;
    return { u: su, v: bilinear(v, lon, lat) };
  } };
}

export function makePrecipGrid(values) {
  return { values, sample: (lon, lat) => bilinear(values, lon, lat), hasAny: values.some((x) => x >= 0.08) };
}

let cache = null;
let cachedAt = 0;

export async function fetchTimeline() {
  if (cache && Date.now() - cachedAt < 15 * 60 * 1000) return cache;

  const points = [];
  for (const la of LATS) for (const lo of LONS) points.push([la, lo]);
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
  const windGrids = [makeWindGrid(u0, v0)];
  const precipGrids = [makePrecipGrid(new Float32Array(n))];
  const hours = [new Date()];

  for (let s = 1; s < steps; s++) {
    const u = new Float32Array(n), v = new Float32Array(n), p = new Float32Array(n);
    data.forEach((d, idx) => {
      const h = d.hourly;
      if (!h) return;
      const [cu, cv] = comp(h.wind_speed_10m[s] || 0, h.wind_direction_10m[s] || 0);
      u[idx] = cu; v[idx] = cv; p[idx] = h.precipitation[s] || 0;
    });
    windGrids.push(makeWindGrid(u, v));
    precipGrids.push(makePrecipGrid(p));
    hours.push(new Date(data[0].hourly.time[s] + ':00Z'));
  }

  cache = { windGrids, precipGrids, hours, stepCount: windGrids.length };
  cachedAt = Date.now();
  return cache;
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
