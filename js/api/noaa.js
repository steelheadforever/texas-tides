// NOAA CO-OPS API functions
// Based on fishing_bot4.py:246-484
// API Documentation: https://api.tidesandcurrents.noaa.gov/api/prod/

import { parseNOAALocalTime, getDateRange } from '../utils/datetime.js';
import { safeFloat } from '../utils/conversions.js';
import { determineTrend, getTideDirArrow } from '../utils/formatting.js';

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
export async function fetchNOAALatestValue(stationId, product, useDatum = false) {
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
export async function fetchWaterLevel(stationId) {
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
 * Fetch predictions over a time range
 * Based on fishing_bot4.py:291-312
 */
export async function fetchPredictions(stationId, beginDate, endDate, interval = '6') {
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
 * Fetch 24-hour tide curve predictions (with 2 hours of past data)
 * Based on fishing_bot4.py:314-325
 */
export async function fetch24HourCurve(stationId) {
  // Fetch from 2 hours ago to 22 hours ahead (total 24 hours)
  const range = getDateRange(-2, 22);

  const predictions = await fetchPredictions(
    stationId,
    range.begin,
    range.end,
    '6' // 6-minute intervals for smooth curve
  );

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

  return {
    times: predictions.map(p => p.time),
    heights: predictions.map(p => p.ft),
    nowIndex: nowIndex
  };
}

/**
 * Fetch high/low tide events
 * Based on fishing_bot4.py:327-349
 */
export async function fetchHiloEvents(stationId, days = 1) {
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
 * Fetch next high or low tide
 * Based on fishing_bot4.py:351-369
 */
export async function fetchNextTide(stationId) {
  const events = await fetchHiloEvents(stationId, 2);

  if (!events || events.length === 0) {
    return null;
  }

  const now = new Date();

  // Find first event after now
  const nextEvent = events.find(e => e.time > now);

  return nextEvent || null;
}

/**
 * Compute tide phase (% through current cycle)
 * Based on fishing_bot4.py:411-441
 */
export function computePhaseFromHilo(events, now = new Date()) {
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

/**
 * Fetch air pressure from station
 */
export async function fetchAirPressure(stationId) {
  return await fetchNOAALatestValue(stationId, 'air_pressure', false);
}
