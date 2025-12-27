// NWS Weather API functions
// Based on fishing_bot4.py:488-590
// API Documentation: https://www.weather.gov/documentation/services-web-api

import { mphFromMetersSec, inHgFromPascals, safeFloat } from '../utils/conversions.js';
import { calculatePressureTrend } from '../utils/formatting.js';

const REQUEST_TIMEOUT = 10000; // 10 seconds
const USER_AGENT = 'texas-tides-web (github.com/user/texas-tides)';

/**
 * Base NWS API request function
 * NWS requires User-Agent header
 * Based on fishing_bot4.py:488-503
 */
async function nwsGet(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/geo+json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`NWS API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('NWS fetch failed:', err.message);
    return null;
  }
}

/**
 * Fetch NWS points data for a location
 * Returns forecast URLs
 * Based on fishing_bot4.py:505-518
 */
export async function fetchNWSPoints(lat, lon) {
  const url = `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`;
  const data = await nwsGet(url);

  if (!data || !data.properties) {
    return null;
  }

  return {
    forecastHourly: data.properties.forecastHourly,
    observationStations: data.properties.observationStations
  };
}

/**
 * Fetch 12-hour wind forecast from NWS
 * Based on fishing_bot4.py:520-553
 */
export async function fetchForecast12h(lat, lon) {
  const points = await fetchNWSPoints(lat, lon);

  if (!points || !points.forecastHourly) {
    return null;
  }

  const data = await nwsGet(points.forecastHourly);

  if (!data || !data.properties || !data.properties.periods) {
    return null;
  }

  const periods = data.properties.periods.slice(0, 12); // First 12 hours

  if (periods.length === 0) {
    return null;
  }

  // Extract wind speeds and directions
  const windSpeeds = [];
  const windDirections = [];
  let condition = 'N/A';

  periods.forEach((period, idx) => {
    // Parse wind speed (e.g., "10 mph" or "5 to 10 mph")
    const windSpeedMatch = period.windSpeed?.match(/(\d+)\s*(?:to\s*(\d+))?\s*mph/);
    if (windSpeedMatch) {
      const speed1 = parseInt(windSpeedMatch[1]);
      const speed2 = windSpeedMatch[2] ? parseInt(windSpeedMatch[2]) : speed1;
      windSpeeds.push((speed1 + speed2) / 2);
    }

    // Wind direction
    if (period.windDirection) {
      windDirections.push(period.windDirection);
    }

    // Get sky condition from first period
    if (idx === 0 && period.shortForecast) {
      condition = period.shortForecast;
    }
  });

  // Calculate average and max wind speed
  const avgSpeed = windSpeeds.length > 0
    ? windSpeeds.reduce((a, b) => a + b, 0) / windSpeeds.length
    : null;
  const maxSpeed = windSpeeds.length > 0
    ? Math.max(...windSpeeds)
    : null;

  // Find most common wind direction
  const dirCounts = {};
  windDirections.forEach(dir => {
    dirCounts[dir] = (dirCounts[dir] || 0) + 1;
  });
  const predominantDir = Object.keys(dirCounts).length > 0
    ? Object.keys(dirCounts).reduce((a, b) => dirCounts[a] > dirCounts[b] ? a : b)
    : 'N/A';

  return {
    avgSpeed,
    maxSpeed,
    direction: predominantDir,
    condition
  };
}

/**
 * Fetch barometric pressure and calculate trend
 * Based on fishing_bot4.py:555-590
 */
export async function fetchPressure(lat, lon) {
  const points = await fetchNWSPoints(lat, lon);

  if (!points || !points.observationStations) {
    return null;
  }

  // Get observation stations
  const stationsData = await nwsGet(points.observationStations);

  if (!stationsData || !stationsData.features || stationsData.features.length === 0) {
    return null;
  }

  // Use first station
  const stationId = stationsData.features[0]?.properties?.stationIdentifier;

  if (!stationId) {
    return null;
  }

  // Fetch recent observations
  const obsUrl = `https://api.weather.gov/stations/${stationId}/observations?limit=6`;
  const obsData = await nwsGet(obsUrl);

  if (!obsData || !obsData.features || obsData.features.length === 0) {
    return null;
  }

  const observations = [];

  obsData.features.forEach(obs => {
    const props = obs.properties;
    let pressurePa = null;

    // Try seaLevelPressure first, then barometricPressure
    if (props.seaLevelPressure && props.seaLevelPressure.value !== null) {
      pressurePa = props.seaLevelPressure.value;
    } else if (props.barometricPressure && props.barometricPressure.value !== null) {
      pressurePa = props.barometricPressure.value;
    }

    if (pressurePa !== null) {
      observations.push({
        time: new Date(props.timestamp),
        value: inHgFromPascals(pressurePa)
      });
    }
  });

  if (observations.length === 0) {
    return null;
  }

  // Sort by time (newest first)
  observations.sort((a, b) => b.time - a.time);

  const currentPressure = observations[0].value;
  const trend = calculatePressureTrend(observations);

  return {
    value: currentPressure,
    trend
  };
}
