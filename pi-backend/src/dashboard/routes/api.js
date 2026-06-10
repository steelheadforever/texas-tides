/**
 * Dashboard API routes
 * Provides data endpoints for admin dashboard
 */

import express from 'express';
import os from 'os';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { requireAuth } from '../../middleware/auth.js';

// Import service functions
import {
  getCacheStats,
  getFetchStats,
  getStationHealthAll,
  getRecentFetchLogs
} from '../../services/cache.js';

import {
  getAnalyticsOverview,
  getTrafficData,
  getPopularStations,
  getDeviceBreakdown,
  getRecentPageviews
} from '../../services/analytics.js';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /admin/api/system/stats
 * Get system health statistics
 */
router.get('/system/stats', (req, res) => {
  try {
    // CPU information
    const cpus = os.cpus();
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + (1 - idle / total);
    }, 0) / cpus.length;

    // Memory information
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // Disk information (try to get, fallback if not available)
    let diskInfo = null;
    try {
      const dfOutput = execSync('df -h / | tail -1').toString();
      const parts = dfOutput.split(/\s+/);
      diskInfo = {
        total: parts[1],
        used: parts[2],
        available: parts[3],
        usedPercent: parseInt(parts[4])
      };
    } catch (error) {
      // Fallback if df command fails
      diskInfo = {
        total: 'N/A',
        used: 'N/A',
        available: 'N/A',
        usedPercent: 0
      };
    }

    // Raspberry Pi temperature (try to get, null if not on Pi)
    let temperature = null;
    try {
      const temp = readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8');
      temperature = parseInt(temp) / 1000; // Convert to Celsius
    } catch (error) {
      // Not on Raspberry Pi or can't read temperature
      temperature = null;
    }

    // Uptime
    const processUptime = Math.floor(process.uptime());
    const systemUptime = Math.floor(os.uptime());

    res.json({
      cpu: {
        usage: (cpuUsage * 100).toFixed(1),
        cores: cpus.length,
        model: cpus[0].model
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        usedPercent: ((usedMemory / totalMemory) * 100).toFixed(1)
      },
      disk: diskInfo,
      temperature: temperature,
      uptime: {
        process: processUptime,
        system: systemUptime
      },
      platform: os.platform(),
      hostname: os.hostname(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting system stats:', error);
    res.status(500).json({ error: 'Failed to get system stats' });
  }
});

/**
 * GET /admin/api/pipeline/stations
 * Get station health list
 */
router.get('/pipeline/stations', async (req, res) => {
  try {
    const stations = await getStationHealthAll();
    res.json(stations);
  } catch (error) {
    console.error('Error getting station health:', error);
    res.status(500).json({ error: 'Failed to get station health' });
  }
});

/**
 * GET /admin/api/pipeline/cache-stats
 * Get cache statistics
 */
router.get('/pipeline/cache-stats', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const cacheStats = await getCacheStats();
    const fetchStats = await getFetchStats(hours);

    res.json({
      cache: cacheStats,
      fetches: fetchStats
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({ error: 'Failed to get cache stats' });
  }
});

/**
 * GET /admin/api/pipeline/fetch-logs
 * Get recent fetch logs
 */
router.get('/pipeline/fetch-logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const externalApi = req.query.api || null;

    const logs = await getRecentFetchLogs(limit, externalApi);
    res.json(logs);
  } catch (error) {
    console.error('Error getting fetch logs:', error);
    res.status(500).json({ error: 'Failed to get fetch logs' });
  }
});

/**
 * GET /admin/api/analytics/overview
 * Get analytics overview
 */
router.get('/analytics/overview', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const overview = await getAnalyticsOverview(days);
    res.json(overview);
  } catch (error) {
    console.error('Error getting analytics overview:', error);
    res.status(500).json({ error: 'Failed to get analytics overview' });
  }
});

/**
 * GET /admin/api/analytics/traffic
 * Get traffic data for charts
 */
router.get('/analytics/traffic', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const traffic = await getTrafficData(days);
    res.json(traffic);
  } catch (error) {
    console.error('Error getting traffic data:', error);
    res.status(500).json({ error: 'Failed to get traffic data' });
  }
});

/**
 * GET /admin/api/analytics/popular-stations
 * Get popular stations
 */
router.get('/analytics/popular-stations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const days = parseInt(req.query.days) || 7;

    const stations = await getPopularStations(limit, days);
    res.json(stations);
  } catch (error) {
    console.error('Error getting popular stations:', error);
    res.status(500).json({ error: 'Failed to get popular stations' });
  }
});

/**
 * GET /admin/api/analytics/devices
 * Get device breakdown
 */
router.get('/analytics/devices', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const devices = await getDeviceBreakdown(days);
    res.json(devices);
  } catch (error) {
    console.error('Error getting device breakdown:', error);
    res.status(500).json({ error: 'Failed to get device breakdown' });
  }
});

/**
 * GET /admin/api/logs/requests
 * Get request logs with pagination and search
 */
router.get('/logs/requests', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const search = req.query.search || null;

    const logs = await getRecentPageviews(limit, offset, search);
    res.json(logs);
  } catch (error) {
    console.error('Error getting request logs:', error);
    res.status(500).json({ error: 'Failed to get request logs' });
  }
});

export default router;
