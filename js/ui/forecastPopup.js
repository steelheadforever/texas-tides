// Forecast popup content builder
// Generates 8-day forecast display with weather, tides, and sun/moon data

import { formatForecastDate } from '../utils/datetime.js';
import {
  getWeatherEmoji,
  getWindDirectionFromDegrees,
  formatWindSpeed,
  formatTempRange,
  formatPrecipProbability
} from '../utils/formatting.js';

/**
 * Build 8-day forecast popup content
 * @param {Object} forecastData - Combined forecast data (weather, sunMoon arrays)
 * @param {Object} station - Station information
 * @returns {string} HTML content for forecast popup
 */
export function buildForecastPopupContent(forecastData, station) {
  const { weather, sunMoon } = forecastData;

  // Build date header row
  const dateHeaders = weather.map(day => {
    const dateStr = formatForecastDate(day.date);
    return `<div class="forecast-date-cell">${dateStr}</div>`;
  }).join('');

  // Build daily forecast columns
  const dailyColumns = weather.map((day, index) => {
    const sunMoonData = sunMoon[index] || {};

    // Get weather emoji
    const weatherEmoji = getWeatherEmoji(day.icon);

    // Get wind direction
    const windDir = getWindDirectionFromDegrees(convertWindDirectionTodegrees(day.windDirection));

    // Format temperature
    const tempRange = formatTempRange(day.tempHigh, day.tempLow);

    // Format wind speed
    const windSpeedStr = formatWindSpeed(day.windSpeed, day.windGust);

    // Format precipitation
    const precipStr = formatPrecipProbability(day.precipProbability);

    return `
      <div class="forecast-day-column">
        <div class="forecast-row forecast-emoji">${weatherEmoji}</div>
        <div class="forecast-row forecast-description">${day.shortForecast || 'N/A'}</div>
        <div class="forecast-row forecast-temp">${tempRange}</div>
        <div class="forecast-row forecast-wind-dir">${windDir.emoji} ${windDir.text}</div>
        <div class="forecast-row forecast-wind-speed">${windSpeedStr}</div>
        <div class="forecast-row forecast-precip">${precipStr}</div>
        <div class="forecast-row forecast-sunrise">☀️↑ ${sunMoonData.sunrise || 'N/A'}</div>
        <div class="forecast-row forecast-sunset">☀️↓ ${sunMoonData.sunset || 'N/A'}</div>
        <div class="forecast-row forecast-moonrise">🌙↑ ${sunMoonData.moonrise || 'N/A'}</div>
        <div class="forecast-row forecast-moonset">🌙↓ ${sunMoonData.moonset || 'N/A'}</div>
        <div class="forecast-row forecast-moon-emoji">${sunMoonData.moonEmoji || '🌙'}</div>
        <div class="forecast-row forecast-moon-phase">${sunMoonData.moonPhase || 'N/A'}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="forecast-popup">
      <div class="forecast-header">
        <h2>${station.name || 'Station'} - 8-Day Forecast</h2>
        <button class="forecast-close" aria-label="Close forecast">×</button>
      </div>

      <div class="forecast-dates">
        ${dateHeaders}
      </div>

      <div class="forecast-chart-container section">
        <h3>8-Day Tide Forecast</h3>
        <canvas id="forecast-tide-chart"></canvas>
      </div>

      <div class="forecast-grid">
        ${dailyColumns}
      </div>
    </div>
  `;
}

/**
 * Convert wind direction text to degrees
 * Helper function to convert NWS text directions (N, NE, etc.) to degrees
 */
function convertWindDirectionTodegrees(direction) {
  if (!direction) return 0;

  const directionMap = {
    'N': 0,
    'NNE': 22.5,
    'NE': 45,
    'ENE': 67.5,
    'E': 90,
    'ESE': 112.5,
    'SE': 135,
    'SSE': 157.5,
    'S': 180,
    'SSW': 202.5,
    'SW': 225,
    'WSW': 247.5,
    'W': 270,
    'WNW': 292.5,
    'NW': 315,
    'NNW': 337.5
  };

  return directionMap[direction.toUpperCase()] || 0;
}
