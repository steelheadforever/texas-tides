// USNO (US Naval Observatory) API functions
// API Documentation: https://aa.usno.navy.mil/data/api
// Provides sun/moon rise/set times and moon phase data

const USNO_BASE_URL = 'https://aa.usno.navy.mil/api';
const REQUEST_TIMEOUT = 10000; // 10 seconds

/**
 * Fetch sun and moon data for a specific location and date
 * Based on fishing_bot4.py:595-618 (moon phase)
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {Date} date - Date to fetch data for (defaults to today)
 * @returns {Object} Sun and moon rise/set times, moon phase
 */
export async function fetchSunMoonData(lat, lon, date = new Date()) {
  // Format date as YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  // Build URL - using rstt/oneday endpoint
  // This gives us sun rise/set, moon rise/set, and moon phase in one call
  const url = `${USNO_BASE_URL}/rstt/oneday`;
  const params = new URLSearchParams({
    date: dateStr,
    coords: `${lat.toFixed(4)},${lon.toFixed(4)}`,
    tz: 0 // Request UTC times, we'll display in local
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(`${url}?${params.toString()}`, {
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

    return parseSunMoonData(data);
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
