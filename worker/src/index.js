// Slackwater API Worker
// Replaces the Raspberry Pi backend: a KV-cached proxy in front of NOAA, NWS
// and USNO, plus a cron warmer that pre-fetches deterministic tide predictions
// for all Texas stations. The app only ever talks to this Worker.

import { cacheKey, canonicalizeNoaa, noaaTtl, TTL, getCached, setCached } from './cache.js';
import { noaaGet, fetchSunMoon, parseSunMoon, fetchPoints } from './upstream.js';
import { forecast12h, pressure, temperature } from './nws.js';
import { STATIONS } from './stations.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, { status = 200, cacheControl } = {}) {
  const headers = { 'Content-Type': 'application/json', ...CORS };
  if (cacheControl) headers['Cache-Control'] = cacheControl;
  return new Response(JSON.stringify(body), { status, headers });
}

// Cached JSON producer. Checks KV, and on a miss runs `produce()` (which returns
// { error } on upstream failure). Successful results are cached; on upstream
// error we serve a stale cached entry if one exists.
async function cached(env, key, ttlSeconds, produce) {
  const hit = await getCached(env, key);
  if (hit && hit.expiresAt > Date.now()) {
    return json(hit.body, { cacheControl: `public, max-age=${Math.floor((hit.expiresAt - Date.now()) / 1000)}` });
  }

  const fresh = await produce();
  if (fresh && !fresh.error) {
    await setCached(env, key, fresh, ttlSeconds);
    return json(fresh, { cacheControl: `public, max-age=${ttlSeconds}` });
  }

  // Upstream failed — fall back to stale if we have it.
  if (hit) return json(hit.body, { cacheControl: 'public, max-age=30' });
  return json(fresh?.error ? { error: fresh.error } : { error: 'Upstream unavailable' }, { status: 502 });
}

function parseLatLon(url) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lon = parseFloat(url.searchParams.get('lon'));
  if (isNaN(lat) || isNaN(lon)) return null;
  return { lat, lon };
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, { status: 405 });

  if (path === '/health' || path === '/') {
    return json({ status: 'ok', service: 'slackwater-api', stations: STATIONS.length, time: new Date().toISOString() });
  }

  // NOAA generic passthrough — /api/noaa/query?station=...&product=...
  if (path === '/api/noaa/query') {
    const raw = Object.fromEntries(url.searchParams.entries());
    if (!raw.station && !raw.product) return json({ error: 'station and product are required' }, { status: 400 });
    // Widen deterministic prediction windows to whole days so the key (and the
    // upstream fetch) is shared across the day instead of rolling every hour.
    const params = canonicalizeNoaa(raw);
    const key = cacheKey('noaa:query', params);
    return cached(env, key, noaaTtl(params), () => noaaGet(params));
  }

  // NWS derived endpoints
  if (path.startsWith('/api/nws/')) {
    const loc = parseLatLon(url);
    if (!loc) return json({ error: 'lat and lon are required' }, { status: 400 });
    const sub = path.slice('/api/nws/'.length);
    const key = cacheKey(`nws:${sub}`, { lat: loc.lat.toFixed(4), lon: loc.lon.toFixed(4) });

    if (sub === 'points') return cached(env, key, TTL.nws, () => fetchPoints(loc.lat, loc.lon));
    if (sub === 'forecast-12h') return wrapDerived(env, key, TTL.nws, () => forecast12h(loc.lat, loc.lon));
    if (sub === 'pressure') return wrapDerived(env, key, TTL.nws, () => pressure(loc.lat, loc.lon));
    if (sub === 'temperature') return wrapDerived(env, key, TTL.nws, () => temperature(loc.lat, loc.lon));
    return json({ error: 'Unknown NWS endpoint' }, { status: 404 });
  }

  // USNO sun/moon — /api/usno/sun-moon?lat=&lon=&date=YYYY-MM-DD
  if (path === '/api/usno/sun-moon') {
    const loc = parseLatLon(url);
    if (!loc) return json({ error: 'lat and lon are required' }, { status: 400 });
    const dateStr = url.searchParams.get('date');
    const date = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(date.getTime())) return json({ error: 'Invalid date. Use YYYY-MM-DD' }, { status: 400 });
    const key = cacheKey('usno:sun-moon', { lat: loc.lat.toFixed(4), lon: loc.lon.toFixed(4), date: dateStr || 'today' });
    return cached(env, key, TTL.usno, async () => {
      const raw = await fetchSunMoon(loc.lat, loc.lon, date);
      if (raw.error) return { error: raw.error };
      const parsed = parseSunMoon(raw);
      return parsed || { error: 'No sun/moon data available' };
    });
  }

  return json({ error: 'Not found' }, { status: 404 });
}

// Derived NWS handlers return { status, body }. Cache only 200s; serve stale on
// non-200 if we have it.
async function wrapDerived(env, key, ttlSeconds, produce) {
  const hit = await getCached(env, key);
  if (hit && hit.expiresAt > Date.now()) return json(hit.body, { cacheControl: `public, max-age=${ttlSeconds}` });

  const res = await produce();
  if (res.status === 200) {
    await setCached(env, key, res.body, ttlSeconds);
    return json(res.body, { cacheControl: `public, max-age=${ttlSeconds}` });
  }
  if (hit) return json(hit.body, { cacheControl: 'public, max-age=30' });
  return json(res.body, { status: res.status });
}

// ---- Cron warmer ---------------------------------------------------------

// Format an absolute instant as NOAA "YYYYMMDD HH:MM" in Central time, so the
// warmer's keys match Texas clients (who send device-local times to NOAA's
// lst_ldt). Minutes are irrelevant — the cache key snaps them to the hour.
function formatCentral(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const o = {};
  for (const p of parts) o[p.type] = p.value;
  const hour = o.hour === '24' ? '00' : o.hour;
  return `${o.year}${o.month}${o.day} ${hour}:${o.minute}`;
}

function centralRange(hoursStart, hoursEnd) {
  const now = Date.now();
  return {
    begin: formatCentral(new Date(now + hoursStart * 3600_000)),
    end: formatCentral(new Date(now + hoursEnd * 3600_000)),
  };
}

// Warm a single NOAA prediction request if it's missing or within 25% of expiry.
// Returns true if it issued an upstream fetch (counts against the budget).
async function warmOne(env, params) {
  // Use the same day-aligned canonical window the request handler uses, so the
  // warmer pre-populates the exact key clients will read.
  const cp = canonicalizeNoaa(params);
  const key = cacheKey('noaa:query', cp);
  const hit = await getCached(env, key);
  const ttl = TTL.predictions;
  const fresh = hit && hit.expiresAt - Date.now() > ttl * 0.25 * 1000;
  if (fresh) return false;

  const data = await noaaGet(cp);
  if (!data.error) await setCached(env, key, data, ttl);
  return true;
}

// Cron entry point. Warms tide curve + hi/lo for prediction stations, capped at
// a per-invocation upstream-fetch budget so it stays under the Workers free-tier
// subrequest limit (50). Stations not reached this tick are picked up next tick.
async function warmPredictions(env) {
  const FETCH_BUDGET = parseInt(env.WARM_FETCH_BUDGET || '40');
  const curve = centralRange(-6, 24);
  const hilo = centralRange(0, 24);
  let fetches = 0;
  let warmed = 0;

  // The web frontend sends units + time_zone as query params, so they're part
  // of the cache key. Include them here so warmed keys match client keys.
  // (application/format are stripped from the key, so they don't matter.)
  const base = { units: 'english', time_zone: 'lst_ldt', datum: 'MLLW' };

  for (const s of STATIONS) {
    if (!s.hasPredictions) continue;
    if (fetches >= FETCH_BUDGET) break;

    const curveParams = { ...base, station: s.id, product: 'predictions', begin_date: curve.begin, end_date: curve.end, interval: '6' };
    if (await warmOne(env, curveParams)) fetches++;
    if (fetches >= FETCH_BUDGET) break;

    const hiloParams = { ...base, station: s.id, product: 'predictions', begin_date: hilo.begin, end_date: hilo.end, interval: 'hilo' };
    if (await warmOne(env, hiloParams)) fetches++;
    warmed++;
  }
  console.log(`[warm] stations touched=${warmed} upstream_fetches=${fetches}`);
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (err) {
      return json({ error: err.message || 'Internal error' }, { status: 500 });
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(warmPredictions(env));
  },
};
