import express from 'express';
import {
  noaaGet,
  fetchLatestValue,
  fetchPredictions,
  fetchWaterLevels,
  fetchHiLo,
  fetchWaterTemperature,
  fetchWind
} from '../services/noaa.js';

const router = express.Router();

/**
 * Generic NOAA API proxy endpoint
 * Forwards query parameters directly to NOAA API
 * Example: /api/noaa/query?station=8771450&product=water_level&date=latest
 */
router.get('/query', async (req, res) => {
  try {
    const data = await noaaGet(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get latest water level for a station
 * GET /api/noaa/water-level/:stationId
 */
router.get('/water-level/:stationId', async (req, res) => {
  try {
    const { stationId } = req.params;
    const value = await fetchLatestValue(stationId, 'water_level', true);

    if (value === null) {
      return res.status(404).json({ error: 'No data available' });
    }

    res.json({ stationId, waterLevel: value, unit: 'feet' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get latest water temperature for a station
 * GET /api/noaa/water-temp/:stationId
 */
router.get('/water-temp/:stationId', async (req, res) => {
  try {
    const { stationId } = req.params;
    const value = await fetchLatestValue(stationId, 'water_temperature', false);

    if (value === null) {
      return res.status(404).json({ error: 'No data available' });
    }

    res.json({ stationId, waterTemp: value, unit: 'fahrenheit' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get latest air temperature for a station
 * GET /api/noaa/air-temp/:stationId
 */
router.get('/air-temp/:stationId', async (req, res) => {
  try {
    const { stationId } = req.params;
    const value = await fetchLatestValue(stationId, 'air_temperature', false);

    if (value === null) {
      return res.status(404).json({ error: 'No data available' });
    }

    res.json({ stationId, airTemp: value, unit: 'fahrenheit' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get tide predictions for a date range
 * GET /api/noaa/predictions/:stationId?begin_date=...&end_date=...&interval=6
 */
router.get('/predictions/:stationId', async (req, res) => {
  try {
    const { stationId } = req.params;
    const { begin_date, end_date, interval = '6' } = req.query;

    if (!begin_date || !end_date) {
      return res.status(400).json({ error: 'begin_date and end_date are required' });
    }

    const data = await fetchPredictions(stationId, begin_date, end_date, interval);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get observed water levels for a date range
 * GET /api/noaa/water-levels/:stationId?begin_date=...&end_date=...&datum=MLLW&interval=6
 */
router.get('/water-levels/:stationId', async (req, res) => {
  try {
    const { stationId } = req.params;
    const { begin_date, end_date, datum = 'MLLW', interval = '6' } = req.query;

    if (!begin_date || !end_date) {
      return res.status(400).json({ error: 'begin_date and end_date are required' });
    }

    const data = await fetchWaterLevels(stationId, begin_date, end_date, datum, interval);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get high/low tide events
 * GET /api/noaa/hilo/:stationId?begin_date=...&end_date=...
 */
router.get('/hilo/:stationId', async (req, res) => {
  try {
    const { stationId } = req.params;
    const { begin_date, end_date } = req.query;

    if (!begin_date || !end_date) {
      return res.status(400).json({ error: 'begin_date and end_date are required' });
    }

    const data = await fetchHiLo(stationId, begin_date, end_date);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get water temperature history
 * GET /api/noaa/water-temp-history/:stationId?begin_date=...&end_date=...&interval=6
 */
router.get('/water-temp-history/:stationId', async (req, res) => {
  try {
    const { stationId } = req.params;
    const { begin_date, end_date, interval = '6' } = req.query;

    if (!begin_date || !end_date) {
      return res.status(400).json({ error: 'begin_date and end_date are required' });
    }

    const data = await fetchWaterTemperature(stationId, begin_date, end_date, interval);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get wind data for a station
 * GET /api/noaa/wind/:stationId
 */
router.get('/wind/:stationId', async (req, res) => {
  try {
    const { stationId } = req.params;
    const data = await fetchWind(stationId);

    if (data.error) {
      return res.status(404).json({ error: 'No data available' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
