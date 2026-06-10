import fetch from 'node-fetch';

const NWS_BASE_URL = process.env.NWS_BASE_URL || 'https://api.weather.gov';
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT) || 10000;
const USER_AGENT = 'slackwater-backend (github.com/steelheadforever/texas-tides)';

/**
 * Base NWS API request function
 * NWS requires User-Agent header
 */
export async function nwsGet(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
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
      return { error: { message: `${response.status} ${response.statusText}` } };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('NWS fetch failed:', err.message);
    if (err.name === 'AbortError') {
      return { error: { message: 'Request timeout' } };
    }
    return { error: { message: err.message } };
  }
}

/**
 * Fetch NWS points data for a location
 * Returns forecast URLs and observation stations
 */
export async function fetchPoints(lat, lon) {
  const url = `${NWS_BASE_URL}/points/${lat.toFixed(4)},${lon.toFixed(4)}`;
  return await nwsGet(url);
}

/**
 * Fetch hourly forecast
 */
export async function fetchForecastHourly(forecastUrl) {
  return await nwsGet(forecastUrl);
}

/**
 * Fetch observation stations for a location
 */
export async function fetchObservationStations(stationsUrl) {
  return await nwsGet(stationsUrl);
}

/**
 * Fetch latest observation from a station
 */
export async function fetchLatestObservation(stationId) {
  const url = `${NWS_BASE_URL}/stations/${stationId}/observations/latest`;
  return await nwsGet(url);
}

/**
 * Fetch recent observations from a station
 */
export async function fetchObservations(stationId, limit = 6) {
  const url = `${NWS_BASE_URL}/stations/${stationId}/observations?limit=${limit}`;
  return await nwsGet(url);
}
