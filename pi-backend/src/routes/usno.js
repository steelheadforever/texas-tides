import express from 'express';
import { fetchSunMoonData, parseSunMoonData } from '../services/usno.js';

const router = express.Router();

/**
 * Get sun and moon rise/set times and moon phase
 * GET /api/usno/sun-moon?lat=...&lon=...&date=YYYY-MM-DD (date optional)
 */
router.get('/sun-moon', async (req, res) => {
  try {
    const { lat, lon, date } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'lat and lon query parameters are required' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'lat and lon must be valid numbers' });
    }

    // Parse date if provided, otherwise use current date
    let targetDate = new Date();
    if (date) {
      targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
      }
    }

    const data = await fetchSunMoonData(latitude, longitude, targetDate);

    if (data.error) {
      return res.status(404).json(data);
    }

    const parsed = parseSunMoonData(data);

    if (!parsed) {
      return res.status(404).json({ error: 'No sun/moon data available' });
    }

    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
