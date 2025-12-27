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
 * Format time only (no date)
 */
export function formatTime(date) {
  if (!date || !(date instanceof Date)) {
    return 'N/A';
  }

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format date for NOAA API (YYYYMMDD HH:MM)
 */
export function formatNOAADate(date) {
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
 * Calculate relative time from now
 */
export function getRelativeTime(date) {
  if (!date || !(date instanceof Date)) {
    return 'N/A';
  }

  const now = new Date();
  const diffMs = date - now;
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins < 0) {
    const mins = Math.abs(diffMins);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } else {
    if (diffMins < 60) return `in ${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    if (hours < 24) return `in ${hours}h`;
    const days = Math.floor(hours / 24);
    return `in ${days}d`;
  }
}
