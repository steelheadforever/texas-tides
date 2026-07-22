// Derived NWS endpoints — these chain several upstream calls and reduce the
// result to the small shape the app consumes. Ported from routes/nws.js.

import {
  fetchPoints,
  fetchForecastHourly,
  fetchObservationStations,
  fetchLatestObservation,
  fetchObservations,
  fetchAlertsForPoint,
  fetchCoastalZones,
  fetchAlertsForZone,
  fetchActiveMarine,
  fetchZone,
} from './upstream.js';
import { simplifyGeometry } from './geometry.js';

// 12-hour wind summary: { avgSpeed, maxSpeed, direction, condition }
export async function forecast12h(lat, lon) {
  const points = await fetchPoints(lat, lon);
  if (points.error || !points.properties?.forecastHourly) {
    return { status: 404, body: { error: 'No forecast data available' } };
  }
  const forecast = await fetchForecastHourly(points.properties.forecastHourly);
  if (forecast.error) return { status: 404, body: { error: 'No forecast data available' } };

  const periods = forecast.properties?.periods?.slice(0, 12) || [];
  const windSpeeds = [];
  const windDirections = [];
  let condition = 'N/A';

  periods.forEach((p, idx) => {
    const match = p.windSpeed?.match(/(\d+)\s*(?:to\s*(\d+))?\s*mph/);
    if (match) {
      const s1 = parseInt(match[1]);
      const s2 = match[2] ? parseInt(match[2]) : s1;
      windSpeeds.push((s1 + s2) / 2);
    }
    if (p.windDirection) windDirections.push(p.windDirection);
    if (idx === 0 && p.shortForecast) condition = p.shortForecast;
  });

  const avgSpeed = windSpeeds.length ? windSpeeds.reduce((a, b) => a + b, 0) / windSpeeds.length : null;
  const maxSpeed = windSpeeds.length ? Math.max(...windSpeeds) : null;
  const dirCounts = {};
  windDirections.forEach((d) => (dirCounts[d] = (dirCounts[d] || 0) + 1));
  const direction = Object.keys(dirCounts).length
    ? Object.keys(dirCounts).reduce((a, b) => (dirCounts[a] > dirCounts[b] ? a : b))
    : 'N/A';

  return { status: 200, body: { avgSpeed, maxSpeed, direction, condition } };
}

// Active NWS alerts for a station: everything covering the point (land zones,
// plus marine zones when the coordinates sit in the water) merged with the
// coastal marine zone's alerts — a pier-side station whose point falls just
// landward of the marine-zone polygon still gets its Small Craft Advisory.
// Reduced to the fields the apps render; severity-ranked, warnings first.
//
// { alerts: [...] } with an empty array is the normal no-alerts case and is
// cached like any other success.

const SEVERITY_RANK = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 };

// "Warning" outranks "Watch" outranks everything else. The NWS severity field
// alone can't order products (every SCA is "Minor"), so rank by suffix first,
// then severity within a tier.
function tierRank(event) {
  if (/Warning$/.test(event)) return 0;
  if (/Watch$/.test(event)) return 1;
  return 2;
}

function zoneIdFromUrl(url) {
  // affectedZones entries are URLs like ".../zones/forecast/TXZ213".
  const m = /\/zones\/\w+\/([A-Z0-9]+)$/.exec(url || '');
  return m ? m[1] : null;
}

export function reduceAlerts(featureLists) {
  const byId = new Map();
  for (const list of featureLists) {
    if (!list || list.error) continue;
    for (const f of list.features || []) {
      const p = f.properties;
      if (!p?.id || !p.event) continue;
      if (p.status !== 'Actual') continue;
      if (p.messageType === 'Cancel') continue;
      byId.set(p.id, {
        id: p.id,
        event: p.event,
        severity: p.severity || 'Unknown',
        urgency: p.urgency || null,
        headline: p.headline || null,
        description: p.description || null,
        instruction: p.instruction || null,
        onset: p.onset || null,
        ends: p.ends || null,
        expires: p.expires || null,
        areaDesc: p.areaDesc || null,
        zones: (p.affectedZones || []).map(zoneIdFromUrl).filter(Boolean),
      });
    }
  }
  return [...byId.values()].sort((a, b) =>
    tierRank(a.event) - tierRank(b.event)
    || (SEVERITY_RANK[a.severity] ?? 4) - (SEVERITY_RANK[b.severity] ?? 4)
    || a.event.localeCompare(b.event));
}

export async function alerts(lat, lon) {
  const [point, zones] = await Promise.all([
    fetchAlertsForPoint(lat, lon),
    fetchCoastalZones(lat, lon),
  ]);
  const zoneIds = (zones.features || [])
    .map((f) => f.properties?.id)
    .filter(Boolean)
    .slice(0, 2);
  const zoneAlerts = await Promise.all(zoneIds.map((id) => fetchAlertsForZone(id)));

  const lists = [point, ...zoneAlerts];
  // Every upstream failed → don't cache an empty list that's really an outage.
  if (lists.every((l) => l.error)) {
    return { status: 502, body: { error: 'Alerts unavailable' } };
  }
  return { status: 200, body: { alerts: reduceAlerts(lists) } };
}

// National marine-alert summary for the map layer: which marine zones have
// active alerts, at what banner tier, with the event names for the popup.
// One upstream call, cached, shared by every viewer.

const TIER_NAME = ['warning', 'watch', 'advisory'];

export function reduceMarineZones(data) {
  const zones = new Map();
  for (const f of data.features || []) {
    const p = f.properties;
    if (!p?.event || p.status !== 'Actual' || p.messageType === 'Cancel') continue;
    const tier = tierRank(p.event);
    for (const url of p.affectedZones || []) {
      const id = zoneIdFromUrl(url);
      if (!id) continue;
      const z = zones.get(id) || { id, tier: 2, events: [] };
      z.tier = Math.min(z.tier, tier);
      if (!z.events.includes(p.event)) z.events.push(p.event);
      zones.set(id, z);
    }
  }
  return [...zones.values()].map((z) => ({ id: z.id, tier: TIER_NAME[z.tier], events: z.events }));
}

export async function marineAlerts() {
  const data = await fetchActiveMarine();
  if (data.error) return { error: data.error };
  return { zones: reduceMarineZones(data) };
}

// Simplified GeoJSON geometry for one zone. Zone shapes are effectively
// static, so the route caches this for a month.
export async function zoneGeometry(id) {
  for (const type of ['coastal', 'offshore', 'forecast']) {
    const data = await fetchZone(type, id);
    if (!data.error && data.geometry) {
      return { id, geometry: simplifyGeometry(data.geometry) };
    }
  }
  return { error: { message: `No geometry for zone ${id}` } };
}

// Resolve the nearest NWS observation station id for a location.
async function nearestStation(lat, lon) {
  const points = await fetchPoints(lat, lon);
  if (points.error || !points.properties?.observationStations) return null;
  const stations = await fetchObservationStations(points.properties.observationStations);
  if (stations.error || !stations.features?.length) return null;
  return stations.features[0]?.properties?.stationIdentifier || null;
}

// Barometric pressure + trend: { value, trend, unit }
export async function pressure(lat, lon) {
  const stationId = await nearestStation(lat, lon);
  if (!stationId) return { status: 404, body: { error: 'No observation stations available' } };

  const obs = await fetchObservations(stationId, 6);
  if (obs.error || !obs.features?.length) {
    return { status: 404, body: { error: 'No observations available' } };
  }

  const observations = [];
  obs.features.forEach((o) => {
    const p = o.properties;
    let pa = null;
    if (p.seaLevelPressure?.value != null) pa = p.seaLevelPressure.value;
    else if (p.barometricPressure?.value != null) pa = p.barometricPressure.value;
    if (pa !== null) observations.push({ time: new Date(p.timestamp).getTime(), value: pa * 0.0002953 });
  });
  if (!observations.length) return { status: 404, body: { error: 'No pressure data available' } };

  observations.sort((a, b) => b.time - a.time);
  const current = observations[0].value;
  let trend = 'steady';
  if (observations.length >= 2) {
    const delta = current - observations[observations.length - 1].value;
    if (delta > 0.03) trend = 'rising';
    else if (delta < -0.03) trend = 'falling';
  }
  return { status: 200, body: { value: current, trend, unit: 'inHg' } };
}

// Air temperature from nearest station: { temperature, unit }
export async function temperature(lat, lon) {
  const stationId = await nearestStation(lat, lon);
  if (!stationId) return { status: 404, body: { error: 'No observation stations available' } };

  const obs = await fetchLatestObservation(stationId);
  if (obs.error || !obs.properties) return { status: 404, body: { error: 'No temperature data available' } };
  const tempC = obs.properties.temperature?.value;
  if (tempC == null) return { status: 404, body: { error: 'No temperature data available' } };
  return { status: 200, body: { temperature: (tempC * 9) / 5 + 32, unit: 'fahrenheit' } };
}
