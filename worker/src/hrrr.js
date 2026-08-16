// HRRR "future radar" proxy — run discovery + tile passthrough for the Iowa
// Environmental Mesonet's HRRR simulated-reflectivity tile service.
//
// IEM has no machine-readable "latest run" endpoint; the tile server answers
// 200 for a processed run and 503 for one it doesn't have, so discovery is a
// short newest-first probe walk. Centralizing it here (KV-cached) means all
// clients share a handful of probe requests per TTL instead of each device
// probing on its own.
//
// Tiles proxy through with Cloudflare edge caching (cacheEverything): a layer
// path pins both the run init time and the forecast minute, so a tile is
// immutable for the life of the cache and every user panning the same area
// shares one IEM fetch. KV is deliberately not used for tiles — binary blobs
// at tile volume belong in the HTTP cache, not the KV quota.

const IEM_TILE_BASE = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0';
const TIMEOUT_MS = 10000;

// Explicit-run layers only (REFD = reflectivity, REFP = + precip type).
// The "-0" latest-run alias is rejected on purpose: its content changes every
// hour, which would poison an immutable edge cache.
export const HRRR_LAYER_RE = /^hrrr::REF[DP]-F\d{4}-\d{12}$/;

/**
 * Percent-decode a layer path segment (URL builders may encode the "::").
 * Returns null on malformed percent sequences — decodeURIComponent throws a
 * URIError on those, and that's the caller's bad input, not a 500.
 */
export function decodeLayer(raw) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

/** UTC init-time stamp for a run hour: YYYYMMDDHH00. */
export function hrrrRunStamp(date) {
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}${p(date.getUTCHours())}00`;
}

/**
 * Discover the newest fully-processed HRRR run. IEM finishes processing a
 * run ~50 min after its init hour, so the walk starts one hour back; six
 * hours covers a processing outage. Returns { status, body } for wrapDerived:
 * body carries both the ISO time and the ready-to-use stamp.
 */
export async function latestHRRRRun(now = new Date()) {
  const topOfHour = new Date(Math.floor(now.getTime() / 3600_000) * 3600_000);
  for (let hoursBack = 1; hoursBack <= 6; hoursBack++) {
    const candidate = new Date(topOfHour.getTime() - hoursBack * 3600_000);
    const stamp = hrrrRunStamp(candidate);
    // z2 probe tile: tiny, and any processed run 200s it (transparent when dry).
    const url = `${IEM_TILE_BASE}/hrrr::REFD-F0000-${stamp}/2/0/1.png`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.ok) {
        return { status: 200, body: { run: candidate.toISOString(), stamp } };
      }
    } catch {
      // Timeout/network — try the next candidate; total failure 502s below.
    }
  }
  return { status: 502, body: { error: 'No processed HRRR run found' } };
}

/**
 * Proxy one tile from IEM. `layer` must already match HRRR_LAYER_RE. The
 * upstream fetch rides Cloudflare's edge cache; the response tells clients
 * to cache hard too (the layer path makes the tile immutable).
 */
export async function hrrrTile(layer, z, x, y, corsHeaders = {}) {
  const upstream = `${IEM_TILE_BASE}/${layer}/${z}/${x}/${y}.png`;
  let res;
  try {
    res = await fetch(upstream, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cf: {
        cacheEverything: true,
        cacheTtlByStatus: { '200-299': 21600, '400-499': 60, '500-599': 30 },
      },
    });
  } catch (err) {
    const message = err.name === 'TimeoutError' ? 'Request timeout' : err.message;
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  if (!res.ok) {
    // 503 = run/minute not on IEM (expected near run boundaries); surface it
    // as a client-visible error rather than caching a broken image.
    return new Response(JSON.stringify({ error: `IEM ${res.status}` }), {
      status: res.status === 503 ? 503 : 502,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders },
    });
  }
  return new Response(res.body, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=21600, immutable',
      ...corsHeaders,
    },
  });
}
