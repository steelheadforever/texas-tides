import { getOperationalDb, queryOne, queryAll, run, saveDb } from '../config/database.js';

const CACHE_TTL_SECONDS = parseInt(process.env.CACHE_TTL_SECONDS) || 360; // 6 minutes default

/**
 * Generate a cache key from request details
 * @param {string} endpoint - API endpoint path
 * @param {Object} params - Query parameters
 * @returns {string} Cache key
 */
export function generateCacheKey(endpoint, params = {}) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  return `${endpoint}:${sortedParams}`;
}

/**
 * Get cached data if not expired
 * @param {string} cacheKey - Cache key
 * @returns {Promise<Object|null>} Cached data or null
 */
export async function getCached(cacheKey) {
  const db = await getOperationalDb();
  const now = new Date().toISOString();

  const cached = queryOne(
    db,
    `SELECT id, data, expires_at, hit_count
     FROM cache
     WHERE cache_key = ? AND expires_at > ?`,
    [cacheKey, now]
  );

  if (cached) {
    // Increment hit count
    run(db, `UPDATE cache SET hit_count = hit_count + 1 WHERE id = ?`, [cached.id]);

    try {
      return JSON.parse(cached.data);
    } catch (e) {
      console.error('Failed to parse cached data:', e);
      return null;
    }
  }

  return null;
}

/**
 * Store data in cache
 * @param {string} cacheKey - Cache key
 * @param {string} endpoint - API endpoint
 * @param {string|null} stationId - Station ID if applicable
 * @param {Object} data - Data to cache
 * @param {number} ttlSeconds - TTL in seconds (default from env)
 * @returns {Promise<void>}
 */
export async function setCache(cacheKey, endpoint, stationId, data, ttlSeconds = CACHE_TTL_SECONDS) {
  const db = await getOperationalDb();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

  // Check if entry exists to preserve hit_count
  const existing = queryOne(db, 'SELECT id FROM cache WHERE cache_key = ?', [cacheKey]);

  if (existing) {
    // Update existing entry, preserve hit_count
    run(
      db,
      `UPDATE cache SET data = ?, expires_at = ?, created_at = ? WHERE cache_key = ?`,
      [JSON.stringify(data), expiresAt, now.toISOString(), cacheKey]
    );
  } else {
    // Insert new entry
    run(
      db,
      `INSERT INTO cache (cache_key, endpoint, station_id, data, created_at, expires_at, hit_count)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [cacheKey, endpoint, stationId, JSON.stringify(data), now.toISOString(), expiresAt]
    );
  }
}

/**
 * Delete expired cache entries
 * @returns {Promise<number>} Number of deleted entries
 */
export async function cleanExpiredCache() {
  const db = await getOperationalDb();
  const now = new Date().toISOString();

  const result = run(db, `DELETE FROM cache WHERE expires_at < ?`, [now]);
  saveDb('operational');

  return result.changes;
}

/**
 * Get cache statistics
 * @returns {Promise<Object>} Cache stats
 */
export async function getCacheStats() {
  const db = await getOperationalDb();
  const now = new Date().toISOString();

  const stats = queryOne(db, `
    SELECT
      COUNT(*) as total_entries,
      SUM(CASE WHEN expires_at > ? THEN 1 ELSE 0 END) as valid_entries,
      SUM(CASE WHEN expires_at <= ? THEN 1 ELSE 0 END) as expired_entries,
      SUM(hit_count) as total_hits,
      MIN(created_at) as oldest_entry,
      MAX(created_at) as newest_entry
    FROM cache
  `, [now, now]);

  return {
    totalEntries: stats?.total_entries || 0,
    validEntries: stats?.valid_entries || 0,
    expiredEntries: stats?.expired_entries || 0,
    totalHits: stats?.total_hits || 0,
    oldestEntry: stats?.oldest_entry || null,
    newestEntry: stats?.newest_entry || null
  };
}

/**
 * Get cache entries by station
 * @param {string} stationId - Station ID
 * @returns {Promise<Array>} Cache entries
 */
export async function getCacheByStation(stationId) {
  const db = await getOperationalDb();

  return queryAll(
    db,
    `SELECT cache_key, endpoint, created_at, expires_at, hit_count
     FROM cache
     WHERE station_id = ?
     ORDER BY created_at DESC`,
    [stationId]
  );
}

/**
 * Log an API fetch to the database
 * @param {Object} logData - Fetch log data
 * @returns {Promise<void>}
 */
export async function logFetch(logData) {
  const db = await getOperationalDb();

  run(
    db,
    `INSERT INTO fetch_logs (endpoint, station_id, external_api, status_code, response_time_ms, error, cache_hit, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      logData.endpoint,
      logData.stationId || null,
      logData.externalApi,
      logData.statusCode || null,
      logData.responseTimeMs || null,
      logData.error || null,
      logData.cacheHit ? 1 : 0,
      new Date().toISOString()
    ]
  );
}

/**
 * Update station health status
 * @param {string} stationId - Station ID
 * @param {boolean} success - Whether the fetch was successful
 * @param {string} stationName - Optional station name
 * @returns {Promise<void>}
 */
export async function updateStationHealth(stationId, success, stationName = null) {
  const db = await getOperationalDb();
  const now = new Date().toISOString();

  // Check if station exists
  const existing = queryOne(db, `SELECT * FROM station_health WHERE station_id = ?`, [stationId]);

  if (existing) {
    if (success) {
      run(
        db,
        `UPDATE station_health SET
          last_successful_fetch = ?,
          consecutive_failures = 0,
          total_successes = total_successes + 1,
          is_healthy = 1,
          updated_at = ?
         WHERE station_id = ?`,
        [now, now, stationId]
      );
    } else {
      const newFailures = existing.consecutive_failures + 1;
      const isHealthy = newFailures < 3; // Mark unhealthy after 3 consecutive failures

      run(
        db,
        `UPDATE station_health SET
          last_failed_fetch = ?,
          consecutive_failures = ?,
          total_failures = total_failures + 1,
          is_healthy = ?,
          updated_at = ?
         WHERE station_id = ?`,
        [now, newFailures, isHealthy ? 1 : 0, now, stationId]
      );
    }
  } else {
    // Create new station health record
    run(
      db,
      `INSERT INTO station_health (station_id, station_name, last_successful_fetch, last_failed_fetch, consecutive_failures, total_successes, total_failures, is_healthy, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        stationId,
        stationName,
        success ? now : null,
        success ? null : now,
        success ? 0 : 1,
        success ? 1 : 0,
        success ? 0 : 1,
        success ? 1 : 0,
        now
      ]
    );
  }
}

/**
 * Get all station health records
 * @returns {Promise<Array>} Station health records
 */
export async function getStationHealthAll() {
  const db = await getOperationalDb();

  return queryAll(
    db,
    `SELECT * FROM station_health ORDER BY is_healthy ASC, consecutive_failures DESC`
  );
}

/**
 * Get unhealthy stations
 * @returns {Promise<Array>} Unhealthy station records
 */
export async function getUnhealthyStations() {
  const db = await getOperationalDb();

  return queryAll(
    db,
    `SELECT * FROM station_health WHERE is_healthy = 0 ORDER BY consecutive_failures DESC`
  );
}

/**
 * Get recent fetch logs
 * @param {number} limit - Max number of records
 * @param {string} externalApi - Filter by API (optional)
 * @returns {Promise<Array>} Fetch logs
 */
export async function getRecentFetchLogs(limit = 100, externalApi = null) {
  const db = await getOperationalDb();

  if (externalApi) {
    return queryAll(
      db,
      `SELECT * FROM fetch_logs WHERE external_api = ? ORDER BY created_at DESC LIMIT ?`,
      [externalApi, limit]
    );
  }

  return queryAll(
    db,
    `SELECT * FROM fetch_logs ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
}

/**
 * Get fetch statistics for a time period
 * @param {number} hours - Hours to look back
 * @returns {Promise<Object>} Fetch stats
 */
export async function getFetchStats(hours = 24) {
  const db = await getOperationalDb();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const stats = queryOne(db, `
    SELECT
      COUNT(*) as total_fetches,
      SUM(CASE WHEN cache_hit = 1 THEN 1 ELSE 0 END) as cache_hits,
      SUM(CASE WHEN cache_hit = 0 THEN 1 ELSE 0 END) as cache_misses,
      SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) as errors,
      AVG(response_time_ms) as avg_response_time,
      MAX(response_time_ms) as max_response_time
    FROM fetch_logs
    WHERE created_at > ?
  `, [since]);

  const byApi = queryAll(db, `
    SELECT
      external_api,
      COUNT(*) as count,
      SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) as errors,
      AVG(response_time_ms) as avg_response_time
    FROM fetch_logs
    WHERE created_at > ?
    GROUP BY external_api
  `, [since]);

  return {
    totalFetches: stats?.total_fetches || 0,
    cacheHits: stats?.cache_hits || 0,
    cacheMisses: stats?.cache_misses || 0,
    hitRate: stats?.total_fetches > 0
      ? ((stats.cache_hits / stats.total_fetches) * 100).toFixed(1)
      : '0.0',
    errors: stats?.errors || 0,
    avgResponseTime: stats?.avg_response_time ? Math.round(stats.avg_response_time) : 0,
    maxResponseTime: stats?.max_response_time || 0,
    byApi
  };
}

export default {
  generateCacheKey,
  getCached,
  setCache,
  cleanExpiredCache,
  getCacheStats,
  getCacheByStation,
  logFetch,
  updateStationHealth,
  getStationHealthAll,
  getUnhealthyStations,
  getRecentFetchLogs,
  getFetchStats
};
