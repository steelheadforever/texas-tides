import geoip from 'geoip-lite';
import {
  generateSessionId,
  parseDeviceType,
  extractStationId,
  extractFeature,
  logPageview,
  updateDailyStats,
  updateHourlyStats
} from '../services/analytics.js';

const ANALYTICS_ENABLED = process.env.ANALYTICS_ENABLED !== 'false';
const SESSION_COOKIE_NAME = 'slackwater_session';

// Track last stats update to avoid too frequent writes
let lastStatsUpdate = 0;
const STATS_UPDATE_INTERVAL = 60000; // Update aggregated stats every minute

/**
 * Analytics middleware
 * Tracks requests for analytics (privacy-focused, no PII)
 */
export function analyticsMiddleware() {
  return async (req, res, next) => {
    if (!ANALYTICS_ENABLED) {
      return next();
    }

    // Skip health checks and static assets
    if (req.path === '/health' || req.path.startsWith('/admin')) {
      return next();
    }

    const startTime = Date.now();

    // Get or create session ID (from cookie or header)
    let sessionId = req.cookies?.[SESSION_COOKIE_NAME] ||
                    req.headers['x-session-id'];

    if (!sessionId) {
      sessionId = generateSessionId();
      // Set cookie if cookie-parser is available
      if (res.cookie) {
        res.cookie(SESSION_COOKIE_NAME, sessionId, {
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
          httpOnly: true,
          sameSite: 'lax'
        });
      }
    }

    // Extract request info (privacy-focused)
    const userAgent = req.headers['user-agent'] || '';
    const referrer = req.headers['referer'] || req.headers['referrer'] || null;

    // Get approximate location from IP (city-level only, no IP stored)
    let city = null;
    let state = null;
    let country = 'US';

    // Get client IP (handle proxies)
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     req.headers['x-real-ip'] ||
                     req.socket?.remoteAddress;

    if (clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1') {
      try {
        const geo = geoip.lookup(clientIp);
        if (geo) {
          city = geo.city || null;
          state = geo.region || null;
          country = geo.country || 'US';
        }
      } catch (err) {
        // Ignore geo lookup errors
      }
    }

    // Store analytics data on request for later use
    req.analyticsData = {
      sessionId,
      endpoint: req.path,
      method: req.method,
      stationId: extractStationId(req),
      feature: extractFeature(req.path),
      deviceType: parseDeviceType(userAgent),
      referrer,
      city,
      state,
      country,
      startTime
    };

    // Intercept response to log after completion
    const originalEnd = res.end.bind(res);

    res.end = function(...args) {
      const responseTime = Date.now() - startTime;

      // Log the pageview asynchronously (don't block response)
      setImmediate(async () => {
        try {
          await logPageview({
            ...req.analyticsData,
            responseTimeMs: responseTime,
            statusCode: res.statusCode
          });

          // Periodically update aggregated stats
          const now = Date.now();
          if (now - lastStatsUpdate > STATS_UPDATE_INTERVAL) {
            lastStatsUpdate = now;
            await updateDailyStats();
            await updateHourlyStats();
          }
        } catch (err) {
          console.error('Analytics logging error:', err);
        }
      });

      return originalEnd(...args);
    };

    next();
  };
}

/**
 * Get analytics session ID from request
 * @param {Object} req - Express request
 * @returns {string|null} Session ID
 */
export function getSessionId(req) {
  return req.cookies?.[SESSION_COOKIE_NAME] ||
         req.headers['x-session-id'] ||
         req.analyticsData?.sessionId ||
         null;
}

export default {
  analyticsMiddleware,
  getSessionId
};
