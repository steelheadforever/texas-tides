// Unit conversion utilities
// Based on fishing_bot4.py:155-177

/**
 * Convert knots to miles per hour
 */
export function mphFromKnots(knots) {
  if (knots === null || knots === undefined || isNaN(knots)) {
    return null;
  }
  return knots * 1.150779;
}

/**
 * Convert pascals to inches of mercury
 */
export function inHgFromPascals(pa) {
  if (pa === null || pa === undefined || isNaN(pa)) {
    return null;
  }
  return pa / 3386.389;
}

/**
 * Safe float parsing with null fallback
 */
export function safeFloat(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Format temperature with units
 */
export function formatTemperature(tempF) {
  if (tempF === null || tempF === undefined) {
    return 'N/A';
  }
  return `${tempF.toFixed(1)}°F`;
}

/**
 * Format pressure with units
 */
export function formatPressure(inHg) {
  if (inHg === null || inHg === undefined) {
    return 'N/A';
  }
  return `${inHg.toFixed(2)} inHg`;
}

/**
 * Format water level in feet
 */
export function formatFeet(feet) {
  if (feet === null || feet === undefined) {
    return 'N/A';
  }
  return `${feet.toFixed(2)} ft`;
}

/**
 * Format delta (difference) with sign
 */
export function formatDelta(delta) {
  if (delta === null || delta === undefined) {
    return 'N/A';
  }
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(2)} ft`;
}
