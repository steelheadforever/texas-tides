// Station popup content generation
// Based on fishing_bot4.py embed building (lines 620-703)

import { formatLocalTime } from '../utils/datetime.js';
import { formatFeet, formatDelta, formatTemperature, formatPressure, mphFromKnots } from '../utils/conversions.js';
import {
  getConditionsEmoji,
  getWindDirEmoji,
  getTrendEmoji,
  getPressureTrendEmoji,
  getTideKindEmoji,
  formatWind
} from '../utils/formatting.js';
import { getMoonEmoji } from '../api/usno.js';

/**
 * Build complete popup content HTML
 */
export function buildPopupContent(station, data) {
  const {
    tideNow,
    nextTide,
    waterTemp,
    waterTempHistory,
    airTemp,
    wind,
    windForecast,
    pressure,
    sunMoon
  } = data;

  return `
    <div class="station-popup">
      <h2>${station.name}</h2>

      <div class="two-column-row">
        ${buildTideStatusSection(tideNow)}
        ${buildNextTideSection(nextTide)}
      </div>

      <div class="section chart-container">
        <canvas id="tide-chart" width="400" height="200"></canvas>
      </div>

      <div class="two-column-row">
        ${buildWaterTempSection(waterTemp)}
        ${buildAirTempSection(airTemp)}
      </div>

      ${waterTempHistory && waterTempHistory.length > 0 ? `
      <div class="section chart-container">
        <h3 style="margin-bottom: 0.5rem;">Water Temperature Trend (Past 24 Hours)</h3>
        <canvas id="water-temp-chart" width="400" height="200"></canvas>
      </div>
      ` : ''}

      <div class="two-column-row">
        ${buildCurrentWindSection(wind)}
        ${buildWindForecastSection(windForecast)}
      </div>

      <div class="two-column-row">
        ${buildPressureSection(pressure)}
        ${buildConditionsSection(windForecast)}
      </div>

      <div class="two-column-row">
        ${buildSunSection(sunMoon)}
        ${buildMoonSection(sunMoon)}
      </div>

      <div class="section" style="border-left: none; background: none; padding: 0.25rem; margin-top: 1rem;">
        <p style="font-size: 0.75rem; color: #999; text-align: center;">
          Station ID: ${station.id} • Data from NOAA & NWS
        </p>
      </div>

      <button class="forecast-button"
              data-station-id="${station.id}"
              data-station-name="${station.name}"
              data-lat="${station.lat}"
              data-lon="${station.lon}">
        Forecast
      </button>
    </div>
  `;
}

/**
 * Build tide status section
 */
function buildTideStatusSection(tideNow) {
  if (!tideNow) {
    return '<div class="section"><p class="unavailable">Tide data unavailable</p></div>';
  }

  const trendEmoji = getTrendEmoji(tideNow.trend);

  return `
    <div class="section tide-status">
      <h3>Tide Status ${trendEmoji}</h3>
      <div class="tide-levels">
        <span class="observed">
          <strong>Observed:</strong>
          <span>${formatFeet(tideNow.observed)}</span>
        </span>
        <span class="predicted">
          <strong>Predicted:</strong>
          <span>${formatFeet(tideNow.predicted)}</span>
        </span>
        <span class="delta">
          <strong>Difference:</strong>
          <span>${formatDelta(tideNow.delta)}</span>
        </span>
      </div>
      ${tideNow.phaseText && tideNow.phaseText !== 'n/a' ? `
        <div class="phase">${tideNow.phaseText}</div>
      ` : ''}
    </div>
  `;
}

/**
 * Build next tide section (shows next two tide events)
 */
function buildNextTideSection(nextTide) {
  if (!nextTide || !nextTide.first) {
    return '<div class="section next-tide"><h3>Next Tides</h3><p class="unavailable">NOAA predicted tides unavailable for this location.</p></div>';
  }

  const firstEmoji = getTideKindEmoji(nextTide.first.kind);
  const secondEmoji = nextTide.second ? getTideKindEmoji(nextTide.second.kind) : '';

  return `
    <div class="section next-tide">
      <h3>Next Tides</h3>
      <div class="tide-event">
        <span class="tide-kind">${firstEmoji} ${nextTide.first.kind}</span>
        <span class="tide-time">${formatLocalTime(nextTide.first.time)}</span>
        <span class="tide-height">${formatFeet(nextTide.first.ft)}</span>
      </div>
      ${nextTide.second ? `
      <div class="tide-event">
        <span class="tide-kind">${secondEmoji} ${nextTide.second.kind}</span>
        <span class="tide-time">${formatLocalTime(nextTide.second.time)}</span>
        <span class="tide-height">${formatFeet(nextTide.second.ft)}</span>
      </div>
      ` : ''}
    </div>
  `;
}

/**
 * Build water temperature section
 */
function buildWaterTempSection(waterTemp) {
  if (waterTemp === null || waterTemp === undefined) {
    return ''; // Don't show section if no data
  }

  return `
    <div class="section compact water-temp">
      <h3>Water 🌡️</h3>
      <div class="data-row">
        <span class="data-value">${formatTemperature(waterTemp)}</span>
      </div>
    </div>
  `;
}

/**
 * Build air temperature section
 */
function buildAirTempSection(airTemp) {
  if (airTemp === null || airTemp === undefined) {
    return ''; // Don't show section if no data
  }

  return `
    <div class="section compact air-temp">
      <h3>Air 🌤️</h3>
      <div class="data-row">
        <span class="data-value">${formatTemperature(airTemp)}</span>
      </div>
    </div>
  `;
}

/**
 * Build current wind section
 */
function buildCurrentWindSection(wind) {
  if (!wind) {
    return '<div class="section compact wind-current"><h3>Wind Now 💨</h3><p class="unavailable">No data</p></div>';
  }

  const dirEmoji = getWindDirEmoji(wind.direction);

  // Convert knots to mph
  const speedMph = wind.speed !== null ? mphFromKnots(wind.speed) : null;
  const gustMph = wind.gust !== null ? mphFromKnots(wind.gust) : null;

  const windObj = {
    speed: speedMph,
    gust: gustMph
  };

  return `
    <div class="section compact wind-current">
      <h3>Wind Now 💨 ${dirEmoji}</h3>
      <div class="data-row">
        <span class="data-value">${formatWind(windObj)}</span>
        <span>${wind.direction || ''}</span>
      </div>
    </div>
  `;
}

/**
 * Build wind forecast section
 */
function buildWindForecastSection(windForecast) {
  if (!windForecast) {
    return '<div class="section compact wind-forecast"><h3>Wind 12h 🧭</h3><p class="unavailable">No data</p></div>';
  }

  const dirEmoji = getWindDirEmoji(windForecast.direction);

  const avg = windForecast.avgSpeed !== null ? windForecast.avgSpeed.toFixed(0) : 'N/A';
  const max = windForecast.maxSpeed !== null ? windForecast.maxSpeed.toFixed(0) : 'N/A';

  // Show single value if avg equals max, otherwise show range
  const windDisplay = (avg === max) ? `${avg} mph` : `${avg}-${max} mph`;

  return `
    <div class="section compact wind-forecast">
      <h3>Wind 12h 🧭 ${dirEmoji}</h3>
      <div class="data-row">
        <span>${windDisplay}</span>
        <span>${windForecast.direction || ''}</span>
      </div>
    </div>
  `;
}

/**
 * Build pressure section
 */
function buildPressureSection(pressure) {
  if (!pressure) {
    return '<div class="section compact pressure"><h3>Pressure</h3><p class="unavailable">No data</p></div>';
  }

  const trendEmoji = getPressureTrendEmoji(pressure.trend);

  return `
    <div class="section compact pressure">
      <h3>Pressure ${trendEmoji}</h3>
      <div class="data-row">
        <span class="data-value">${formatPressure(pressure.value)}</span>
        <span>${pressure.trend || ''}</span>
      </div>
    </div>
  `;
}

/**
 * Build sky conditions section
 */
function buildConditionsSection(windForecast) {
  if (!windForecast || !windForecast.condition) {
    return '<div class="section compact conditions"><h3>Sky</h3><p class="unavailable">No data</p></div>';
  }

  const conditionEmoji = getConditionsEmoji(windForecast.condition);

  return `
    <div class="section compact conditions">
      <h3>Sky ${conditionEmoji}</h3>
      <div class="data-row">
        <span class="data-value">${windForecast.condition}</span>
      </div>
    </div>
  `;
}

/**
 * Build sun section (sunrise/sunset)
 */
function buildSunSection(sunMoon) {
  if (!sunMoon || !sunMoon.sun) {
    return '<div class="section compact sun"><h3>Sun ☀️</h3><p class="unavailable">No data</p></div>';
  }

  const { rise, set } = sunMoon.sun;

  return `
    <div class="section compact sun">
      <h3>Sun ☀️</h3>
      <p><strong>Rise:</strong> ${rise}</p>
      <p><strong>Set:</strong> ${set}</p>
    </div>
  `;
}

/**
 * Build moon section (phase, rise/set)
 */
function buildMoonSection(sunMoon) {
  if (!sunMoon || !sunMoon.moon) {
    return '<div class="section compact moon"><h3>Moon 🌙</h3><p class="unavailable">No data</p></div>';
  }

  const { rise, set } = sunMoon.moon;
  const moonPhase = sunMoon.moonPhase || 'Unknown';
  const moonEmoji = getMoonEmoji(moonPhase);

  return `
    <div class="section compact moon">
      <h3>${moonPhase} ${moonEmoji}</h3>
      <p><strong>Rise:</strong> ${rise}</p>
      <p><strong>Set:</strong> ${set}</p>
    </div>
  `;
}
