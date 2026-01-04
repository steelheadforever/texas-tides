// Formatting and emoji utility functions
// Based on fishing_bot4.py:66-180

/**
 * Get emoji for sky/weather conditions
 * Based on fishing_bot4.py:66-80
 */
export function getConditionsEmoji(text) {
  if (!text) return '❓';

  const lower = text.toLowerCase();

  if (lower.includes('fog')) return '🌫️';
  if (lower.includes('thunder') || lower.includes('storm')) return '⛈️';
  if (lower.includes('rain') || lower.includes('shower')) return '🌧️';
  if (lower.includes('snow')) return '🌨️';
  if (lower.includes('overcast')) return '☁️';
  if (lower.includes('partly') && lower.includes('cloud')) return '⛅';
  if (lower.includes('mostly') && lower.includes('cloud')) return '🌥️';
  if (lower.includes('sunny') || lower.includes('clear')) return '☀️';

  return '❓';
}


/**
 * Get emoji for wind direction
 * Based on fishing_bot4.py:104-120
 * Note: Arrows point FROM the direction wind is coming from
 */
export function getWindDirEmoji(direction) {
  if (!direction) return '🧭';

  const dir = direction.toUpperCase();

  const mapping = {
    'N': '⬇️',
    'NNE': '⬇️',
    'NE': '↙️',
    'ENE': '↙️',
    'E': '⬅️',
    'ESE': '↖️',
    'SE': '↖️',
    'SSE': '⬆️',
    'S': '⬆️',
    'SSW': '⬆️',
    'SW': '↗️',
    'WSW': '↗️',
    'W': '➡️',
    'WNW': '↘️',
    'NW': '↘️',
    'NNW': '⬇️'
  };

  return mapping[dir] || '🧭';
}

/**
 * Get emoji for tide trend
 * Based on fishing_bot4.py:122-133
 */
export function getTrendEmoji(trend) {
  if (!trend) return '❔';

  const lower = trend.toLowerCase();

  if (lower.includes('rising')) return '📈';
  if (lower.includes('falling')) return '📉';
  if (lower.includes('steady')) return '➖';

  return '❔';
}

/**
 * Get emoji for pressure trend
 * Based on fishing_bot4.py:135-146
 */
export function getPressureTrendEmoji(trend) {
  if (!trend) return '➖';

  const lower = trend.toLowerCase();

  if (lower.includes('rising')) return '📈';
  if (lower.includes('falling')) return '📉';
  if (lower.includes('steady')) return '➖';

  return '➖';
}

/**
 * Get emoji for tide direction arrow
 * Based on fishing_bot4.py:148-153
 */
export function getTideDirArrow(prevKind, nextKind) {
  if (!prevKind || !nextKind) return '';

  const prev = prevKind.toLowerCase();
  const next = nextKind.toLowerCase();

  if (prev.includes('low') && next.includes('high')) return '↗️';
  if (prev.includes('high') && next.includes('low')) return '↘️';

  return '➡️';
}

/**
 * Get emoji for tide event kind
 */
export function getTideKindEmoji(kind) {
  if (!kind) return '🌊';

  const lower = kind.toLowerCase();

  if (lower.includes('high')) return '⬆️';
  if (lower.includes('low')) return '⬇️';

  return '🌊';
}

/**
 * Determine tide trend from two consecutive water levels
 * Based on fishing_bot4.py:353-360
 */
export function determineTrend(currentLevel, previousLevel, threshold = 0.05) {
  if (currentLevel === null || previousLevel === null) {
    return 'unknown';
  }

  const diff = currentLevel - previousLevel;

  if (diff > threshold) return 'rising';
  if (diff < -threshold) return 'falling';
  return 'steady';
}

/**
 * Calculate pressure trend from observations
 * Based on fishing_bot4.py:555-572
 */
export function calculatePressureTrend(observations, threshold = 0.03) {
  if (!observations || observations.length < 2) {
    return 'unknown';
  }

  // Sort by time (newest first)
  const sorted = [...observations].sort((a, b) => b.time - a.time);

  const newest = sorted[0]?.value;
  const oldest = sorted[sorted.length - 1]?.value;

  if (newest === null || oldest === null || newest === undefined || oldest === undefined) {
    return 'unknown';
  }

  const diff = newest - oldest;

  if (diff > threshold) return 'rising';
  if (diff < -threshold) return 'falling';
  return 'steady';
}


/**
 * Format wind description
 */
export function formatWind(wind) {
  if (!wind) return 'N/A';

  const parts = [];

  if (wind.speed !== null && wind.speed !== undefined) {
    parts.push(`${wind.speed.toFixed(1)} mph`);
  }

  if (wind.gust !== null && wind.gust !== undefined && wind.gust > (wind.speed || 0)) {
    parts.push(`gusts ${wind.gust.toFixed(1)}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'N/A';
}
