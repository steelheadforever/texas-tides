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
  predictions: 6 * 60 * 60, // tide curve / hi-lo — deterministic, refresh occasionally
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
export async function getCached(env, key) {
  const raw = await env.CACHE.get(key, { type: 'json' });
  if (!raw) return null;
  return raw; // { body, cachedAt, expiresAt }
}

// Store a value with a TTL. KV enforces a 60s minimum expiration_ttl.
export async function setCached(env, key, body, ttlSeconds) {
  const now = Date.now();
  const entry = {
    body,
    cachedAt: now,
    expiresAt: now + ttlSeconds * 1000,
  };
  await env.CACHE.put(key, JSON.stringify(entry), {
    expirationTtl: Math.max(60, ttlSeconds),
  });
  return entry;
}
