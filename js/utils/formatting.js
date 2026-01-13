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
    parts.push(`gusts ${wind.gust.toFixed(1)} mph`);
  }

  return parts.length > 0 ? parts.join(', ') : 'N/A';
}

/**
 * Get weather emoji from NWS icon URL or code
 * NWS provides icon URLs like: https://api.weather.gov/icons/land/day/tsra,40?size=medium
 */
export function getWeatherEmoji(iconUrl) {
  if (!iconUrl) return '❓';

  const lower = iconUrl.toLowerCase();

  // Extract weather code from URL (e.g., "tsra" from "land/day/tsra,40")
  if (lower.includes('tsra') || lower.includes('thunderstorm')) return '⛈️';
  if (lower.includes('rain') || lower.includes('rain_showers')) return '🌧️';
  if (lower.includes('snow') || lower.includes('blizzard')) return '🌨️';
  if (lower.includes('fog')) return '🌫️';
  if (lower.includes('wind') || lower.includes('wind_bkn') || lower.includes('wind_few')) return '💨';
  if (lower.includes('skc') || lower.includes('few') || lower.includes('sunny')) return '☀️';
  if (lower.includes('sct') || lower.includes('partly')) return '⛅';
  if (lower.includes('bkn') || lower.includes('mostly')) return '🌥️';
  if (lower.includes('ovc') || lower.includes('overcast')) return '☁️';
  if (lower.includes('cold')) return '❄️';
  if (lower.includes('hot')) return '🔥';

  return '❓';
}

/**
 * Convert wind direction degrees to arrow emoji and letters
 * Returns object with emoji and text (e.g., {emoji: '⬇️', text: 'N'})
 */
export function getWindDirectionFromDegrees(degrees) {
  if (degrees === null || degrees === undefined || isNaN(degrees)) {
    return { emoji: '🧭', text: 'N/A' };
  }

  // Normalize to 0-360
  const normalized = ((degrees % 360) + 360) % 360;

  // Convert degrees to direction
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(normalized / 22.5) % 16;
  const directionText = directions[index];

  // Get emoji using existing function
  const emoji = getWindDirEmoji(directionText);

  return { emoji, text: directionText };
}

/**
 * Format wind speed and gust range
 * Format: "10-15 mph, gusts 20"
 */
export function formatWindSpeed(speed, gust) {
  if (speed === null || speed === undefined || isNaN(speed)) {
    return 'N/A';
  }

  const parts = [];

  // If gust is different from speed, show range
  if (gust && gust > speed) {
    // Only show range if speed and gust are meaningfully different
    parts.push(`${speed}-${gust} mph`);
    // Add separate gust callout if significantly higher
    if (gust > speed * 1.3) {
      parts.push(`gusts ${gust} mph`);
    }
  } else {
    // If speed equals gust (or no gust), just show single speed
    parts.push(`${speed} mph`);
  }

  return parts.join(', ');
}

/**
 * Format temperature range (high/low)
 * Format: "H: 68° L: 52°"
 */
export function formatTempRange(high, low) {
  const parts = [];

  if (high !== null && high !== undefined && !isNaN(high)) {
    parts.push(`H: ${Math.round(high)}°`);
  }

  if (low !== null && low !== undefined && !isNaN(low)) {
    parts.push(`L: ${Math.round(low)}°`);
  }

  return parts.length > 0 ? parts.join(' ') : 'N/A';
}

/**
 * Format precipitation probability
 * Format: "🌧️ 20%"
 */
export function formatPrecipProbability(percent) {
  if (percent === null || percent === undefined || isNaN(percent)) {
    return '🌧️ 0%';
  }

  return `🌧️ ${Math.round(percent)}%`;
}
