// Open-Meteo weather proxy — wind + precip grid, wave grid, and single-point
// sea state. The iOS app used to hit Open-Meteo directly from every device:
// 400-point grid requests that tripped the free-tier rate limit under real
// panning (and the sea-state layer doubled that by adding a second /marine
// call). Fronting it here collapses all clients onto shared, KV-cached
// regional grids, so upstream sees ~one call per region per TTL instead of one
// per device per pan.

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
// The marine models live on their own subdomain, not api.open-meteo.com.
const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';
const TIMEOUT_MS = 12000;

// Even rows×cols grid over the bounds, emitted lat-major (outer lat, inner lon)
// so the response array index matches the iOS lattice's row*cols + col layout.
// The app's lattice is step-aligned, i.e. already evenly spaced, so regenerating
// from bounds+count reproduces its exact points without shipping the full list.
export function gridCoords(minLat, maxLat, minLon, maxLon, rows, cols) {
  const lats = [];
  const lons = [];
  for (let i = 0; i < rows; i++) lats.push(rows === 1 ? minLat : minLat + (i * (maxLat - minLat)) / (rows - 1));
  for (let j = 0; j < cols; j++) lons.push(cols === 1 ? minLon : minLon + (j * (maxLon - minLon)) / (cols - 1));
  const latCsv = [];
  const lonCsv = [];
  for (const la of lats) {
    for (const lo of lons) {
      latCsv.push(la.toFixed(2));
      lonCsv.push(lo.toFixed(2));
    }
  }
  return { latitude: latCsv.join(','), longitude: lonCsv.join(',') };
}

async function openMeteoGet(base, params) {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return { error: { message: `Open-Meteo ${res.status} ${res.statusText}` } };
    return await res.json();
  } catch (err) {
    return { error: { message: err.name === 'TimeoutError' ? 'Request timeout' : err.message } };
  }
}

// Wind+precip grid (always) plus the wave grid (only when the sea-state layer is
// on). Returns { status, body, noCache } for wrapDerived: forecast is required;
// marine is best-effort — if waves were requested but marine failed, the grid is
// served but NOT cached, so the next request re-tries for waves instead of
// pinning a wave-less grid for the whole TTL.
export async function weatherGrid({ minLat, maxLat, minLon, maxLon, rows, cols, wantsWaves }) {
  const coords = gridCoords(minLat, maxLat, minLon, maxLon, rows, cols);

  const forecastReq = openMeteoGet(FORECAST_URL, {
    ...coords,
    current: 'wind_speed_10m,wind_direction_10m',
    hourly: 'wind_speed_10m,wind_direction_10m,precipitation',
    forecast_hours: '13',
    wind_speed_unit: 'ms',
    timezone: 'UTC',
  });
  const marineReq = wantsWaves
    ? openMeteoGet(MARINE_URL, {
      ...coords,
      current: 'wave_height',
      hourly: 'wave_height',
      forecast_hours: '13',
      timezone: 'UTC',
    })
    : Promise.resolve(null);

  const [forecast, marine] = await Promise.all([forecastReq, marineReq]);

  // Multi-point Open-Meteo replies with a JSON array; an object with `.error`
  // (or a non-array) means the request failed.
  if (!Array.isArray(forecast)) {
    return { status: 502, body: { error: forecast?.error?.message || 'Weather upstream unavailable' } };
  }
  const marineOk = Array.isArray(marine) ? marine : null;

  return {
    status: 200,
    body: { forecast, marine: marineOk },
    noCache: wantsWaves && !marineOk,
  };
}

// Single-point sea state for the station card: combined wave height + the
// swell / wind-wave split. Returns the Open-Meteo `current` block, or { error }.
export async function marinePoint(lat, lon) {
  const data = await openMeteoGet(MARINE_URL, {
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current: 'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,wind_wave_height,wind_wave_direction',
    timezone: 'UTC',
  });
  if (!data || data.error) return { error: data?.error?.message || 'Marine upstream unavailable' };
  if (!data.current) return { error: 'No marine data for this location' };
  return data.current;
}
