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

  // Build weather emoji row
  const weatherEmojiRow = weather.map(day => {
    const weatherEmoji = getWeatherEmoji(day.icon);
    return `<div class="forecast-data-cell">${weatherEmoji}</div>`;
  }).join('');

  // Build weather description row
  const weatherDescRow = weather.map(day => {
    return `<div class="forecast-data-cell">${day.shortForecast || 'N/A'}</div>`;
  }).join('');

  // Build temperature row
  const tempRow = weather.map(day => {
    const tempRange = formatTempRange(day.tempHigh, day.tempLow);
    return `<div class="forecast-data-cell">${tempRange}</div>`;
  }).join('');

  // Build precipitation row
  const precipRow = weather.map(day => {
    const precipStr = formatPrecipProbability(day.precipProbability);
    return `<div class="forecast-data-cell">${precipStr}</div>`;
  }).join('');

  // Build wind direction row
  const windDirRow = weather.map(day => {
    const windDir = getWindDirectionFromDegrees(convertWindDirectionTodegrees(day.windDirection));
    return `<div class="forecast-data-cell">${windDir.emoji} ${windDir.text}</div>`;
  }).join('');

  // Build wind speed row
  const windSpeedRow = weather.map(day => {
    const windSpeedStr = formatWindSpeed(day.windSpeed, day.windGust);
    return `<div class="forecast-data-cell">${windSpeedStr}</div>`;
  }).join('');

  // Build sunrise row
  const sunriseRow = sunMoon.map(data => {
    return `<div class="forecast-data-cell">${data.sunrise || 'N/A'}</div>`;
  }).join('');

  // Build sunset row
  const sunsetRow = sunMoon.map(data => {
    return `<div class="forecast-data-cell">${data.sunset || 'N/A'}</div>`;
  }).join('');

  // Build moon phase row
  const moonPhaseRow = sunMoon.map(data => {
    return `<div class="forecast-data-cell">${data.moonEmoji || '🌙'} ${data.moonPhase || 'N/A'}</div>`;
  }).join('');

  // Build moonrise row
  const moonriseRow = sunMoon.map(data => {
    return `<div class="forecast-data-cell">${data.moonrise || 'N/A'}</div>`;
  }).join('');

  // Build moonset row
  const moonsetRow = sunMoon.map(data => {
    return `<div class="forecast-data-cell">${data.moonset || 'N/A'}</div>`;
  }).join('');

  return `
    <div class="forecast-popup">
      <div class="forecast-header">
        <h2>${station.name || 'Station'} - 7-Day Forecast</h2>
      </div>

      <div class="forecast-scroll-container">
        <!-- Date Headers -->
        <div class="forecast-table-row forecast-header-row">
          <div class="forecast-row-label"></div>
          ${dateHeaders}
        </div>

        <div class="forecast-chart-container">
          <canvas id="forecast-tide-chart"></canvas>
        </div>

        <div class="forecast-table-row">
          <div class="forecast-row-label">Conditions</div>
          ${weatherEmojiRow}
        </div>

        <div class="forecast-table-row">
          <div class="forecast-row-label">Description</div>
          ${weatherDescRow}
        </div>

        <div class="forecast-table-row">
          <div class="forecast-row-label">Temp Range</div>
          ${tempRow}
        </div>

        <div class="forecast-table-row">
          <div class="forecast-row-label">Precip</div>
          ${precipRow}
        </div>

        <div class="forecast-table-row">
          <div class="forecast-row-label">Direction</div>
          ${windDirRow}
        </div>

        <div class="forecast-table-row">
          <div class="forecast-row-label">Speed/Gusts</div>
          ${windSpeedRow}
        </div>

        <div class="forecast-table-row">
          <div class="forecast-row-label">Sunrise</div>
          ${sunriseRow}
        </div>

        <div class="forecast-table-row">
          <div class="forecast-row-label">Sunset</div>
          ${sunsetRow}
        </div>

        <div class="forecast-table-row">
          <div class="forecast-row-label">Phase</div>
          ${moonPhaseRow}
        </div>

        <div class="forecast-table-row">
          <div class="forecast-row-label">Moonrise</div>
          ${moonriseRow}
        </div>

        <div class="forecast-table-row">
          <div class="forecast-row-label">Moonset</div>
          ${moonsetRow}
        </div>
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
