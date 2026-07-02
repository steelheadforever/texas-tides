// National station catalog store.
//
// Fetches the catalog from the Worker (/api/stations) with localStorage
// caching + ETag revalidation, falling back to the bundled Texas list so the
// map still boots offline or if the API is unreachable. Catalog entries carry
// { id, name, state, lat, lon, tz, products, predType, refId } — a superset of
// the legacy TEXAS_STATIONS shape, so everything downstream keeps working.

import { TEXAS_STATIONS } from './stations.js';
import { API_BASE_URL } from '../api/config.js';

const LS_KEY = 'slackwater:catalog:v1';
const FRESH_MS = 24 * 60 * 60 * 1000; // matches the endpoint's max-age

let stationsPromise = null;
let byId = null;

function readCache() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.stations) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(version, stations) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ version, savedAt: Date.now(), stations }));
  } catch (err) {
    console.warn('Catalog cache write failed (storage full?):', err.message);
  }
}

async function loadStations() {
  const cached = readCache();
  if (cached && Date.now() - cached.savedAt < FRESH_MS) return cached.stations;

  // Stations endpoint lives beside the /api/* proxy routes.
  const url = `${API_BASE_URL.replace(/\/api$/, '')}/api/stations`;
  try {
    const headers = cached?.version ? { 'If-None-Match': `"${cached.version}"` } : {};
    const res = await fetch(url, { headers });
    if (res.status === 304 && cached) {
      writeCache(cached.version, cached.stations); // refresh savedAt
      return cached.stations;
    }
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.stations) && data.stations.length) {
        writeCache(data.version, data.stations);
        return data.stations;
      }
    }
    throw new Error(`catalog fetch: HTTP ${res.status}`);
  } catch (err) {
    console.warn('Station catalog unavailable, using fallback:', err.message);
    if (cached) return cached.stations; // stale beats bundled
    return TEXAS_STATIONS; // offline first-run: bundled Texas list
  }
}

/** All stations (memoized promise — safe to call from anywhere). */
export function getStations() {
  if (!stationsPromise) {
    stationsPromise = loadStations().then((stations) => {
      byId = new Map(stations.map((s) => [s.id, s]));
      return stations;
    });
  }
  return stationsPromise;
}

/** Look up a station by NOAA id. Only valid after getStations() resolves;
 * falls back to the bundled list before that (favorites boot path). */
export function stationById(id) {
  if (byId) return byId.get(id) || null;
  return TEXAS_STATIONS.find((s) => s.id === id) || null;
}
