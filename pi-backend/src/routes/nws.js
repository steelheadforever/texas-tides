import express from 'express';
import {
  fetchPoints,
  fetchForecastHourly,
  fetchObservationStations,
  fetchLatestObservation,
  fetchObservations
} from '../services/nws.js';

const router = express.Router();

/**
 * Get NWS points data for a location
 * GET /api/nws/points?lat=...&lon=...
 * Returns forecast URLs and observation station info
 */
router.get('/points', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'lat and lon query parameters are required' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'lat and lon must be valid numbers' });
    }

    const data = await fetchPoints(latitude, longitude);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get 12-hour hourly forecast for a location
 * GET /api/nws/forecast-12h?lat=...&lon=...
 * Returns wind speeds, directions, and conditions
 */
router.get('/forecast-12h', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'lat and lon query parameters are required' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'lat and lon must be valid numbers' });
    }

    // Get points data first
    const pointsData = await fetchPoints(latitude, longitude);

    if (pointsData.error || !pointsData.properties?.forecastHourly) {
      return res.status(404).json({ error: 'No forecast data available' });
    }

    // Fetch hourly forecast
    const forecastData = await fetchForecastHourly(pointsData.properties.forecastHourly);

    if (forecastData.error) {
      return res.status(404).json({ error: 'No forecast data available' });
    }

    // Extract first 12 hours
    const periods = forecastData.properties?.periods?.slice(0, 12) || [];

    // Parse wind data
    const windSpeeds = [];
    const windDirections = [];
    let condition = 'N/A';

    periods.forEach((period, idx) => {
      // Parse wind speed (e.g., "10 mph" or "5 to 10 mph")
      const windSpeedMatch = period.windSpeed?.match(/(\d+)\s*(?:to\s*(\d+))?\s*mph/);
      if (windSpeedMatch) {
        const speed1 = parseInt(windSpeedMatch[1]);
        const speed2 = windSpeedMatch[2] ? parseInt(windSpeedMatch[2]) : speed1;
        windSpeeds.push((speed1 + speed2) / 2);
      }

      // Wind direction
      if (period.windDirection) {
        windDirections.push(period.windDirection);
      }

      // Get sky condition from first period
      if (idx === 0 && period.shortForecast) {
        condition = period.shortForecast;
      }
    });

    // Calculate average and max wind speed
    const avgSpeed = windSpeeds.length > 0
      ? windSpeeds.reduce((a, b) => a + b, 0) / windSpeeds.length
      : null;
    const maxSpeed = windSpeeds.length > 0
      ? Math.max(...windSpeeds)
      : null;

    // Find most common wind direction
    const dirCounts = {};
    windDirections.forEach(dir => {
      dirCounts[dir] = (dirCounts[dir] || 0) + 1;
    });
    const predominantDir = Object.keys(dirCounts).length > 0
      ? Object.keys(dirCounts).reduce((a, b) => dirCounts[a] > dirCounts[b] ? a : b)
      : 'N/A';

    res.json({
      avgSpeed,
      maxSpeed,
      direction: predominantDir,
      condition
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get barometric pressure and trend for a location
 * GET /api/nws/pressure?lat=...&lon=...
 */
router.get('/pressure', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'lat and lon query parameters are required' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'lat and lon must be valid numbers' });
    }

    // Get points data
    const pointsData = await fetchPoints(latitude, longitude);

    if (pointsData.error || !pointsData.properties?.observationStations) {
      return res.status(404).json({ error: 'No observation stations available' });
    }

    // Get observation stations
    const stationsData = await fetchObservationStations(pointsData.properties.observationStations);

    if (stationsData.error || !stationsData.features || stationsData.features.length === 0) {
      return res.status(404).json({ error: 'No observation stations available' });
    }

    // Use first station
    const stationId = stationsData.features[0]?.properties?.stationIdentifier;

    if (!stationId) {
      return res.status(404).json({ error: 'No station ID available' });
    }

    // Fetch recent observations
    const obsData = await fetchObservations(stationId, 6);

    if (obsData.error || !obsData.features || obsData.features.length === 0) {
      return res.status(404).json({ error: 'No observations available' });
    }

    // Extract pressure values
    const observations = [];

    obsData.features.forEach(obs => {
      const props = obs.properties;
      let pressurePa = null;

      // Try seaLevelPressure first, then barometricPressure
      if (props.seaLevelPressure?.value !== null && props.seaLevelPressure?.value !== undefined) {
        pressurePa = props.seaLevelPressure.value;
      } else if (props.barometricPressure?.value !== null && props.barometricPressure?.value !== undefined) {
        pressurePa = props.barometricPressure.value;
      }

      if (pressurePa !== null) {
        // Convert Pascals to inHg
        const inHg = pressurePa * 0.0002953;
        observations.push({
          time: new Date(props.timestamp),
          value: inHg
        });
      }
    });

    if (observations.length === 0) {
      return res.status(404).json({ error: 'No pressure data available' });
    }

    // Sort by time (newest first)
    observations.sort((a, b) => b.time - a.time);

    const currentPressure = observations[0].value;

    // Calculate trend
    let trend = 'steady';
    if (observations.length >= 2) {
      const delta = currentPressure - observations[observations.length - 1].value;
      if (delta > 0.03) {
        trend = 'rising';
      } else if (delta < -0.03) {
        trend = 'falling';
      }
    }

    res.json({
      value: currentPressure,
      trend,
      unit: 'inHg'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get air temperature from NWS observation station
 * GET /api/nws/temperature?lat=...&lon=...
 */
router.get('/temperature', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'lat and lon query parameters are required' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'lat and lon must be valid numbers' });
    }

    // Get points data
    const pointsData = await fetchPoints(latitude, longitude);

    if (pointsData.error || !pointsData.properties?.observationStations) {
      return res.status(404).json({ error: 'No observation stations available' });
    }

    // Get observation stations
    const stationsData = await fetchObservationStations(pointsData.properties.observationStations);

    if (stationsData.error || !stationsData.features || stationsData.features.length === 0) {
      return res.status(404).json({ error: 'No observation stations available' });
    }

    // Use first station (closest)
    const stationId = stationsData.features[0]?.properties?.stationIdentifier;

    if (!stationId) {
      return res.status(404).json({ error: 'No station ID available' });
    }

    // Fetch latest observation
    const obsData = await fetchLatestObservation(stationId);

    if (obsData.error || !obsData.properties) {
      return res.status(404).json({ error: 'No temperature data available' });
    }

    // Temperature is in Celsius, convert to Fahrenheit
    const tempC = obsData.properties.temperature?.value;

    if (tempC === null || tempC === undefined) {
      return res.status(404).json({ error: 'No temperature data available' });
    }

    const tempF = (tempC * 9/5) + 32;

    res.json({
      temperature: tempF,
      unit: 'fahrenheit'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
