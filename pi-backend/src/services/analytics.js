import { getAnalyticsDb, queryOne, queryAll, run, saveDb } from '../config/database.js';
import crypto from 'crypto';

const ANALYTICS_ENABLED = process.env.ANALYTICS_ENABLED !== 'false';

/**
 * Generate a random session ID (privacy-safe, not tied to identity)
 * @returns {string} Random session ID
 */
export function generateSessionId() {
  return crypto.randomUUID();
}

/**
 * Parse device type from User-Agent
 * @param {string} userAgent - User-Agent header
 * @returns {string} Device type
 */
export function parseDeviceType(userAgent) {
  if (!userAgent) return 'unknown';

  const ua = userAgent.toLowerCase();

  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone') || ua.includes('ipad')) {
    return 'mobile';
  }

  if (ua.includes('tablet')) {
    return 'tablet';
  }

  return 'desktop';
}

/**
 * Extract station ID from request path or query
 * @param {Object} req - Express request object
 * @returns {string|null} Station ID
 */
export function extractStationId(req) {
  // Check route params
  if (req.params?.stationId) {
    return req.params.stationId;
  }

  // Check query params
  if (req.query?.station) {
    return req.query.station;
  }

  return null;
}

/**
 * Extract feature being used from the endpoint
 * @param {string} path - Request path
 * @returns {string} Feature name
 */
export function extractFeature(path) {
  if (path.includes('/predictions')) return 'predictions';
  if (path.includes('/water-level')) return 'water_level';
  if (path.includes('/water-temp')) return 'water_temp';
  if (path.includes('/air-temp')) return 'air_temp';
  if (path.includes('/hilo')) return 'hilo';
  if (path.includes('/wind')) return 'wind';
  if (path.includes('/noaa')) return 'noaa';
  if (path.includes('/nws')) return 'nws';
  if (path.includes('/usno')) return 'sun_moon';
  if (path.includes('/health')) return 'health_check';
  return 'other';
}

/**
 * Log a pageview/request
 * @param {Object} data - Pageview data
 * @returns {Promise<void>}
 */
export async function logPageview(data) {
  if (!ANALYTICS_ENABLED) return;

  const db = await getAnalyticsDb();

  run(
    db,
    `INSERT INTO pageviews (session_id, endpoint, method, station_id, feature_used, device_type, referrer, city, state, country, response_time_ms, status_code, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.sessionId,
      data.endpoint,
      data.method || 'GET',
      data.stationId || null,
      data.feature || null,
      data.deviceType || 'unknown',
      data.referrer || null,
      data.city || null,
      data.state || null,
      data.country || 'US',
      data.responseTimeMs || null,
      data.statusCode || null,
      new Date().toISOString()
    ]
  );
}

/**
 * Update daily stats aggregation
 * @returns {Promise<void>}
 */
export async function updateDailyStats() {
  const db = await getAnalyticsDb();
  const today = new Date().toISOString().split('T')[0];

  // Calculate today's stats from pageviews
  const stats = queryOne(db, `
    SELECT
      COUNT(*) as total_pageviews,
      COUNT(DISTINCT session_id) as unique_sessions,
      AVG(response_time_ms) as avg_response_time,
      SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count
    FROM pageviews
    WHERE date(created_at) = ?
  `, [today]);

  // Find top station
  const topStation = queryOne(db, `
    SELECT station_id, COUNT(*) as views
    FROM pageviews
    WHERE date(created_at) = ? AND station_id IS NOT NULL
    GROUP BY station_id
    ORDER BY views DESC
    LIMIT 1
  `, [today]);

  // Insert or update daily stats
  const existing = queryOne(db, `SELECT id FROM daily_stats WHERE date = ?`, [today]);

  if (existing) {
    run(
      db,
      `UPDATE daily_stats SET
        total_pageviews = ?,
        unique_sessions = ?,
        top_station_id = ?,
        top_station_views = ?,
        avg_response_time_ms = ?,
        error_count = ?,
        updated_at = ?
       WHERE date = ?`,
      [
        stats?.total_pageviews || 0,
        stats?.unique_sessions || 0,
        topStation?.station_id || null,
        topStation?.views || 0,
        stats?.avg_response_time || null,
        stats?.error_count || 0,
        new Date().toISOString(),
        today
      ]
    );
  } else {
    run(
      db,
      `INSERT INTO daily_stats (date, total_pageviews, unique_sessions, top_station_id, top_station_views, avg_response_time_ms, error_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        today,
        stats?.total_pageviews || 0,
        stats?.unique_sessions || 0,
        topStation?.station_id || null,
        topStation?.views || 0,
        stats?.avg_response_time || null,
        stats?.error_count || 0,
        new Date().toISOString(),
        new Date().toISOString()
      ]
    );
  }
}

/**
 * Update hourly stats
 * @returns {Promise<void>}
 */
export async function updateHourlyStats() {
  const db = await getAnalyticsDb();
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentHour = now.getHours();

  // Calculate this hour's stats
  const stats = queryOne(db, `
    SELECT
      COUNT(*) as pageviews,
      COUNT(DISTINCT session_id) as unique_sessions
    FROM pageviews
    WHERE date(created_at) = ? AND CAST(strftime('%H', created_at) AS INTEGER) = ?
  `, [today, currentHour]);

  // Insert or update hourly stats
  const existing = queryOne(db, `SELECT id FROM hourly_stats WHERE date = ? AND hour = ?`, [today, currentHour]);

  if (existing) {
    run(
      db,
      `UPDATE hourly_stats SET pageviews = ?, unique_sessions = ? WHERE date = ? AND hour = ?`,
      [stats?.pageviews || 0, stats?.unique_sessions || 0, today, currentHour]
    );
  } else {
    run(
      db,
      `INSERT INTO hourly_stats (date, hour, pageviews, unique_sessions, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [today, currentHour, stats?.pageviews || 0, stats?.unique_sessions || 0, new Date().toISOString()]
    );
  }
}

/**
 * Get analytics overview for a period
 * @param {number} days - Number of days to look back
 * @returns {Promise<Object>} Analytics overview
 */
export async function getAnalyticsOverview(days = 7) {
  const db = await getAnalyticsDb();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const stats = queryOne(db, `
    SELECT
      SUM(total_pageviews) as total_pageviews,
      SUM(unique_sessions) as total_sessions,
      AVG(avg_response_time_ms) as avg_response_time,
      SUM(error_count) as total_errors
    FROM daily_stats
    WHERE date >= ?
  `, [since]);

  return {
    totalPageviews: stats?.total_pageviews || 0,
    totalSessions: stats?.total_sessions || 0,
    avgResponseTime: stats?.avg_response_time ? Math.round(stats.avg_response_time) : 0,
    totalErrors: stats?.total_errors || 0,
    period: `${days} days`
  };
}

/**
 * Get traffic data for charts
 * @param {number} days - Number of days
 * @returns {Promise<Array>} Daily traffic data
 */
export async function getTrafficData(days = 7) {
  const db = await getAnalyticsDb();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return queryAll(
    db,
    `SELECT date, total_pageviews as pageviews, unique_sessions as sessions
     FROM daily_stats
     WHERE date >= ?
     ORDER BY date ASC`,
    [since]
  );
}

/**
 * Get hourly traffic for today
 * @returns {Promise<Array>} Hourly traffic data
 */
export async function getHourlyTraffic() {
  const db = await getAnalyticsDb();
  const today = new Date().toISOString().split('T')[0];

  return queryAll(
    db,
    `SELECT hour, pageviews, unique_sessions as sessions
     FROM hourly_stats
     WHERE date = ?
     ORDER BY hour ASC`,
    [today]
  );
}

/**
 * Get popular stations
 * @param {number} limit - Max number of stations
 * @param {number} days - Days to look back
 * @returns {Promise<Array>} Popular stations
 */
export async function getPopularStations(limit = 10, days = 7) {
  const db = await getAnalyticsDb();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const stations = queryAll(
    db,
    `SELECT station_id, COUNT(*) as views
     FROM pageviews
     WHERE station_id IS NOT NULL AND created_at >= ?
     GROUP BY station_id
     ORDER BY views DESC
     LIMIT ?`,
    [since, limit]
  );

  // Calculate total for percentages
  const total = stations.reduce((sum, s) => sum + s.views, 0);

  return stations.map(s => ({
    stationId: s.station_id,
    views: s.views,
    percentage: total > 0 ? ((s.views / total) * 100).toFixed(1) : '0.0'
  }));
}

/**
 * Get device breakdown
 * @param {number} days - Days to look back
 * @returns {Promise<Object>} Device breakdown
 */
export async function getDeviceBreakdown(days = 7) {
  const db = await getAnalyticsDb();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const breakdown = queryAll(
    db,
    `SELECT device_type, COUNT(*) as count
     FROM pageviews
     WHERE created_at >= ?
     GROUP BY device_type`,
    [since]
  );

  const result = { mobile: 0, desktop: 0, tablet: 0, unknown: 0 };
  breakdown.forEach(row => {
    result[row.device_type] = row.count;
  });

  return result;
}

/**
 * Get feature usage stats
 * @param {number} days - Days to look back
 * @returns {Promise<Array>} Feature usage
 */
export async function getFeatureUsage(days = 7) {
  const db = await getAnalyticsDb();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  return queryAll(
    db,
    `SELECT feature_used as feature, COUNT(*) as count
     FROM pageviews
     WHERE feature_used IS NOT NULL AND created_at >= ?
     GROUP BY feature_used
     ORDER BY count DESC`,
    [since]
  );
}

/**
 * Get recent pageviews for logs
 * @param {number} limit - Max records
 * @param {number} offset - Offset for pagination
 * @param {string} search - Optional search term
 * @returns {Promise<Array>} Pageviews
 */
export async function getRecentPageviews(limit = 100, offset = 0, search = null) {
  const db = await getAnalyticsDb();

  if (search) {
    return queryAll(
      db,
      `SELECT * FROM pageviews
       WHERE endpoint LIKE ? OR station_id LIKE ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [`%${search}%`, `%${search}%`, limit, offset]
    );
  }

  return queryAll(
    db,
    `SELECT * FROM pageviews ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
}

/**
 * Clean old analytics data
 * @param {number} retentionDays - Days to retain
 * @returns {Promise<Object>} Cleanup stats
 */
export async function cleanOldAnalytics(retentionDays = 30) {
  const db = await getAnalyticsDb();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const pageviewsDeleted = run(db, `DELETE FROM pageviews WHERE created_at < ?`, [cutoff]);
  const dailyDeleted = run(db, `DELETE FROM daily_stats WHERE date < ?`, [cutoff.split('T')[0]]);
  const hourlyDeleted = run(db, `DELETE FROM hourly_stats WHERE date < ?`, [cutoff.split('T')[0]]);

  saveDb('analytics');

  return {
    pageviewsDeleted: pageviewsDeleted.changes,
    dailyStatsDeleted: dailyDeleted.changes,
    hourlyStatsDeleted: hourlyDeleted.changes
  };
}

export default {
  generateSessionId,
  parseDeviceType,
  extractStationId,
  extractFeature,
  logPageview,
  updateDailyStats,
  updateHourlyStats,
  getAnalyticsOverview,
  getTrafficData,
  getHourlyTraffic,
  getPopularStations,
  getDeviceBreakdown,
  getFeatureUsage,
  getRecentPageviews,
  cleanOldAnalytics
};
