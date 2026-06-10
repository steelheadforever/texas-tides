import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file paths - resolve relative to project root
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = process.env.DATA_DIR || path.join(PROJECT_ROOT, 'data');

// Always resolve to absolute paths
const DB_PATHS = {
  operational: path.resolve(process.env.DB_OPERATIONAL || path.join(DATA_DIR, 'operational.db')),
  analytics: path.resolve(process.env.DB_ANALYTICS || path.join(DATA_DIR, 'analytics.db'))
};

// Database connection cache
const connections = {};

// SQL.js instance (shared)
let SQL = null;

// Auto-save interval (ms)
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds
const saveIntervals = {};

/**
 * Initialize SQL.js library
 */
async function initSQL() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  return SQL;
}

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`Created data directory: ${DATA_DIR}`);
  }
}

/**
 * Get or create a database connection
 * @param {string} dbName - 'operational' or 'analytics'
 * @returns {Promise<Database>} SQL.js database instance
 */
export async function getDb(dbName) {
  if (!DB_PATHS[dbName]) {
    throw new Error(`Unknown database: ${dbName}`);
  }

  if (!connections[dbName]) {
    await initSQL();
    ensureDataDir();

    const dbPath = DB_PATHS[dbName];
    console.log(`Opening database: ${dbPath}`);

    let db;
    if (fs.existsSync(dbPath)) {
      // Load existing database
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      // Create new database
      db = new SQL.Database();
    }

    connections[dbName] = db;

    // Set up auto-save
    saveIntervals[dbName] = setInterval(() => {
      saveDb(dbName);
    }, AUTO_SAVE_INTERVAL);
  }

  return connections[dbName];
}

/**
 * Save database to disk
 * @param {string} dbName - 'operational' or 'analytics'
 */
export function saveDb(dbName) {
  if (connections[dbName]) {
    const data = connections[dbName].export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATHS[dbName], buffer);
  }
}

/**
 * Save all databases to disk
 */
export function saveAllDbs() {
  for (const dbName of Object.keys(connections)) {
    saveDb(dbName);
  }
}

/**
 * Get operational database (cache, fetch logs, station health)
 * @returns {Promise<Database>}
 */
export async function getOperationalDb() {
  return getDb('operational');
}

/**
 * Get analytics database (pageviews, daily stats)
 * @returns {Promise<Database>}
 */
export async function getAnalyticsDb() {
  return getDb('analytics');
}

/**
 * Close all database connections and save to disk
 */
export function closeAllConnections() {
  for (const [name, db] of Object.entries(connections)) {
    console.log(`Saving and closing database: ${name}`);

    // Clear auto-save interval
    if (saveIntervals[name]) {
      clearInterval(saveIntervals[name]);
      delete saveIntervals[name];
    }

    // Save to disk
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATHS[name], buffer);

    // Close connection
    db.close();
    delete connections[name];
  }
}

/**
 * Get database file paths (for debugging/admin)
 * @returns {Object}
 */
export function getDbPaths() {
  return { ...DB_PATHS };
}

/**
 * Get database file sizes
 * @returns {Object}
 */
export function getDbSizes() {
  const sizes = {};
  for (const [name, dbPath] of Object.entries(DB_PATHS)) {
    try {
      const stats = fs.statSync(dbPath);
      sizes[name] = stats.size;
    } catch {
      sizes[name] = 0;
    }
  }
  return sizes;
}

/**
 * Helper to run a query and return results as array of objects
 * @param {Database} db - SQL.js database instance
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Array} Array of row objects
 */
export function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);

  const results = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();

  return results;
}

/**
 * Helper to run a query and return first result
 * @param {Database} db - SQL.js database instance
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Object|null} First row or null
 */
export function queryOne(db, sql, params = []) {
  const results = queryAll(db, sql, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * Helper to run an INSERT/UPDATE/DELETE and return changes info
 * @param {Database} db - SQL.js database instance
 * @param {string} sql - SQL statement
 * @param {Array} params - Query parameters
 * @returns {Object} { changes: number, lastInsertRowid: number }
 */
export function run(db, sql, params = []) {
  db.run(sql, params);
  const changes = db.getRowsModified();
  const lastId = queryOne(db, 'SELECT last_insert_rowid() as id');
  return {
    changes,
    lastInsertRowid: lastId ? lastId.id : 0
  };
}

// Note: Signal handlers are managed in server.js to avoid race conditions
// Do not add SIGINT/SIGTERM handlers here - they should only be in one place

export default {
  getDb,
  getOperationalDb,
  getAnalyticsDb,
  closeAllConnections,
  saveDb,
  saveAllDbs,
  getDbPaths,
  getDbSizes,
  queryAll,
  queryOne,
  run
};
