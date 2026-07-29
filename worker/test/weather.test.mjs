// Tests for the Open-Meteo weather proxy: the grid geometry (which must exactly
// mirror the iOS lattice) and the best-effort marine merge / caching signal.
//
// Run: node --test worker/test/*.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gridCoords, weatherGrid, marinePoint } from '../src/weather.js';

test('gridCoords is lat-major, evenly spaced, right count', () => {
  const { latitude, longitude } = gridCoords(24, 30, -98, -92, 3, 4);
  const lats = latitude.split(',');
  const lons = longitude.split(',');
  assert.equal(lats.length, 12, '3x4 = 12 points');
  assert.equal(lons.length, 12);
  // Lat-major: the first `cols` points share one latitude, sweeping longitude.
  assert.deepEqual(lats.slice(0, 4), ['24.00', '24.00', '24.00', '24.00']);
  assert.deepEqual(lons.slice(0, 4), ['-98.00', '-96.00', '-94.00', '-92.00']);
  // Row 1 steps latitude by (30-24)/(3-1) = 3.
  assert.deepEqual(lats.slice(4, 8), ['27.00', '27.00', '27.00', '27.00']);
  // Bounds are inclusive at both ends.
  assert.equal(lats[lats.length - 1], '30.00');
  assert.equal(lons[3], '-92.00');
});

/** Stub fetch to answer per-host: forecast (api.), marine (marine-api.). */
async function withOpenMeteo({ forecast, marine }, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const href = url.toString();
    const pick = href.includes('marine-api') ? marine : forecast;
    if (pick && pick.throw) throw new Error('network down');
    return { ok: pick?.ok ?? true, status: pick?.status ?? 200, statusText: pick?.statusText ?? 'OK', json: async () => pick.body };
  };
  try {
    return await fn();
  } finally {
    globalThis.fetch = real;
  }
}

const BOUNDS = { minLat: 24, maxLat: 30, minLon: -98, maxLon: -92, rows: 3, cols: 4 };
const FORECAST_ROWS = Array.from({ length: 12 }, () => ({ current: {}, hourly: { time: [] } }));
const MARINE_ROWS = Array.from({ length: 12 }, () => ({ current: { wave_height: 1 }, hourly: { time: [], wave_height: [] } }));

test('waves off: marine is never fetched, result is cacheable', async () => {
  let marineHit = false;
  const res = await withOpenMeteo(
    { forecast: { body: FORECAST_ROWS }, marine: { body: (marineHit = true, MARINE_ROWS) } },
    () => weatherGrid({ ...BOUNDS, wantsWaves: false }),
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.marine, null);
  assert.equal(res.body.forecast.length, 12);
  assert.ok(!res.noCache, 'a wind/precip-only grid is fully cacheable');
});

test('waves on, both upstreams ok: merged and cacheable', async () => {
  const res = await withOpenMeteo(
    { forecast: { body: FORECAST_ROWS }, marine: { body: MARINE_ROWS } },
    () => weatherGrid({ ...BOUNDS, wantsWaves: true }),
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.forecast.length, 12);
  assert.equal(res.body.marine.length, 12);
  assert.ok(!res.noCache);
});

test('waves on but marine fails: served, marine null, NOT cached', async () => {
  const res = await withOpenMeteo(
    { forecast: { body: FORECAST_ROWS }, marine: { ok: false, status: 429, statusText: 'Too Many Requests', body: {} } },
    () => weatherGrid({ ...BOUNDS, wantsWaves: true }),
  );
  assert.equal(res.status, 200, 'a marine failure must not blank wind/precip');
  assert.equal(res.body.marine, null);
  assert.equal(res.noCache, true, 'so the next request re-tries for waves');
});

test('forecast fails: 502, no partial body', async () => {
  const res = await withOpenMeteo(
    { forecast: { ok: false, status: 429, statusText: 'Too Many Requests', body: {} }, marine: { body: MARINE_ROWS } },
    () => weatherGrid({ ...BOUNDS, wantsWaves: true }),
  );
  assert.equal(res.status, 502);
  assert.ok(res.body.error);
});

test('marinePoint returns the current block; errors surface', async () => {
  const current = { wave_height: 1.2, wave_direction: 200, swell_wave_height: 0.8 };
  const ok = await withOpenMeteo({ marine: { body: { current } } }, () => marinePoint(27.5, -97.2));
  assert.deepEqual(ok, current);

  const bad = await withOpenMeteo({ marine: { ok: false, status: 404, statusText: 'Not Found', body: {} } }, () => marinePoint(27.5, -97.2));
  assert.ok(bad.error);
});
