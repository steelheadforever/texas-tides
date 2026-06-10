// Derived NWS endpoints — these chain several upstream calls and reduce the
// result to the small shape the app consumes. Ported from routes/nws.js.

import {
  fetchPoints,
  fetchForecastHourly,
  fetchObservationStations,
  fetchLatestObservation,
  fetchObservations,
} from './upstream.js';

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
