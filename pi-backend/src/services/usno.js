import fetch from 'node-fetch';

const USNO_BASE_URL = process.env.USNO_BASE_URL || 'https://aa.usno.navy.mil/api';
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT) || 10000;

/**
 * Calculate timezone offset for Central Time (all Texas coastal stations)
 * Returns -6 for CST (winter) or -5 for CDT (summer/DST)
 */
function getTimezoneOffset(date) {
  const year = date.getFullYear();

  // DST in US: Second Sunday in March to First Sunday in November
  // Find second Sunday in March
  const marchFirst = new Date(year, 2, 1);
  const marchFirstDay = marchFirst.getDay();
  const secondSundayMarch = 8 + (7 - marchFirstDay) % 7;
  const dstStart = new Date(year, 2, secondSundayMarch, 2, 0, 0);

  // Find first Sunday in November
  const novFirst = new Date(year, 10, 1);
  const novFirstDay = novFirst.getDay();
  const firstSundayNov = 1 + (7 - novFirstDay) % 7;
  const dstEnd = new Date(year, 10, firstSundayNov, 2, 0, 0);

  // Check if date is within DST period
  if (date >= dstStart && date < dstEnd) {
    return -5; // CDT (Central Daylight Time)
  } else {
    return -6; // CST (Central Standard Time)
  }
}

/**
 * Fetch sun and moon data for a specific location and date
 */
export async function fetchSunMoonData(lat, lon, date = new Date()) {
  // Format date as YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  // Calculate timezone offset for Central Time
  const tzOffset = getTimezoneOffset(date);

  // Build URL
  const url = `${USNO_BASE_URL}/rstt/oneday`;
  const params = new URLSearchParams({
    date: dateStr,
    coords: `${lat.toFixed(4)},${lon.toFixed(4)}`,
    tz: tzOffset
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(`${url}?${params.toString()}`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('USNO API error:', response.status, response.statusText);
      return { error: { message: `${response.status} ${response.statusText}` } };
    }

    const data = await response.json();

    // Check for API errors
    if (data.error) {
      console.warn('USNO API returned error:', data.error);
      return { error: data.error };
    }

    return data;
  } catch (err) {
    console.error('USNO fetch failed:', err.message);
    if (err.name === 'AbortError') {
      return { error: { message: 'Request timeout' } };
    }
    return { error: { message: err.message } };
  }
}

/**
 * Parse USNO API response into usable data
 */
export function parseSunMoonData(data) {
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
 */
function formatTime24to12(time24) {
  const [hours, minutes] = time24.split(':').map(Number);

  if (isNaN(hours) || isNaN(minutes)) {
    return time24;
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}
