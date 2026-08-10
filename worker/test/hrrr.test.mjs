// Tests for the HRRR forecast-radar proxy: run discovery (newest-first probe
// walk against IEM's 200/503 answers) and the tile passthrough.
//
// Run: node --test worker/test/*.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hrrrRunStamp, latestHRRRRun, hrrrTile, HRRR_LAYER_RE } from '../src/hrrr.js';

/** Stub fetch: answers per probed stamp; anything unlisted 503s. */
async function withIEM(responder, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => responder(url.toString());
  try {
    return await fn();
  } finally {
    globalThis.fetch = real;
  }
}

const NOW = new Date('2026-08-10T00:38:00Z');

test('hrrrRunStamp is UTC YYYYMMDDHH00', () => {
  assert.equal(hrrrRunStamp(new Date('2026-08-09T22:00:00Z')), '202608092200');
  assert.equal(hrrrRunStamp(new Date('2026-01-02T03:00:00Z')), '202601020300');
});

test('discovery: hour-1 not processed, hour-2 wins', async () => {
  const probed = [];
  const res = await withIEM((url) => {
    probed.push(url);
    return { ok: url.includes('202608092200'), status: url.includes('202608092200') ? 200 : 503 };
  }, () => latestHRRRRun(NOW));
  assert.equal(res.status, 200);
  assert.equal(res.body.stamp, '202608092200');
  assert.equal(res.body.run, '2026-08-09T22:00:00.000Z');
  assert.equal(probed.length, 2, 'stops at the first processed run');
  assert.ok(probed[0].includes('202608092300'), 'probes newest first');
});

test('discovery: nothing processed in six hours → 502', async () => {
  const res = await withIEM(() => ({ ok: false, status: 503 }), () => latestHRRRRun(NOW));
  assert.equal(res.status, 502);
  assert.ok(res.body.error);
});

test('discovery: network errors skip to older candidates', async () => {
  const res = await withIEM((url) => {
    if (url.includes('202608092300')) throw new Error('network down');
    return { ok: true, status: 200 };
  }, () => latestHRRRRun(NOW));
  assert.equal(res.status, 200);
  assert.equal(res.body.stamp, '202608092200');
});

test('layer regex: explicit runs only', () => {
  assert.ok(HRRR_LAYER_RE.test('hrrr::REFD-F0060-202608092200'));
  assert.ok(HRRR_LAYER_RE.test('hrrr::REFP-F1080-202608092200'));
  assert.ok(!HRRR_LAYER_RE.test('hrrr::REFD-F0060-0'), 'latest-run alias would poison the edge cache');
  assert.ok(!HRRR_LAYER_RE.test('hrrr::REFD-F0060'), 'missing run stamp');
  assert.ok(!HRRR_LAYER_RE.test('goes::vis-F0000-202608092200'), 'other products');
  assert.ok(!HRRR_LAYER_RE.test('hrrr::REFD-F60-202608092200'), 'minute must be 4 digits');
});

test('tile: 200 passes through as immutable PNG', async () => {
  const res = await withIEM(
    () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
    () => hrrrTile('hrrr::REFD-F0060-202608092200', '6', '14', '26'),
  );
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Content-Type'), 'image/png');
  assert.ok(res.headers.get('Cache-Control').includes('immutable'));
});

test('tile: IEM 503 surfaces as 503, never cached', async () => {
  const res = await withIEM(
    () => new Response('nope', { status: 503 }),
    () => hrrrTile('hrrr::REFD-F0060-202608092200', '6', '14', '26'),
  );
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
});

test('tile: network failure → 502 with error body', async () => {
  const res = await withIEM(
    () => { throw new Error('network down'); },
    () => hrrrTile('hrrr::REFD-F0060-202608092200', '6', '14', '26'),
  );
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.ok(body.error);
});
