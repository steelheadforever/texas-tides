// Regression tests for the NOAA error-shape guard.
//
// NOAA CO-OPS reports failures two different ways, and only one of them used to
// be recognised: a throttle arrives as a bare {"message":"Forbidden"} with HTTP
// 200 and no error key. That sailed through as a valid payload and got cached
// against the 24h prediction TTL, so a momentary refusal blanked a station's
// tide curve for every client (web and iOS) until the next day.
//
// Run: node --test worker/test/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noaaGet } from '../src/upstream.js';
import { isErrorEnvelope } from '../src/cache.js';

/** Stub global fetch with one canned response, run fn, always restore. */
async function withFetch({ ok = true, status = 200, statusText = 'OK', body }, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = async () => ({ ok, status, statusText, json: async () => body });
  try {
    return await fn();
  } finally {
    globalThis.fetch = real;
  }
}

const PARAMS = { station: '9412110', product: 'predictions' };

test('throttle: bare {message} with HTTP 200 is an error, not a payload', async () => {
  const res = await withFetch({ body: { message: 'Forbidden' } }, () => noaaGet(PARAMS));
  assert.ok(res.error, 'must be reported as an error so it is never cached');
  assert.equal(res.error.message, 'Forbidden');
  assert.equal(res.predictions, undefined);
});

test('no-data: NOAA {error:{...}} shape still passes through as an error', async () => {
  const message = 'No data was found. This product may not be offered at this station.';
  const res = await withFetch({ body: { error: { message } } }, () => noaaGet(PARAMS));
  assert.ok(res.error);
  assert.equal(res.error.message, message);
});

test('valid predictions payload passes through untouched', async () => {
  const body = { predictions: [{ t: '2026-07-18 00:00', v: '4.987' }] };
  const res = await withFetch({ body }, () => noaaGet(PARAMS));
  assert.equal(res.error, undefined);
  assert.deepEqual(res.predictions, body.predictions);
});

test('valid observation payload ({data}) passes through untouched', async () => {
  const body = { metadata: { id: '9412110' }, data: [{ t: '2026-07-18 00:00', v: '5.351' }] };
  const res = await withFetch({ body }, () => noaaGet(PARAMS));
  assert.equal(res.error, undefined);
  assert.equal(res.data.length, 1);
});

test('empty result set is an error — never cache a dataless day', async () => {
  const res = await withFetch({ body: { predictions: [] } }, () => noaaGet(PARAMS));
  assert.ok(res.error, 'an empty set must not be cached against the 24h TTL');
});

test('non-2xx response is an error even when the body parses', async () => {
  const res = await withFetch(
    { ok: false, status: 403, statusText: 'Forbidden', body: { message: 'Forbidden' } },
    () => noaaGet(PARAMS),
  );
  assert.ok(res.error);
  assert.equal(res.error.message, 'Forbidden');
});

test('non-2xx keeps NOAA\'s own reason rather than the bare status line', async () => {
  // NOAA answers a missing datum with HTTP 400 + a specific explanation. That
  // detail is what makes a bad request debuggable, so it must survive.
  const message = ' Wrong Datum: Datum cannot be null or empty  ***station=9412110';
  const res = await withFetch(
    { ok: false, status: 400, statusText: 'Bad Request', body: { error: { message } } },
    () => noaaGet(PARAMS),
  );
  assert.equal(res.error.message, message);
});

test('non-2xx with an unparseable body falls back to the status line', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false, status: 502, statusText: 'Bad Gateway',
    json: async () => { throw new SyntaxError('Unexpected token < in JSON'); },
  });
  try {
    const res = await noaaGet(PARAMS);
    assert.ok(res.error);
    assert.match(res.error.message, /502/);
  } finally {
    globalThis.fetch = real;
  }
});

test('2xx with an unparseable body is an error, not a payload', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true, status: 200, statusText: 'OK',
    json: async () => { throw new SyntaxError('Unexpected token < in JSON'); },
  });
  try {
    const res = await noaaGet(PARAMS);
    assert.ok(res.error, 'an HTML error page must never be cached as data');
  } finally {
    globalThis.fetch = real;
  }
});

test('a payload that also carries a message is kept', async () => {
  // Defensive: presence of `message` alone must not disqualify a real payload.
  const body = { message: 'ok', predictions: [{ t: '2026-07-18 00:00', v: '1.0' }] };
  const res = await withFetch({ body }, () => noaaGet(PARAMS));
  assert.equal(res.error, undefined);
  assert.equal(res.predictions.length, 1);
});

test('isErrorEnvelope matches only bare {message} objects', () => {
  assert.equal(isErrorEnvelope({ message: 'Forbidden' }), true);
  assert.equal(isErrorEnvelope({ predictions: [{ v: '1' }] }), false);
  assert.equal(isErrorEnvelope({ message: 'ok', predictions: [] }), false);
  assert.equal(isErrorEnvelope({ data: [], metadata: {} }), false);
  assert.equal(isErrorEnvelope(null), false);
  assert.equal(isErrorEnvelope(undefined), false);
  assert.equal(isErrorEnvelope('Forbidden'), false);
});
