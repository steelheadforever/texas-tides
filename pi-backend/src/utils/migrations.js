import { getOperationalDb, getAnalyticsDb, saveAllDbs, queryAll } from '../config/database.js';

/**
 * Run all database migrations
 * Creates tables if they don't exist
 */
export async function runMigrations() {
  console.log('Running database migrations...');

  await runOperationalMigrations();
  await runAnalyticsMigrations();

  // Save changes to disk
  saveAllDbs();

  console.log('Database migrations complete.');
}

/**
 * Operational database schema (cache, fetch logs, station health)
 */
async function runOperationalMigrations() {
  const db = await getOperationalDb();

  // Cache table - stores NOAA/NWS/USNO responses
  db.run(`
    CREATE TABLE IF NOT EXISTS cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cache_key TEXT UNIQUE NOT NULL,
      endpoint TEXT NOT NULL,
      station_id TEXT,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      hit_count INTEGER DEFAULT 0
    )
  `);

  // Fetch logs - tracks all external API calls
  db.run(`
    CREATE TABLE IF NOT EXISTS fetch_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL,
      station_id TEXT,
      external_api TEXT NOT NULL,
      status_code INTEGER,
      response_time_ms INTEGER,
      error TEXT,
      cache_hit INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Station health - tracks reliability of each station
  db.run(`
    CREATE TABLE IF NOT EXISTS station_health (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id TEXT UNIQUE NOT NULL,
      station_name TEXT,
      last_successful_fetch DATETIME,
      last_failed_fetch DATETIME,
      consecutive_failures INTEGER DEFAULT 0,
      total_successes INTEGER DEFAULT 0,
      total_failures INTEGER DEFAULT 0,
      is_healthy INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for common queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_cache_key ON cache(cache_key)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cache_station ON cache(station_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_fetch_logs_created ON fetch_logs(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_fetch_logs_station ON fetch_logs(station_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_fetch_logs_api ON fetch_logs(external_api)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_station_health_id ON station_health(station_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_station_health_healthy ON station_health(is_healthy)`);

  console.log('  - Operational database schema ready');
}

/**
 * Analytics database schema (pageviews, daily stats)
 */
async function runAnalyticsMigrations() {
  const db = await getAnalyticsDb();

  // Pageviews - individual request tracking (privacy-focused, no PII)
  db.run(`
    CREATE TABLE IF NOT EXISTS pageviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      method TEXT DEFAULT 'GET',
      station_id TEXT,
      feature_used TEXT,
      device_type TEXT,
      referrer TEXT,
      city TEXT,
      state TEXT,
      country TEXT DEFAULT 'US',
      response_time_ms INTEGER,
      status_code INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Daily aggregated stats for faster dashboard queries
  db.run(`
    CREATE TABLE IF NOT EXISTS daily_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE UNIQUE NOT NULL,
      total_pageviews INTEGER DEFAULT 0,
      unique_sessions INTEGER DEFAULT 0,
      total_cache_hits INTEGER DEFAULT 0,
      total_cache_misses INTEGER DEFAULT 0,
      top_station_id TEXT,
      top_station_views INTEGER DEFAULT 0,
      avg_response_time_ms REAL,
      error_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Hourly traffic for detailed charts
  db.run(`
    CREATE TABLE IF NOT EXISTS hourly_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE NOT NULL,
      hour INTEGER NOT NULL,
      pageviews INTEGER DEFAULT 0,
      unique_sessions INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date, hour)
    )
  `);

  // Create indexes for common queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_pageviews_created ON pageviews(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_pageviews_session ON pageviews(session_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_pageviews_station ON pageviews(station_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_pageviews_endpoint ON pageviews(endpoint)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_hourly_stats_date ON hourly_stats(date)`);

  console.log('  - Analytics database schema ready');
}

/**
 * Get migration status and table info
 * @returns {Promise<Object>} Status of all tables
 */
export async function getMigrationStatus() {
  const operational = await getOperationalDb();
  const analytics = await getAnalyticsDb();

  const getTableInfo = (db, tableName) => {
    try {
      const count = queryAll(db, `SELECT COUNT(*) as count FROM ${tableName}`);
      const info = queryAll(db, `PRAGMA table_info(${tableName})`);
      return {
        exists: true,
        rowCount: count[0]?.count || 0,
        columns: info.map(col => col.name)
      };
    } catch (err) {
      return { exists: false, error: err.message };
    }
  };

  return {
    operational: {
      cache: getTableInfo(operational, 'cache'),
      fetch_logs: getTableInfo(operational, 'fetch_logs'),
      station_health: getTableInfo(operational, 'station_health')
    },
    analytics: {
      pageviews: getTableInfo(analytics, 'pageviews'),
      daily_stats: getTableInfo(analytics, 'daily_stats'),
      hourly_stats: getTableInfo(analytics, 'hourly_stats')
    }
  };
}

/**
 * Reset all databases (for testing only)
 * WARNING: This deletes all data!
 */
export async function resetDatabases() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot reset databases in production');
  }

  const operational = await getOperationalDb();
  const analytics = await getAnalyticsDb();

  operational.run('DROP TABLE IF EXISTS cache');
  operational.run('DROP TABLE IF EXISTS fetch_logs');
  operational.run('DROP TABLE IF EXISTS station_health');

  analytics.run('DROP TABLE IF EXISTS pageviews');
  analytics.run('DROP TABLE IF EXISTS daily_stats');
  analytics.run('DROP TABLE IF EXISTS hourly_stats');

  console.log('All tables dropped. Running migrations to recreate...');
  await runMigrations();
}

export default {
  runMigrations,
  getMigrationStatus,
  resetDatabases
};
