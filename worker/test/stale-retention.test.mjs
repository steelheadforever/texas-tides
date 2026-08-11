// Tests for stale-on-upstream-failure retention: entries must physically
// outlive their logical TTL in KV so the failure paths have something to
// serve — ADDITIVELY (ttl + 24h), so long-TTL types like the 24h tide
// predictions get a stale window too. Safety data (NWS alerts) opts out via
// retainStale: false and dies at its logical expiry, because a stale
// "no active alerts" served during an NWS outage would hide a live warning.
//
// Run: node --test worker/test/*.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setCached, getCached } from '../src/cache.js';

const DAY = 24 * 60 * 60;

/** Minimal in-memory KV recording the expirationTtl each put was given. */
function fakeKV() {
  const store = new Map();
  const ttls = new Map();
  return {
    env: {
      CACHE: {
        async put(key, value, { expirationTtl } = {}) {
          store.set(key, value);
          ttls.set(key, expirationTtl);
        },
        async get(key, _opts) {
          const raw = store.get(key);
          return raw === undefined ? null : JSON.parse(raw);
        },
      },
    },
    ttls,
  };
}

test('physical KV expiry extends 24h past the logical TTL', async () => {
  const { env, ttls } = fakeKV();
  // Weather grids: 15-min logical TTL.
  await setCached(env, 'weather:grid:x', { forecast: [] }, 15 * 60);
  assert.equal(ttls.get('weather:grid:x'), 15 * 60 + DAY,
    'a 15-min entry must physically survive 24h past expiry for the stale fallback');
});

test('long TTLs get a stale window too (24h tide predictions)', async () => {
  const { env, ttls } = fakeKV();
  await setCached(env, 'noaa:query:predictions', { predictions: [] }, DAY);
  assert.equal(ttls.get('noaa:query:predictions'), 2 * DAY,
    'max()-style retention gave predictions no stale window; additive must');
});

test('retainStale: false (alerts) dies exactly at logical expiry', async () => {
  const { env, ttls } = fakeKV();
  await setCached(env, 'nws:marine-alerts', { features: [] }, 5 * 60, { retainStale: false });
  assert.equal(ttls.get('nws:marine-alerts'), 5 * 60,
    'a stale "no alerts" body must never be servable during an NWS outage');
});

test('retainStale: false still respects the KV 60s floor', async () => {
  const { env, ttls } = fakeKV();
  await setCached(env, 'k', { a: 1 }, 10, { retainStale: false });
  assert.equal(ttls.get('k'), 60);
});

test('logical freshness still reflects the requested TTL', async () => {
  const { env } = fakeKV();
  const before = Date.now();
  const entry = await setCached(env, 'k', { a: 1 }, 15 * 60);
  assert.ok(entry.expiresAt >= before + 15 * 60 * 1000 - 50);
  assert.ok(entry.expiresAt <= Date.now() + 15 * 60 * 1000 + 50,
    'expiresAt must be the logical 15-min mark, not the physical one');
});

test('a logically-expired entry is still readable for the stale path', async () => {
  const { env } = fakeKV();
  await setCached(env, 'k', { a: 1 }, 15 * 60);
  const raw = await getCached(env, 'k');
  assert.ok(raw, 'entry exists physically');
  raw.expiresAt = Date.now() - 1000;
  assert.ok(raw.body, 'stale body remains servable');
});
