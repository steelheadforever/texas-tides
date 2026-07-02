// Date and time utility functions
// Based on fishing_bot4.py datetime handling
//
// NOAA (time_zone=lst_ldt) speaks STATION-LOCAL wall time in both directions:
// response timestamps and begin/end request windows. Every function here takes
// an optional IANA `tz` for that station; omitted, it falls back to the
// viewer's local clock — which is only correct when the viewer and station
// share a zone (the legacy Texas behavior).

import { tzOffsetHours, tzMidnight } from '../format.js';

/**
 * Parse NOAA local time string to Date object
 * NOAA format: "2025-01-26 14:30" — wall time in the station's zone.
 * @param {string} timeString
 * @param {string} [tz] - station IANA zone; omitted = viewer-local (legacy)
 */
export function parseNOAALocalTime(timeString, tz) {
  if (!timeString || typeof timeString !== 'string') {
    return null;
  }

  const parts = timeString.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
  if (!parts) {
    return null;
  }

  const [_, year, month, day, hour, minute] = parts.map(Number);
  if (!tz) {
    return new Date(year, month - 1, day, hour, minute);
  }

  // Wall time in `tz` → absolute instant. Two-pass: guess the offset at the
  // naive-UTC instant, apply it, and re-check in case the guess straddled a
  // DST transition.
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const off1 = tzOffsetHours(new Date(naive), tz);
  let ms = naive - off1 * 3600000;
  const off2 = tzOffsetHours(new Date(ms), tz);
  if (off2 !== off1) ms = naive - off2 * 3600000;
  return new Date(ms);
}

/**
 * Format Date object to local time string
 * Based on fishing_bot4.py:62-64
 */
export function formatLocalTime(date) {
  if (!date || !(date instanceof Date)) {
    return 'N/A';
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format date for NOAA API (YYYYMMDD HH:MM) as wall time in `tz`
 * (viewer-local when tz is omitted).
 */
function formatNOAADate(date, tz) {
  if (!date || !(date instanceof Date)) {
    return null;
  }

  if (!tz) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}${month}${day} ${hour}:${minute}`;
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(date);
  const o = {};
  for (const p of parts) o[p.type] = p.value;
  const hour = o.hour === '24' ? '00' : o.hour;
  return `${o.year}${o.month}${o.day} ${hour}:${o.minute}`;
}

/**
 * Get begin and end dates for a range
 * @param {number} hoursFromNowStart - Hours offset from now for start (negative = past, positive = future)
 * @param {number} hoursFromNowEnd - Hours offset from now for end (negative = past, positive = future)
 * @param {string} [tz] - station IANA zone for the NOAA-facing strings
 */
export function getDateRange(hoursFromNowStart = 0, hoursFromNowEnd = 24, tz) {
  const now = new Date();
  const begin = new Date(now.getTime() + (hoursFromNowStart * 60 * 60 * 1000));
  const end = new Date(now.getTime() + (hoursFromNowEnd * 60 * 60 * 1000));

  return {
    begin: formatNOAADate(begin, tz),
    end: formatNOAADate(end, tz),
    beginDate: begin,
    endDate: end
  };
}

/**
 * Get date range starting from midnight today for N days.
 * "Midnight today" is the station's midnight when tz is given.
 * @param {number} numDays - Number of days to include (e.g., 7 for 7-day forecast)
 * @param {string} [tz] - station IANA zone
 * @returns {object} Object with begin, end, beginDate, endDate
 */
export function getDateRangeFromMidnightToday(numDays = 7, tz) {
  const now = new Date();

  let midnightToday;
  if (tz) {
    const [y, m, d] = now.toLocaleDateString('en-CA', { timeZone: tz }).split('-').map(Number);
    midnightToday = tzMidnight(y, m - 1, d, tz);
  } else {
    midnightToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }

  const endDate = new Date(midnightToday.getTime() + numDays * 24 * 60 * 60 * 1000);

  return {
    begin: formatNOAADate(midnightToday, tz),
    end: formatNOAADate(endDate, tz),
    beginDate: midnightToday,
    endDate: endDate
  };
}

/**
 * Format date for forecast display
 * Format: "Sun 1/12"
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatForecastDate(date) {
  if (!date || !(date instanceof Date)) {
    return 'N/A';
  }

  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
  const month = date.getMonth() + 1; // 0-indexed, so add 1
  const day = date.getDate();

  return `${dayOfWeek} ${month}/${day}`;
}
