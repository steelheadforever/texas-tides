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
        <h3 style="margin-bottom: 0.5rem;">Water Temperature Trend (Past 3 Hours)</h3>
        <canvas id="water-temp-chart" width="400" height="150"></canvas>
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
          <span>Observed:</span>
          <strong>${formatFeet(tideNow.observed)}</strong>
        </span>
        <span class="predicted">
          <span>Predicted:</span>
          <strong>${formatFeet(tideNow.predicted)}</strong>
        </span>
        <span class="delta">
          <span>Difference:</span>
          <strong>${formatDelta(tideNow.delta)}</strong>
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
    return '<div class="section"><p class="unavailable">Next tide data unavailable</p></div>';
  }

  const firstEmoji = getTideKindEmoji(nextTide.first.kind);
  const secondEmoji = nextTide.second ? getTideKindEmoji(nextTide.second.kind) : '';

  return `
    <div class="section next-tide">
      <h3>Next Tides ${firstEmoji}</h3>
      <p><strong>${nextTide.first.kind}</strong> at ${formatLocalTime(nextTide.first.time)} • ${formatFeet(nextTide.first.ft)}</p>
      ${nextTide.second ? `
        <p><strong>${nextTide.second.kind}</strong> at ${formatLocalTime(nextTide.second.time)} • ${formatFeet(nextTide.second.ft)}</p>
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
    <div class="section water-temp">
      <h3>Water Temperature 🌡️</h3>
      <p>${formatTemperature(waterTemp)}</p>
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
    <div class="section air-temp">
      <h3>Air Temperature 🌤️</h3>
      <p>${formatTemperature(airTemp)}</p>
    </div>
  `;
}

/**
 * Build current wind section
 */
function buildCurrentWindSection(wind) {
  if (!wind) {
    return '<div class="section wind-current"><h3>Current Wind 💨</h3><p class="unavailable">No data</p></div>';
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
    <div class="section wind-current">
      <h3>Current Wind 💨 ${dirEmoji}</h3>
      <p>${formatWind(windObj)} • ${wind.direction || 'N/A'}</p>
    </div>
  `;
}

/**
 * Build wind forecast section
 */
function buildWindForecastSection(windForecast) {
  if (!windForecast) {
    return '<div class="section wind-forecast"><h3>Wind Next 12h 🧭</h3><p class="unavailable">No data</p></div>';
  }

  const dirEmoji = getWindDirEmoji(windForecast.direction);

  const avg = windForecast.avgSpeed !== null ? windForecast.avgSpeed.toFixed(1) : 'N/A';
  const max = windForecast.maxSpeed !== null ? windForecast.maxSpeed.toFixed(1) : 'N/A';

  return `
    <div class="section wind-forecast">
      <h3>Wind Next 12h 🧭 ${dirEmoji}</h3>
      <p>Avg: ${avg} mph • Max: ${max} mph</p>
      <p>Direction: ${windForecast.direction || 'N/A'}</p>
    </div>
  `;
}

/**
 * Build pressure section
 */
function buildPressureSection(pressure) {
  if (!pressure) {
    return '<div class="section pressure"><h3>Barometric Pressure</h3><p class="unavailable">No data</p></div>';
  }

  const trendEmoji = getPressureTrendEmoji(pressure.trend);

  return `
    <div class="section pressure">
      <h3>Barometric Pressure ${trendEmoji}</h3>
      <p>${formatPressure(pressure.value)} • ${pressure.trend || 'unknown'}</p>
    </div>
  `;
}

/**
 * Build sky conditions section
 */
function buildConditionsSection(windForecast) {
  if (!windForecast || !windForecast.condition) {
    return '<div class="section conditions"><h3>Sky Conditions</h3><p class="unavailable">No data</p></div>';
  }

  const conditionEmoji = getConditionsEmoji(windForecast.condition);

  return `
    <div class="section conditions">
      <h3>Sky Conditions ${conditionEmoji}</h3>
      <p>${windForecast.condition}</p>
    </div>
  `;
}

/**
 * Build sun section (sunrise/sunset)
 */
function buildSunSection(sunMoon) {
  if (!sunMoon || !sunMoon.sun) {
    return '<div class="section sun"><h3>Sun ☀️</h3><p class="unavailable">No data</p></div>';
  }

  const { rise, set } = sunMoon.sun;

  return `
    <div class="section sun">
      <h3>Sun ☀️</h3>
      <p>Rise: ${rise} • Set: ${set}</p>
    </div>
  `;
}

/**
 * Build moon section (phase, rise/set)
 */
function buildMoonSection(sunMoon) {
  if (!sunMoon || !sunMoon.moon) {
    return '<div class="section moon"><h3>Moon 🌙</h3><p class="unavailable">No data</p></div>';
  }

  const { rise, set } = sunMoon.moon;
  const moonPhase = sunMoon.moonPhase || 'Unknown Phase';
  const moonEmoji = getMoonEmoji(moonPhase);

  return `
    <div class="section moon">
      <h3>Moon ${moonEmoji}</h3>
      <p>${moonPhase}</p>
      <p>Rise: ${rise} • Set: ${set}</p>
    </div>
  `;
}
