import fetch from 'node-fetch';

const NOAA_BASE_URL = process.env.NOAA_BASE_URL || 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT) || 10000;
const NOAA_APP_ID = process.env.NOAA_APP_ID || 'slackwater_backend';

/**
 * Base NOAA API request function
 * Makes a GET request to NOAA CO-OPS API with standard parameters
 */
export async function noaaGet(params) {
  const baseParams = {
    units: 'english',
    time_zone: 'lst_ldt',
    format: 'json',
    application: NOAA_APP_ID
  };

  const allParams = { ...baseParams, ...params };
  const url = new URL(NOAA_BASE_URL);

  Object.keys(allParams).forEach(key => {
    if (allParams[key] !== null && allParams[key] !== undefined) {
      url.searchParams.append(key, allParams[key]);
    }
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    // NOAA returns {error: {...}} on failure
    if (data.error) {
      console.warn('NOAA API error:', data.error);
      return { error: data.error };
    }

    return data;
  } catch (err) {
    console.error('NOAA fetch failed:', err.message);
    if (err.name === 'AbortError') {
      return { error: { message: 'Request timeout' } };
    }
    return { error: { message: err.message } };
  }
}

/**
 * Fetch latest value for a product
 */
export async function fetchLatestValue(stationId, product, useDatum = false) {
  const params = {
    station: stationId,
    product: product,
    date: 'latest'
  };

  if (useDatum) {
    params.datum = 'MLLW';
  }

  const data = await noaaGet(params);

  if (data.error || !data.data || data.data.length === 0) {
    return null;
  }

  return parseFloat(data.data[0].v);
}

/**
 * Fetch predictions over a time range
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

  return await noaaGet(params);
}

/**
 * Fetch observed water levels over a time range
 */
export async function fetchWaterLevels(stationId, beginDate, endDate, datum = 'MLLW', interval = '6') {
  const params = {
    station: stationId,
    product: 'water_level',
    datum: datum,
    begin_date: beginDate,
    end_date: endDate,
    interval: interval
  };

  return await noaaGet(params);
}

/**
 * Fetch high/low tide events
 */
export async function fetchHiLo(stationId, beginDate, endDate) {
  const params = {
    station: stationId,
    product: 'predictions',
    datum: 'MLLW',
    begin_date: beginDate,
    end_date: endDate,
    interval: 'hilo'
  };

  return await noaaGet(params);
}

/**
 * Fetch water temperature history
 */
export async function fetchWaterTemperature(stationId, beginDate, endDate, interval = '6') {
  const params = {
    station: stationId,
    product: 'water_temperature',
    begin_date: beginDate,
    end_date: endDate,
    interval: interval
  };

  return await noaaGet(params);
}

/**
 * Fetch wind data
 */
export async function fetchWind(stationId) {
  const params = {
    station: stationId,
    product: 'wind',
    date: 'latest'
  };

  return await noaaGet(params);
}
