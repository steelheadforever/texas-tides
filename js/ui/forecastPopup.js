// Forecast popup content builder
// Generates 7-day forecast display with vertical day cards

import { formatForecastDate } from '../utils/datetime.js';
import {
  getWeatherEmoji,
  getWindDirectionFromDegrees,
  formatWindSpeed,
  formatTempRange,
  formatPrecipProbability
} from '../utils/formatting.js';

/**
 * Build 7-day forecast popup content as vertical day cards
 * @param {Object} forecastData - Combined forecast data (weather, sunMoon arrays)
 * @param {Object} station - Station information
 * @returns {string} HTML content for forecast popup
 */
export function buildForecastPopupContent(forecastData, station) {
  const { weather, sunMoon } = forecastData;

  // Build individual day cards
  const dayCards = weather.map((day, index) => {
    const sunMoonData = sunMoon[index] || {};
    return buildDayCard(day, sunMoonData, index);
  }).join('');

  return `
    <div class="forecast-popup">
      <div class="forecast-header">
        <h2>${station.name || 'Station'} - 7-Day Forecast</h2>
      </div>

      <div class="forecast-scroll-container">
        <div class="forecast-cards-grid">
          ${dayCards}
        </div>
      </div>
    </div>
  `;
}

/**
 * Build a single day card with all forecast information
 * @param {Object} weather - Weather data for the day
 * @param {Object} sunMoon - Sun/moon data for the day
 * @param {number} dayIndex - Day index (0-6)
 * @returns {string} HTML for day card
 */
function buildDayCard(weather, sunMoon, dayIndex) {
  const dateStr = formatForecastDate(weather.date);
  const weatherEmoji = getWeatherEmoji(weather.icon);
  const tempRange = formatTempRange(weather.tempHigh, weather.tempLow);
  const precipStr = formatPrecipProbability(weather.precipProbability);
  const windDir = getWindDirectionFromDegrees(convertWindDirectionTodegrees(weather.windDirection));
  const windSpeedStr = formatWindSpeed(weather.windSpeed, weather.windGust);

  return `
    <div class="day-card">
      <div class="day-card-header">${dateStr}</div>

      <div class="day-card-chart">
        <canvas id="day-tide-chart-${dayIndex}" width="120" height="60"></canvas>
      </div>

      <div class="day-card-item">
        <div class="day-card-icon">${weatherEmoji}</div>
      </div>

      <div class="day-card-item">
        <div class="day-card-label">Conditions</div>
        <div class="day-card-value">${weather.shortForecast || 'N/A'}</div>
      </div>

      <div class="day-card-item">
        <div class="day-card-label">Temp</div>
        <div class="day-card-value">${tempRange}</div>
      </div>

      <div class="day-card-item">
        <div class="day-card-label">Precip</div>
        <div class="day-card-value">${precipStr}</div>
      </div>

      <div class="day-card-item">
        <div class="day-card-label">Wind</div>
        <div class="day-card-value">${windDir.emoji} ${windDir.text}</div>
        <div class="day-card-value-sub">${windSpeedStr}</div>
      </div>

      <div class="day-card-item">
        <div class="day-card-label">Sun</div>
        <div class="day-card-value">↑ ${sunMoon.sunrise || 'N/A'}</div>
        <div class="day-card-value-sub">↓ ${sunMoon.sunset || 'N/A'}</div>
      </div>

      <div class="day-card-item">
        <div class="day-card-label">Moon</div>
        <div class="day-card-value">${sunMoon.moonEmoji || '🌙'} ${sunMoon.moonPhase || 'N/A'}</div>
        <div class="day-card-value-sub">↑ ${sunMoon.moonrise || 'N/A'} ↓ ${sunMoon.moonset || 'N/A'}</div>
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
