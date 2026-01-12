// Date and time utility functions
// Based on fishing_bot4.py datetime handling

/**
 * Parse NOAA local time string to Date object
 * NOAA format: "2025-01-26 14:30"
 * Based on fishing_bot4.py:259-266
 */
export function parseNOAALocalTime(timeString) {
  if (!timeString || typeof timeString !== 'string') {
    return null;
  }

  const parts = timeString.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
  if (!parts) {
    return null;
  }

  const [_, year, month, day, hour, minute] = parts;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
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
 * Format date for NOAA API (YYYYMMDD HH:MM)
 */
function formatNOAADate(date) {
  if (!date || !(date instanceof Date)) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${year}${month}${day} ${hour}:${minute}`;
}

/**
 * Get begin and end dates for a range
 * @param {number} hoursFromNowStart - Hours offset from now for start (negative = past, positive = future)
 * @param {number} hoursFromNowEnd - Hours offset from now for end (negative = past, positive = future)
 */
export function getDateRange(hoursFromNowStart = 0, hoursFromNowEnd = 24) {
  const now = new Date();
  const begin = new Date(now.getTime() + (hoursFromNowStart * 60 * 60 * 1000));
  const end = new Date(now.getTime() + (hoursFromNowEnd * 60 * 60 * 1000));

  return {
    begin: formatNOAADate(begin),
    end: formatNOAADate(end),
    beginDate: begin,
    endDate: end
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
