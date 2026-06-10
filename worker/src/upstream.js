// Upstream API clients — NOAA CO-OPS, NWS, USNO.
// Ported from pi-backend/src/services/*. Uses the Workers-native fetch and
// AbortSignal.timeout instead of node-fetch.

const NOAA_BASE_URL = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
const NWS_BASE_URL = 'https://api.weather.gov';
const USNO_BASE_URL = 'https://aa.usno.navy.mil/api';
const TIMEOUT_MS = 10000;
const NWS_USER_AGENT = 'slackwater (github.com/steelheadforever/texas-tides)';

function timeout() {
  return AbortSignal.timeout(TIMEOUT_MS);
}

// ---- NOAA ----------------------------------------------------------------

// Generic NOAA CO-OPS request. `params` is the raw query object from the
// client (station, product, date/begin_date/end_date, datum, interval, ...).
export async function noaaGet(params) {
  const baseParams = {
    units: 'english',
    time_zone: 'lst_ldt',
    format: 'json',
    application: 'slackwater',
  };
  const all = { ...baseParams, ...params };
  const url = new URL(NOAA_BASE_URL);
  for (const k of Object.keys(all)) {
    if (all[k] !== null && all[k] !== undefined) url.searchParams.append(k, all[k]);
  }

  try {
    const res = await fetch(url, { signal: timeout() });
    const data = await res.json();
    if (data.error) return { error: data.error };
    return data;
  } catch (err) {
    return { error: { message: err.name === 'TimeoutError' ? 'Request timeout' : err.message } };
  }
}

// ---- NWS -----------------------------------------------------------------

async function nwsGet(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': NWS_USER_AGENT, Accept: 'application/geo+json' },
      signal: timeout(),
    });
    if (!res.ok) return { error: { message: `${res.status} ${res.statusText}` } };
    return await res.json();
  } catch (err) {
    return { error: { message: err.name === 'TimeoutError' ? 'Request timeout' : err.message } };
  }
}

export function fetchPoints(lat, lon) {
  return nwsGet(`${NWS_BASE_URL}/points/${lat.toFixed(4)},${lon.toFixed(4)}`);
}
export function fetchForecastHourly(forecastUrl) {
  return nwsGet(forecastUrl);
}
export function fetchObservationStations(stationsUrl) {
  return nwsGet(stationsUrl);
}
export function fetchLatestObservation(stationId) {
  return nwsGet(`${NWS_BASE_URL}/stations/${stationId}/observations/latest`);
}
export function fetchObservations(stationId, limit = 6) {
  return nwsGet(`${NWS_BASE_URL}/stations/${stationId}/observations?limit=${limit}`);
}

// ---- USNO ----------------------------------------------------------------

// Central Time offset (-6 CST / -5 CDT) for Texas coastal stations.
function getTimezoneOffset(date) {
  const year = date.getUTCFullYear();
  const marchFirst = new Date(Date.UTC(year, 2, 1));
  const secondSundayMarch = 8 + ((7 - marchFirst.getUTCDay()) % 7);
  const dstStart = Date.UTC(year, 2, secondSundayMarch, 8); // 2am local ~ 8am UTC
  const novFirst = new Date(Date.UTC(year, 10, 1));
  const firstSundayNov = 1 + ((7 - novFirst.getUTCDay()) % 7);
  const dstEnd = Date.UTC(year, 10, firstSundayNov, 7);
  const t = date.getTime();
  return t >= dstStart && t < dstEnd ? -5 : -6;
}

// Fetch raw USNO sun/moon data for a location + date (defaults to today).
export async function fetchSunMoon(lat, lon, date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;
  const tz = getTimezoneOffset(date);

  const url = new URL(`${USNO_BASE_URL}/rstt/oneday`);
  url.searchParams.set('date', dateStr);
  url.searchParams.set('coords', `${lat.toFixed(4)},${lon.toFixed(4)}`);
  url.searchParams.set('tz', String(tz));

  try {
    const res = await fetch(url, { signal: timeout() });
    if (!res.ok) return { error: { message: `${res.status} ${res.statusText}` } };
    const data = await res.json();
    if (data.error) return { error: data.error };
    return data;
  } catch (err) {
    return { error: { message: err.name === 'TimeoutError' ? 'Request timeout' : err.message } };
  }
}

// Parse USNO response into { sun, moon, moonPhase }.
export function parseSunMoon(data) {
  if (!data || !data.properties) return null;
  const props = data.properties;
  const result = { sun: null, moon: null, moonPhase: null };
  if (props.data?.sundata) {
    result.sun = {
      rise: findEvent(props.data.sundata, 'Rise') || 'N/A',
      set: findEvent(props.data.sundata, 'Set') || 'N/A',
    };
  }
  if (props.data?.moondata) {
    result.moon = {
      rise: findEvent(props.data.moondata, 'Rise') || 'N/A',
      set: findEvent(props.data.moondata, 'Set') || 'N/A',
    };
  }
  if (props.data?.curphase) result.moonPhase = props.data.curphase;
  return result;
}

function findEvent(arr, type) {
  if (!Array.isArray(arr)) return null;
  const e = arr.find((i) => i.phen && i.phen.includes(type));
  return e?.time ? formatTime24to12(e.time) : null;
}

function formatTime24to12(t) {
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return t;
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
}
