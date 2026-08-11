// Tests for stale-on-upstream-failure retention: entries must physically
// outlive their logical TTL in KV so the failure paths have something to
// serve, but freshness (expiresAt) must still reflect the logical TTL.
//
// Run: node --test worker/test/*.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setCached, getCached } from '../src/cache.js';

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

test('physical KV expiry is extended to the stale-retention floor', async () => {
  const { env, ttls } = fakeKV();
  // Weather grids: 15-min logical TTL.
  await setCached(env, 'weather:grid:x', { forecast: [] }, 15 * 60);
  assert.equal(ttls.get('weather:grid:x'), 24 * 60 * 60,
    'a 15-min entry must physically survive 24h for the stale fallback');
});

test('logical freshness still reflects the requested TTL', async () => {
  const { env } = fakeKV();
  const before = Date.now();
  const entry = await setCached(env, 'k', { a: 1 }, 15 * 60);
  assert.ok(entry.expiresAt >= before + 15 * 60 * 1000 - 50);
  assert.ok(entry.expiresAt <= Date.now() + 15 * 60 * 1000 + 50,
    'expiresAt must be the logical 15-min mark, not the 24h physical one');
});

test('TTLs above the retention floor are preserved (zone geometry)', async () => {
  const { env, ttls } = fakeKV();
  await setCached(env, 'nws:zone-geometry:PZZ650', { shape: true }, 30 * 24 * 60 * 60);
  assert.equal(ttls.get('nws:zone-geometry:PZZ650'), 30 * 24 * 60 * 60);
});

test('a logically-expired entry is still readable for the stale path', async () => {
  const { env } = fakeKV();
  await setCached(env, 'k', { a: 1 }, 15 * 60);
  const raw = await getCached(env, 'k');
  assert.ok(raw, 'entry exists physically');
  // Simulate logical expiry: the read path (cached()/wrapDerived) treats
  // expiresAt <= now as stale-but-present — exactly what the upstream-failure
  // fallback serves.
  raw.expiresAt = Date.now() - 1000;
  assert.ok(raw.body, 'stale body remains servable');
});
