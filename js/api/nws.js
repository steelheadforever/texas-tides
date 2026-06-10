// NWS Weather API functions
// Based on fishing_bot4.py:488-590
// Now proxied through Raspberry Pi backend for caching and analytics

import { API_BASE_URL, REQUEST_TIMEOUT } from './config.js';

const NWS_API_URL = `${API_BASE_URL}/nws`;

/**
 * Base NWS API request function
 * Proxied through Pi backend (User-Agent handled server-side)
 */
async function nwsGet(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(url, {
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
async function fetchNWSPoints(lat, lon) {
  const url = `${NWS_API_URL}/points?lat=${lat}&lon=${lon}`;
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
 * Now proxied through Pi backend
 */
export async function fetchForecast12h(lat, lon) {
  const url = `${NWS_API_URL}/forecast-12h?lat=${lat}&lon=${lon}`;
  const data = await nwsGet(url);
  return data;
}

/**
 * Fetch barometric pressure and calculate trend
 * Now proxied through Pi backend
 */
export async function fetchPressure(lat, lon) {
  const url = `${NWS_API_URL}/pressure?lat=${lat}&lon=${lon}`;
  const data = await nwsGet(url);
  return data;
}

/**
 * Fetch air temperature from NWS observation station
 * Now proxied through Pi backend
 */
export async function fetchNWSTemperature(lat, lon) {
  const url = `${NWS_API_URL}/temperature?lat=${lat}&lon=${lon}`;
  const data = await nwsGet(url);

  if (!data || data.error) {
    return null;
  }

  return data.temperature;
}
