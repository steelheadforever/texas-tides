// KV-backed cache layer for the Slackwater Worker.
//
// Two ideas make warming and lazy reads share the same keys:
//   1. We strip volatile/irrelevant params (application, format) from the key.
//   2. We snap NOAA begin_date/end_date down to the hour for the key only
//      (the real, minute-precise dates are still sent upstream on a miss).
//      Tide data over a multi-hour window is identical whether a client asks
//      at 14:03 or 14:00, so every client within a clock-hour collapses onto
//      one cached entry — and a cron warmer running any time in that hour
//      produces the same key.

const KEY_IGNORE = new Set(['application', 'format']);

// Snap a NOAA date string "YYYYMMDD HH:MM" down to "YYYYMMDD HH:00".
function snapHour(value) {
  const m = /^(\d{8})\s+(\d{2}):\d{2}$/.exec(value);
  return m ? `${m[1]} ${m[2]}:00` : value;
}

// Snap a NOAA "YYYYMMDD HH:MM" date to a whole day. dir 'floor' → 00:00 of that
// day; 'ceil' → 00:00 of the next day (unless already at midnight). The wall-clock
// string is treated as UTC purely for calendar arithmetic — we only move the date
// part, never convert zones — so a Central-local string stays Central-local.
function snapDay(value, dir) {
  const m = /^(\d{4})(\d{2})(\d{2})\s+(\d{2}):(\d{2})$/.exec(value);
  if (!m) return value;
  const [, y, mo, d, hh, mm] = m;
  let ms = Date.UTC(+y, +mo - 1, +d, 0, 0);
  if (dir === 'ceil' && (hh !== '00' || mm !== '00')) ms += 24 * 3600 * 1000;
  const out = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${out.getUTCFullYear()}${p(out.getUTCMonth() + 1)}${p(out.getUTCDate())} 00:00`;
}

// Tide predictions are deterministic, so we widen any predictions request to
// whole days for BOTH the cache key and the upstream fetch. Clients (and the
// warmer) send now-relative windows that previously rolled to a fresh key every
// clock-hour — minting 2 writes/station/hour and blowing past the KV daily write
// cap. Snapping to day boundaries collapses all of an day's requests onto ~one
// shared key. Clients get a slightly wider window and clip it to what they render.
// Non-prediction (live/observed) data must stay fresh and narrow, so it's untouched.
export function canonicalizeNoaa(params) {
  if (params.product !== 'predictions') return params;
  const out = { ...params };
  if (out.begin_date) out.begin_date = snapDay(String(out.begin_date), 'floor');
  if (out.end_date) out.end_date = snapDay(String(out.end_date), 'ceil');
  return out;
}

// Build a stable cache key from an endpoint label + params object.
export function cacheKey(endpoint, params = {}) {
  const parts = [];
  for (const k of Object.keys(params).sort()) {
    if (KEY_IGNORE.has(k)) continue;
    let v = params[k];
    if (v === null || v === undefined) continue;
    if (k === 'begin_date' || k === 'end_date') v = snapHour(String(v));
    parts.push(`${k}=${v}`);
  }
  return `${endpoint}:${parts.join('&')}`;
}

// TTL (seconds) per logical data type. Deterministic predictions live long;
// live observations stay short so the app sees fresh conditions.
export const TTL = {
  predictions: 24 * 60 * 60, // tide curve / hi-lo — deterministic astronomical data.
                             // The day-aligned cache key already forces a fresh fetch
                             // each new day, so a long TTL costs no freshness; it only
                             // stops pointless intra-day rewrites (6h TTL + 25%-early
                             // rewarm was minting ~5 writes/key/day → ~496/day; 24h ≈ 192/day).
  live: 6 * 60,             // latest water level / wind / temp
  observed: 10 * 60,        // recent observed water-level / temp history
  nws: 15 * 60,             // weather forecast / pressure / air temp
  usno: 12 * 60 * 60,       // sun/moon for a given day
};

// Classify a NOAA /query request into a TTL bucket from its params.
export function noaaTtl(params) {
  const product = params.product;
  if (product === 'predictions') return TTL.predictions;
  if (params.date === 'latest') return TTL.live;
  return TTL.observed;
}

// Read a cached entry. Returns the parsed body or null on miss/expiry.
// KV TTL handles expiry, but we also store expires_at so the warmer can do
// write-on-near-expiry and so we can serve stale-on-error if upstream fails.
// Best-effort: a KV failure reads as a miss, never an error.
export async function getCached(env, key) {
  try {
    const raw = await env.CACHE.get(key, { type: 'json' });
    if (!raw) return null;
    return raw; // { body, cachedAt, expiresAt }
  } catch (err) {
    console.warn(`[cache] read failed for ${key}: ${err.message}`);
    return null;
  }
}

// Store a value with a TTL. KV enforces a 60s minimum expiration_ttl.
// Best-effort: caching is an optimization — a failed write (e.g. the KV
// daily write cap) must never fail a request that has data in hand.
export async function setCached(env, key, body, ttlSeconds) {
  const now = Date.now();
  const entry = {
    body,
    cachedAt: now,
    expiresAt: now + ttlSeconds * 1000,
  };
  try {
    await env.CACHE.put(key, JSON.stringify(entry), {
      expirationTtl: Math.max(60, ttlSeconds),
    });
  } catch (err) {
    console.warn(`[cache] write failed for ${key}: ${err.message}`);
  }
  return entry;
}
