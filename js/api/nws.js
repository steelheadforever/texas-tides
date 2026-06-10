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
    forecast: data.properties.forecast,
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

/**
 * Fetch 7-day weather forecast (starting from midnight today)
 * Returns array of daily forecast objects with weather, temp, wind, precip
 */
export async function fetchWeatherForecast7Day(lat, lon) {
  const points = await fetchNWSPoints(lat, lon);

  if (!points || !points.forecast) {
    return null;
  }

  // Use the regular forecast endpoint for daily periods
  const data = await nwsGet(points.forecast);

  if (!data || !data.properties || !data.properties.periods) {
    return null;
  }

  const periods = data.properties.periods;

  // Get midnight today to determine which day each period belongs to
  const now = new Date();
  const midnightToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  // Create a map of date -> {day: dayPeriod, night: nightPeriod}
  const periodsByDate = {};

  for (const period of periods) {
    const periodStart = new Date(period.startTime);
    const periodDate = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate(), 0, 0, 0, 0);
    const dateKey = periodDate.toISOString().split('T')[0]; // YYYY-MM-DD

    if (!periodsByDate[dateKey]) {
      periodsByDate[dateKey] = {};
    }

    if (period.isDaytime) {
      periodsByDate[dateKey].day = period;
    } else {
      periodsByDate[dateKey].night = period;
    }
  }

  // Build 7 days of forecasts starting from today
  const dailyForecasts = [];

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const targetDate = new Date(midnightToday);
    targetDate.setDate(midnightToday.getDate() + dayOffset);
    const dateKey = targetDate.toISOString().split('T')[0];

    const dayPeriod = periodsByDate[dateKey]?.day;
    const nightPeriod = periodsByDate[dateKey]?.night;

    // If no day period (e.g., it's evening and today has passed), use night period as fallback
    const primaryPeriod = dayPeriod || nightPeriod;

    // Parse wind speed and gusts (from primary period if available)
    let windSpeed = 0;
    let windGust = 0;

    if (primaryPeriod && primaryPeriod.windSpeed) {
      const windMatch = primaryPeriod.windSpeed.match(/(\d+)\s*(?:to\s*(\d+))?\s*mph/);
      if (windMatch) {
        const speed1 = parseInt(windMatch[1]);
        const speed2 = windMatch[2] ? parseInt(windMatch[2]) : speed1;
        windSpeed = speed1;
        windGust = speed2;
      }
    }

    dailyForecasts.push({
      date: new Date(targetDate),
      dayOfWeek: targetDate.toLocaleDateString('en-US', { weekday: 'short' }),
      icon: primaryPeriod?.icon || '',
      shortForecast: primaryPeriod?.shortForecast || 'N/A',
      detailedForecast: primaryPeriod?.detailedForecast || '',
      tempHigh: dayPeriod?.temperature || null,
      tempLow: nightPeriod?.temperature || null,
      windSpeed: windSpeed,
      windGust: windGust,
      windDirection: primaryPeriod?.windDirection || 'N',
      precipProbability: primaryPeriod?.probabilityOfPrecipitation?.value || 0
    });
  }

  return dailyForecasts;
}
