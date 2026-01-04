// NOAA CO-OPS API functions
// Based on fishing_bot4.py:246-484
// API Documentation: https://api.tidesandcurrents.noaa.gov/api/prod/

import { parseNOAALocalTime, getDateRange } from '../utils/datetime.js';
import { safeFloat } from '../utils/conversions.js';
import { determineTrend, getTideDirArrow } from '../utils/formatting.js';
import { fetchNWSTemperature } from './nws.js';

const NOAA_BASE_URL = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
const REQUEST_TIMEOUT = 10000; // 10 seconds

/**
 * Base NOAA API request function
 * Based on fishing_bot4.py:246-258
 */
async function noaaGet(params) {
  const baseParams = {
    units: 'english',
    time_zone: 'lst_ldt',
    format: 'json',
    application: 'texas_tides_web'
  };

  const allParams = { ...baseParams, ...params };
  const url = new URL(NOAA_BASE_URL);
  Object.keys(allParams).forEach(key => {
    if (allParams[key] !== null && allParams[key] !== undefined) {
      url.searchParams.append(key, allParams[key]);
    }
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(url.toString(), {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    // NOAA returns {error: {...}} on failure
    if (data.error) {
      console.warn('NOAA API error:', data.error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('NOAA fetch failed:', err.message);
    return null;
  }
}

/**
 * Fetch latest value for a product
 * Based on fishing_bot4.py:268-279
 */
async function fetchNOAALatestValue(stationId, product, useDatum = false) {
  const params = {
    station: stationId,
    product: product,
    date: 'latest'
  };

  if (useDatum) {
    params.datum = 'MLLW';
  }

  const data = await noaaGet(params);

  if (!data || !data.data || data.data.length === 0) {
    return null;
  }

  const value = safeFloat(data.data[0].v);
  return value;
}

/**
 * Fetch water level (observed tide)
 * Based on fishing_bot4.py:281-289
 */
async function fetchWaterLevel(stationId) {
  return await fetchNOAALatestValue(stationId, 'water_level', true);
}

/**
 * Fetch water temperature
 * Based on fishing_bot4.py:453-461
 */
export async function fetchWaterTemp(stationId) {
  return await fetchNOAALatestValue(stationId, 'water_temperature', false);
}

/**
 * Fetch air temperature
 * Tries NOAA station first, falls back to NWS if not available
 */
export async function fetchAirTemp(stationId, lat, lon) {
  // Try NOAA station first
  const noaaTemp = await fetchNOAALatestValue(stationId, 'air_temperature', false);

  if (noaaTemp !== null) {
    return noaaTemp;
  }

  // Fall back to NWS if NOAA doesn't have air temperature
  console.log(`No air temp from NOAA station ${stationId}, trying NWS for (${lat}, ${lon})`);
  return await fetchNWSTemperature(lat, lon);
}

/**
 * Fetch water temperature history over a time range
 * Returns array of {time, temp} objects for the past 2 hours
 */
export async function fetchWaterTempHistory(stationId, hoursBack = 2) {
  const range = getDateRange(-hoursBack, 0);

  const params = {
    station: stationId,
    product: 'water_temperature',
    begin_date: range.begin,
    end_date: range.end,
    interval: '6' // 6-minute intervals
  };

  const data = await noaaGet(params);

  if (!data || !data.data || data.data.length === 0) {
    return [];
  }

  return data.data.map(obs => ({
    time: parseNOAALocalTime(obs.t),
    temp: safeFloat(obs.v)
  }));
}

/**
 * Fetch predictions over a time range
 * Based on fishing_bot4.py:291-312
 */
async function fetchPredictions(stationId, beginDate, endDate, interval = '6') {
  const params = {
    station: stationId,
    product: 'predictions',
    datum: 'MLLW',
    begin_date: beginDate,
    end_date: endDate,
    interval: interval
  };

  const data = await noaaGet(params);

  if (!data || !data.predictions || data.predictions.length === 0) {
    return [];
  }

  return data.predictions.map(pred => ({
    time: parseNOAALocalTime(pred.t),
    ft: safeFloat(pred.v)
  }));
}

/**
 * Fetch observed water levels over a time range
 * Uses water_level product to get actual measured tide heights
 */
async function fetchObservedWaterLevels(stationId, hoursBack = 6) {
  const range = getDateRange(-hoursBack, 0);

  const params = {
    station: stationId,
    product: 'water_level',
    datum: 'MLLW',
    begin_date: range.begin,
    end_date: range.end,
    interval: '6' // 6-minute intervals to match predictions
  };

  const data = await noaaGet(params);

  if (!data || !data.data || data.data.length === 0) {
    return [];
  }

  return data.data.map(obs => ({
    time: parseNOAALocalTime(obs.t),
    ft: safeFloat(obs.v)
  }));
}

/**
 * Fetch 24-hour tide curve with both observed and predicted data
 * Observed: past 6 hours of actual measurements
 * Predicted: next 24 hours of predictions
 */
export async function fetch24HourCurve(stationId) {
  // Fetch predictions from 6 hours ago to 24 hours ahead
  // This ensures the predicted curve covers the same timeframe as observed data (past 6 hours)
  // plus the next 24 hours, allowing comparison of predicted vs actual for the past period
  const range = getDateRange(-6, 24);

  // Fetch both observed and predicted data in parallel
  const [predictions, observed] = await Promise.all([
    fetchPredictions(
      stationId,
      range.begin,
      range.end,
      '6' // 6-minute intervals for smooth curve
    ),
    fetchObservedWaterLevels(stationId, 6) // Past 6 hours of observations
  ]);

  if (!predictions || predictions.length === 0) {
    return null;
  }

  const now = new Date();
  let nowIndex = 0;

  // Find closest prediction to current time
  let minDiff = Infinity;
  predictions.forEach((pred, idx) => {
    const diff = Math.abs(pred.time - now);
    if (diff < minDiff) {
      minDiff = diff;
      nowIndex = idx;
    }
  });

  // Return both datasets
  return {
    predicted: {
      times: predictions.map(p => p.time),
      heights: predictions.map(p => p.ft)
    },
    observed: (observed && observed.length > 0) ? {
      times: observed.map(o => o.time),
      heights: observed.map(o => o.ft)
    } : null,
    nowIndex: nowIndex
  };
}

/**
 * Fetch high/low tide events
 * Based on fishing_bot4.py:327-349
 */
async function fetchHiloEvents(stationId, days = 1) {
  const range = getDateRange(0, days * 24);

  const params = {
    station: stationId,
    product: 'predictions',
    datum: 'MLLW',
    begin_date: range.begin,
    end_date: range.end,
    interval: 'hilo'
  };

  const data = await noaaGet(params);

  if (!data || !data.predictions || data.predictions.length === 0) {
    return [];
  }

  return data.predictions.map(pred => ({
    time: parseNOAALocalTime(pred.t),
    ft: safeFloat(pred.v),
    kind: pred.type === 'H' ? 'High' : 'Low'
  }));
}

/**
 * Fetch next two tide events (high/low)
 * Based on fishing_bot4.py:351-369
 */
export async function fetchNextTide(stationId) {
  const events = await fetchHiloEvents(stationId, 2);

  if (!events || events.length === 0) {
    return null;
  }

  const now = new Date();

  // Find all events after now, return first two chronologically
  const futureEvents = events.filter(e => e.time > now);

  if (futureEvents.length === 0) {
    return null;
  }

  // Return up to 2 events
  return {
    first: futureEvents[0] || null,
    second: futureEvents[1] || null
  };
}

/**
 * Compute tide phase (% through current cycle)
 * Based on fishing_bot4.py:411-441
 */
function computePhaseFromHilo(events, now = new Date()) {
  if (!events || events.length < 2) {
    return { text: 'n/a', prevEvent: null, nextEvent: null };
  }

  let prevEvent = null;
  let nextEvent = null;

  for (const event of events) {
    if (event.time <= now) {
      prevEvent = event;
    } else if (event.time > now && !nextEvent) {
      nextEvent = event;
      break;
    }
  }

  if (!prevEvent || !nextEvent) {
    return { text: 'n/a', prevEvent, nextEvent };
  }

  const total = (nextEvent.time - prevEvent.time) / 1000; // milliseconds to seconds
  const elapsed = (now - prevEvent.time) / 1000;
  const frac = elapsed / total;
  const pct = Math.round(frac * 100);

  const arrow = getTideDirArrow(prevEvent.kind, nextEvent.kind);
  const text = `${pct}% ${prevEvent.kind}→${nextEvent.kind} ${arrow}`;

  return { text, prevEvent, nextEvent };
}

/**
 * Fetch current tide status (observed vs predicted)
 * Based on fishing_bot4.py:371-409
 */
export async function fetchTideNow(stationId) {
  // Fetch observed water level
  const observed = await fetchWaterLevel(stationId);

  // Fetch current prediction
  const now = new Date();
  const range = getDateRange(0, 1);
  const predictions = await fetchPredictions(stationId, range.begin, range.end, '6');

  let predicted = null;
  if (predictions && predictions.length > 0) {
    // Find closest prediction to now
    let minDiff = Infinity;
    predictions.forEach(pred => {
      const diff = Math.abs(pred.time - now);
      if (diff < minDiff) {
        minDiff = diff;
        predicted = pred.ft;
      }
    });
  }

  // Calculate delta
  let delta = null;
  if (observed !== null && predicted !== null) {
    delta = observed - predicted;
  }

  // Determine trend (rising/falling)
  let trend = 'unknown';
  if (predictions && predictions.length >= 2) {
    const sorted = [...predictions].sort((a, b) => a.time - b.time);
    const nowIdx = sorted.findIndex(p => p.time >= now);

    if (nowIdx > 0 && nowIdx < sorted.length) {
      const current = sorted[nowIdx]?.ft;
      const previous = sorted[nowIdx - 1]?.ft;
      trend = determineTrend(current, previous);
    }
  }

  // Fetch high/low events for phase calculation
  const events = await fetchHiloEvents(stationId, 2);
  const phase = computePhaseFromHilo(events, now);

  return {
    observed,
    predicted,
    delta,
    trend,
    phaseText: phase.text
  };
}

/**
 * Fetch station wind data
 * Based on fishing_bot4.py:463-484
 */
export async function fetchStationWind(stationId) {
  const params = {
    station: stationId,
    product: 'wind',
    date: 'latest'
  };

  const data = await noaaGet(params);

  if (!data || !data.data || data.data.length === 0) {
    return null;
  }

  const windData = data.data[0];

  return {
    speed: safeFloat(windData.s), // knots
    gust: safeFloat(windData.g), // knots
    direction: windData.dr || 'N/A', // direction text (N, NE, etc.)
    directionDegrees: safeFloat(windData.d) // direction in degrees
  };
}

