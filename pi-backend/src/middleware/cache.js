import {
  generateCacheKey,
  getCached,
  setCache,
  logFetch,
  updateStationHealth
} from '../services/cache.js';

/**
 * Determine which external API is being called based on the route
 * @param {string} path - Request path
 * @returns {string} API name
 */
function getExternalApi(path) {
  if (path.includes('/noaa')) return 'NOAA';
  if (path.includes('/nws')) return 'NWS';
  if (path.includes('/usno')) return 'USNO';
  return 'UNKNOWN';
}

/**
 * Extract station ID from request
 * @param {Object} req - Express request
 * @returns {string|null} Station ID
 */
function extractStationId(req) {
  return req.params?.stationId || req.query?.station || null;
}

/**
 * Cache middleware factory
 * Creates middleware that checks cache before proceeding to route handler
 *
 * @param {Object} options - Cache options
 * @param {number} options.ttl - TTL in seconds (default from env)
 * @param {boolean} options.enabled - Whether caching is enabled (default true)
 * @returns {Function} Express middleware
 */
export function cacheMiddleware(options = {}) {
  const { ttl, enabled = true } = options;

  return async (req, res, next) => {
    if (!enabled) {
      return next();
    }

    const startTime = Date.now();
    const endpoint = req.path;
    const stationId = extractStationId(req);
    const externalApi = getExternalApi(req.path);
    const cacheKey = generateCacheKey(endpoint, req.query);

    // Try to get cached response
    try {
      const cached = await getCached(cacheKey);

      if (cached) {
        const responseTime = Date.now() - startTime;

        // Log cache hit
        await logFetch({
          endpoint,
          stationId,
          externalApi,
          statusCode: 200,
          responseTimeMs: responseTime,
          cacheHit: true
        });

        // Return cached response
        return res.json(cached);
      }
    } catch (err) {
      console.error('Cache read error:', err);
      // Continue to actual request if cache fails
    }

    // Store original json method to intercept response
    const originalJson = res.json.bind(res);

    res.json = async (data) => {
      const responseTime = Date.now() - startTime;
      const statusCode = res.statusCode;
      const hasError = data?.error || statusCode >= 400;

      // Log the fetch
      await logFetch({
        endpoint,
        stationId,
        externalApi,
        statusCode,
        responseTimeMs: responseTime,
        error: hasError ? JSON.stringify(data?.error || 'Error') : null,
        cacheHit: false
      });

      // Update station health if we have a station ID
      if (stationId) {
        await updateStationHealth(stationId, !hasError);
      }

      // Cache successful responses only
      if (!hasError && data) {
        try {
          await setCache(cacheKey, endpoint, stationId, data, ttl);
        } catch (err) {
          console.error('Cache write error:', err);
        }
      }

      // Send the response
      return originalJson(data);
    };

    next();
  };
}

/**
 * Simple cache check middleware (doesn't intercept response)
 * Use when you want to manually control caching
 */
export function checkCache() {
  return async (req, res, next) => {
    const endpoint = req.path;
    const cacheKey = generateCacheKey(endpoint, req.query);

    try {
      const cached = await getCached(cacheKey);

      if (cached) {
        req.cachedData = cached;
        req.cacheHit = true;
      } else {
        req.cacheHit = false;
      }
    } catch (err) {
      console.error('Cache check error:', err);
      req.cacheHit = false;
    }

    next();
  };
}

export default {
  cacheMiddleware,
  checkCache
};
