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
  const { weather, sunMoon, tidePredictions } = forecastData;

  // Build individual day cards
  const dayCards = weather.map((day, index) => {
    const sunMoonData = sunMoon[index] || {};
    const tideTimesData = getTideTimesForDay(index, tidePredictions || []);
    return buildDayCard(day, sunMoonData, tideTimesData, index);
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
 * @param {Object} tideTimes - Tide high/low times for the day
 * @param {number} dayIndex - Day index (0-6)
 * @returns {string} HTML for day card
 */
function buildDayCard(weather, sunMoon, tideTimes, dayIndex) {
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
        <div class="day-card-label">Tides</div>
        <div class="day-card-value">High: ${tideTimes.high || 'N/A'}</div>
        <div class="day-card-value-sub">Low: ${tideTimes.low || 'N/A'}</div>
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
 * Get high and low tide times for a specific day
 * @param {number} dayIndex - Day index (0-6)
 * @param {Array} tidePredictions - Full 7-day tide prediction array
 * @returns {Object} Object with high and low tide times formatted
 */
function getTideTimesForDay(dayIndex, tidePredictions) {
  if (!tidePredictions || tidePredictions.length === 0) {
    return { high: 'N/A', low: 'N/A' };
  }

  // Calculate midnight boundaries for this specific day
  const now = new Date();
  const midnightToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const dayStart = new Date(midnightToday);
  dayStart.setDate(midnightToday.getDate() + dayIndex);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayStart.getDate() + 1);

  // Filter predictions for just this day
  const dayPredictions = tidePredictions.filter(pred => {
    const predTime = pred.time;
    return predTime >= dayStart && predTime < dayEnd;
  });

  if (dayPredictions.length === 0) {
    return { high: 'N/A', low: 'N/A' };
  }

  // Find highest and lowest tide values
  let highTide = dayPredictions[0];
  let lowTide = dayPredictions[0];

  for (const pred of dayPredictions) {
    if (pred.ft > highTide.ft) {
      highTide = pred;
    }
    if (pred.ft < lowTide.ft) {
      lowTide = pred;
    }
  }

  // Format times as "h:MM AM/PM"
  const formatTime = (date) => {
    return date.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return {
    high: formatTime(highTide.time),
    low: formatTime(lowTide.time)
  };
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
