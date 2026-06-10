/**
 * Background Jobs Scheduler
 * Runs periodic maintenance tasks:
 * - Cache cleanup (every hour)
 * - Analytics aggregation (every hour)
 * - Old data cleanup (daily at 2 AM)
 */

import { cleanExpiredCache } from '../services/cache.js';
import { updateDailyStats, updateHourlyStats, cleanOldAnalytics } from '../services/analytics.js';

const RETENTION_DAYS = parseInt(process.env.RETENTION_DAYS) || 30;

// Job intervals
const ONE_HOUR = 60 * 60 * 1000; // 1 hour in milliseconds
const DAILY_CHECK_INTERVAL = 60 * 60 * 1000; // Check every hour for daily job

let jobIntervals = [];

/**
 * Clean expired cache entries
 */
async function runCacheCleanup() {
  try {
    const deleted = await cleanExpiredCache();
    console.log(`[Job] Cache cleanup: ${deleted} expired entries removed`);
  } catch (error) {
    console.error('[Job] Cache cleanup failed:', error);
  }
}

/**
 * Update analytics aggregations
 */
async function runAnalyticsAggregation() {
  try {
    await updateDailyStats();
    await updateHourlyStats();
    console.log('[Job] Analytics aggregation completed');
  } catch (error) {
    console.error('[Job] Analytics aggregation failed:', error);
  }
}

/**
 * Clean old analytics and cache data
 * Runs daily at 2 AM local time
 */
async function runDataCleanup() {
  const now = new Date();
  const hour = now.getHours();

  // Only run at 2 AM
  if (hour !== 2) {
    return;
  }

  try {
    const analyticsResult = await cleanOldAnalytics(RETENTION_DAYS);
    const cacheDeleted = await cleanExpiredCache();

    console.log(`[Job] Daily cleanup completed:`);
    console.log(`  - Pageviews deleted: ${analyticsResult.pageviewsDeleted}`);
    console.log(`  - Daily stats deleted: ${analyticsResult.dailyStatsDeleted}`);
    console.log(`  - Hourly stats deleted: ${analyticsResult.hourlyStatsDeleted}`);
    console.log(`  - Cache entries deleted: ${cacheDeleted}`);
  } catch (error) {
    console.error('[Job] Daily cleanup failed:', error);
  }
}

/**
 * Start all background jobs
 */
export function startJobs() {
  console.log('[Jobs] Starting background jobs scheduler...');

  // Run initial cleanup and aggregation on startup
  runCacheCleanup();
  runAnalyticsAggregation();

  // Cache cleanup - every hour
  const cacheCleanupJob = setInterval(runCacheCleanup, ONE_HOUR);
  jobIntervals.push(cacheCleanupJob);
  console.log('[Jobs] - Cache cleanup job: every 1 hour');

  // Analytics aggregation - every hour
  const analyticsAggregationJob = setInterval(runAnalyticsAggregation, ONE_HOUR);
  jobIntervals.push(analyticsAggregationJob);
  console.log('[Jobs] - Analytics aggregation job: every 1 hour');

  // Daily data cleanup - check every hour, run at 2 AM
  const dataCleanupJob = setInterval(runDataCleanup, DAILY_CHECK_INTERVAL);
  jobIntervals.push(dataCleanupJob);
  console.log('[Jobs] - Daily data cleanup job: daily at 2 AM');

  console.log(`[Jobs] Data retention period: ${RETENTION_DAYS} days`);
  console.log('[Jobs] All background jobs started successfully');
}

/**
 * Stop all background jobs
 */
export function stopJobs() {
  console.log('[Jobs] Stopping background jobs...');
  jobIntervals.forEach(interval => clearInterval(interval));
  jobIntervals = [];
  console.log('[Jobs] All background jobs stopped');
}

/**
 * Run all jobs immediately (for testing)
 */
export async function runAllJobsNow() {
  console.log('[Jobs] Running all jobs immediately...');
  await runCacheCleanup();
  await runAnalyticsAggregation();
  await runDataCleanup();
  console.log('[Jobs] All jobs completed');
}

export default {
  startJobs,
  stopJobs,
  runAllJobsNow
};
