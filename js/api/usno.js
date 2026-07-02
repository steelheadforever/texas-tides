// USNO (US Naval Observatory) API functions
// Now proxied through Raspberry Pi backend for caching and analytics
// Provides sun/moon rise/set times and moon phase data

import { API_BASE_URL, REQUEST_TIMEOUT } from './config.js';

const USNO_API_URL = `${API_BASE_URL}/usno`;

/**
 * Fetch sun and moon data for a specific location and date
 * Based on fishing_bot4.py:595-618 (moon phase)
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {Date} date - Date to fetch data for (defaults to today)
 * @param {string} [tz] - Station IANA timezone; omitted = US Central (legacy)
 * @returns {Object} Sun and moon rise/set times, moon phase
 */
export async function fetchSunMoonData(lat, lon, date = new Date(), tz) {
  // Format date as YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  const tzParam = tz ? `&tz=${encodeURIComponent(tz)}` : '';
  const url = `${USNO_API_URL}/sun-moon?lat=${lat}&lon=${lon}&date=${dateStr}${tzParam}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('USNO API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    // Check for API errors
    if (data.error) {
      console.warn('USNO API returned error:', data.error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('USNO fetch failed:', err.message);
    return null;
  }
}

/**
 * Parse USNO API response into usable data
 */
function parseSunMoonData(data) {
  if (!data || !data.properties) {
    return null;
  }

  const props = data.properties;
  const result = {
    sun: null,
    moon: null,
    moonPhase: null
  };

  // Parse sun data
  if (props.data && props.data.sundata) {
    const sunData = props.data.sundata;
    result.sun = {
      rise: findEvent(sunData, 'Rise') || 'N/A',
      set: findEvent(sunData, 'Set') || 'N/A'
    };
  }

  // Parse moon data
  if (props.data && props.data.moondata) {
    const moonData = props.data.moondata;
    result.moon = {
      rise: findEvent(moonData, 'Rise') || 'N/A',
      set: findEvent(moonData, 'Set') || 'N/A'
    };
  }

  // Parse moon phase
  if (props.data && props.data.curphase) {
    result.moonPhase = props.data.curphase;
  }

  return result;
}

/**
 * Find specific event (Rise or Set) in USNO data array
 */
function findEvent(dataArray, eventType) {
  if (!Array.isArray(dataArray)) {
    return null;
  }

  const event = dataArray.find(item => item.phen && item.phen.includes(eventType));

  if (event && event.time) {
    // USNO returns time in 24-hour format like "06:34"
    // Convert to 12-hour format
    return formatTime24to12(event.time);
  }

  return null;
}

/**
 * Convert 24-hour time to 12-hour format
 * @param {string} time24 - Time in "HH:MM" format
 * @returns {string} Time in "h:MM AM/PM" format
 */
function formatTime24to12(time24) {
  const [hours, minutes] = time24.split(':').map(Number);

  if (isNaN(hours) || isNaN(minutes)) {
    return time24; // Return as-is if parsing fails
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12; // Convert 0 to 12 for midnight

  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Get moon phase emoji based on phase description
 */
export function getMoonEmoji(phaseDescription) {
  if (!phaseDescription) return '🌙';

  const phase = phaseDescription.toLowerCase();

  if (phase.includes('new moon')) return '🌑';
  if (phase.includes('waxing crescent')) return '🌒';
  if (phase.includes('first quarter')) return '🌓';
  if (phase.includes('waxing gibbous')) return '🌔';
  if (phase.includes('full moon')) return '🌕';
  if (phase.includes('waning gibbous')) return '🌖';
  if (phase.includes('last quarter')) return '🌗';
  if (phase.includes('waning crescent')) return '🌘';

  return '🌙'; // Default moon emoji
}

/**
 * Fetch 7 days of sun/moon data (current day + 6 days forward)
 * Returns array of daily sun/moon rise/set times and moon phase
 * `tz` (optional IANA zone) anchors "today" to the station's calendar, not
 * the viewer's — a viewer in NY at 11pm should still get the current day for
 * a California station.
 */
export async function fetchSunMoon7Day(lat, lon, tz) {
  const dailyData = [];
  const now = new Date();

  // Midnight of the station-local (or viewer-local, if no tz) current day.
  const [y, m, d] = now.toLocaleDateString('en-CA', tz ? { timeZone: tz } : {}).split('-').map(Number);
  const today = new Date(y, m - 1, d, 0, 0, 0, 0);

  // Fetch data for each of the 7 days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + dayOffset);

    const data = await fetchSunMoonData(lat, lon, targetDate, tz);

    if (data) {
      dailyData.push({
        date: new Date(targetDate),
        sunrise: data.sun?.rise || 'N/A',
        sunset: data.sun?.set || 'N/A',
        moonrise: data.moon?.rise || 'N/A',
        moonset: data.moon?.set || 'N/A',
        moonPhase: data.moonPhase || 'N/A',
        moonEmoji: getMoonEmoji(data.moonPhase)
      });
    } else {
      // If fetch fails, add placeholder data
      dailyData.push({
        date: new Date(targetDate),
        sunrise: 'N/A',
        sunset: 'N/A',
        moonrise: 'N/A',
        moonset: 'N/A',
        moonPhase: 'N/A',
        moonEmoji: '🌙'
      });
    }
  }

  return dailyData;
}
