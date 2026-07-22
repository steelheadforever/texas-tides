// Upstream API clients — NOAA CO-OPS, NWS, USNO.
// Ported from pi-backend/src/services/*. Uses the Workers-native fetch and
// AbortSignal.timeout instead of node-fetch.

const NOAA_BASE_URL = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
const NWS_BASE_URL = 'https://api.weather.gov';
const USNO_BASE_URL = 'https://aa.usno.navy.mil/api';
const TIMEOUT_MS = 10000;
const NWS_USER_AGENT = 'slackwater (slackwater.app; contact: steelheadforever@gmail.com)';

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
    // Parse the body even on a non-2xx — NOAA puts the actual reason in there
    // ("Wrong Datum: Datum cannot be null or empty"), which is far more useful
    // in a log than the bare status line. Fall back to the status if it's
    // unparseable.
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const message = data?.error?.message || data?.message || `NOAA ${res.status} ${res.statusText}`;
      return { error: { message } };
    }
    if (!data) return { error: { message: 'Malformed NOAA response' } };
    if (data.error) return { error: data.error };
    // NOAA reports failures in two shapes. "No data was found at this station"
    // arrives as {"error":{...}} (caught above), but throttling arrives as a
    // bare {"message":"Forbidden"} with HTTP 200 — no error key, no payload.
    // Letting that through means caching a transient refusal as if it were
    // real data: with day-aligned prediction keys and a 24h TTL, one blip
    // blanks a station's tide curve for every client until the next day.
    if (!hasPayload(data)) {
      return { error: { message: data.message || 'Malformed NOAA response' } };
    }
    return data;
  } catch (err) {
    return { error: { message: err.name === 'TimeoutError' ? 'Request timeout' : err.message } };
  }
}

// A real CO-OPS response carries rows: `predictions` for tide predictions,
// `data` for observations (water level, temps, wind, pressure). An empty array
// is treated as no payload too — NOAA signals a genuinely dataless station via
// the {"error":...} shape, so an empty set is anomalous and must not be cached
// for a day. Returning an error instead just makes the next request retry.
function hasPayload(data) {
  return (Array.isArray(data?.predictions) && data.predictions.length > 0)
    || (Array.isArray(data?.data) && data.data.length > 0);
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
// Active alerts whose polygon/zone contains the point (land zones, and marine
// zones when the station's coordinates sit in the water).
export function fetchAlertsForPoint(lat, lon) {
  return nwsGet(`${NWS_BASE_URL}/alerts/active?status=actual&point=${lat.toFixed(4)},${lon.toFixed(4)}`);
}
// Coastal marine zone(s) containing the point. Same polygon test as above, so
// this only adds coverage when the point is in the water — kept separate
// because alert queries by zone id are what the phase-2 map layer will share.
export function fetchCoastalZones(lat, lon) {
  return nwsGet(`${NWS_BASE_URL}/zones?type=coastal&point=${lat.toFixed(4)},${lon.toFixed(4)}&include_geometry=false`);
}
export function fetchAlertsForZone(zoneId) {
  return nwsGet(`${NWS_BASE_URL}/alerts/active/zone/${encodeURIComponent(zoneId)}`);
}
// Every active marine alert nationwide — one call feeds the whole map layer.
export function fetchActiveMarine() {
  return nwsGet(`${NWS_BASE_URL}/alerts/active?status=actual&region_type=marine`);
}
// Zone metadata + geometry. Marine zones live under coastal/offshore; the
// forecast type covers everything else.
export function fetchZone(type, id) {
  return nwsGet(`${NWS_BASE_URL}/zones/${encodeURIComponent(type)}/${encodeURIComponent(id)}`);
}

// ---- USNO ----------------------------------------------------------------

// UTC offset (hours) of an IANA zone at `date`, via Intl — handles DST and
// the odd zones (Adak, Puerto Rico, Guam) without a hand-rolled rule table.
// Defaults to US Central for legacy clients that don't send a tz.
function tzOffsetHours(date, tz = 'America/Chicago') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const o = {};
  for (const p of parts) o[p.type] = p.value;
  const wallUTC = Date.UTC(+o.year, o.month - 1, +o.day, o.hour === '24' ? 0 : +o.hour, +o.minute, +o.second);
  // Sub-second remainder would leak into the offset — Intl only reports whole
  // seconds — so compare against the date floored to the second.
  return (wallUTC - Math.floor(date.getTime() / 1000) * 1000) / 3600000;
}

// Fetch raw USNO sun/moon data for a location + date (defaults to today).
// `tzName` is the station's IANA timezone; rise/set times come back in it.
export async function fetchSunMoon(lat, lon, date = new Date(), tzName) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;
  const tz = tzOffsetHours(date, tzName);

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
