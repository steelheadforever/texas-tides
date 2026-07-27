// Tests for the /api/nws/alerts reduction: merge point + marine-zone results,
// dedupe by alert id, drop tests/cancels, rank warnings ahead of watches ahead
// of advisories (the NWS severity field can't do this — every SCA is "Minor").
//
// Run: node --test worker/test/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reduceAlerts, alerts } from '../src/nws.js';

function feature(id, event, props = {}) {
  return {
    properties: {
      id,
      event,
      status: 'Actual',
      messageType: 'Alert',
      severity: 'Minor',
      ...props,
    },
  };
}

test('dedupes an alert present in both the point and zone results', () => {
  const sca = feature('urn:sca-1', 'Small Craft Advisory');
  const out = reduceAlerts([{ features: [sca] }, { features: [sca] }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].event, 'Small Craft Advisory');
});

test('drops test messages and cancellations', () => {
  const out = reduceAlerts([{
    features: [
      feature('urn:1', 'Gale Warning', { status: 'Test' }),
      feature('urn:2', 'Gale Warning', { messageType: 'Cancel' }),
      feature('urn:3', 'Small Craft Advisory'),
    ],
  }]);
  assert.deepEqual(out.map((a) => a.id), ['urn:3']);
});

test('warnings rank first regardless of NWS severity field', () => {
  const out = reduceAlerts([{
    features: [
      feature('urn:1', 'Small Craft Advisory', { severity: 'Minor' }),
      feature('urn:2', 'Hurricane Watch', { severity: 'Extreme' }),
      feature('urn:3', 'Gale Warning', { severity: 'Moderate' }),
    ],
  }]);
  assert.deepEqual(out.map((a) => a.event),
    ['Gale Warning', 'Hurricane Watch', 'Small Craft Advisory']);
});

test('affectedZones URLs reduce to bare zone ids', () => {
  const out = reduceAlerts([{
    features: [feature('urn:1', 'Small Craft Advisory', {
      affectedZones: [
        'https://api.weather.gov/zones/forecast/PZZ545',
        'https://api.weather.gov/zones/county/WAC033',
      ],
    })],
  }]);
  assert.deepEqual(out[0].zones, ['PZZ545', 'WAC033']);
});

test('errored upstream lists are skipped, not fatal', () => {
  const out = reduceAlerts([
    { error: { message: 'Request timeout' } },
    { features: [feature('urn:1', 'Dense Fog Advisory')] },
  ]);
  assert.equal(out.length, 1);
});

/** Stub fetch, dispatching a canned body per URL substring. */
async function withFetchRoutes(routes, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const href = String(url);
    const match = Object.entries(routes).find(([part]) => href.includes(part));
    if (!match) return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) };
    return { ok: true, status: 200, statusText: 'OK', json: async () => match[1] };
  };
  try {
    return await fn();
  } finally {
    globalThis.fetch = real;
  }
}

function withZones(f, zones) {
  f.properties.affectedZones = zones.map((z) => `https://api.weather.gov/zones/x/${z}`);
  return f;
}

test('alerts(): offshore probes add marine alerts a landward point misses, land products from probes are dropped', async () => {
  // Exact point (30, -90) sees only a land alert; the north probe (30.09, -90)
  // lands "in the water" and sees an SCA plus a heat advisory. The SCA must
  // merge in; the probe's heat advisory must not.
  const res = await withFetchRoutes({
    'point=30.0900,-90.0000': {
      features: [
        withZones(feature('urn:sca', 'Small Craft Advisory'), ['GMZ335']),
        withZones(feature('urn:heat', 'Heat Advisory'), ['LAZ040']),
      ],
    },
    'point=30.0000,-90.0000': {
      features: [withZones(feature('urn:flood', 'Coastal Flood Advisory'), ['LAZ040'])],
    },
    'alerts/active': { features: [] }, // remaining probes
  }, () => alerts(30, -90));
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.alerts.map((a) => a.id).sort(), ['urn:flood', 'urn:sca']);
});

test('alerts(): no active alerts is a cacheable empty list, not an error', async () => {
  const res = await withFetchRoutes({
    'alerts/active': { features: [] },
  }, () => alerts(47.6, -122.3));
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.alerts, []);
});

test('alerts(): total upstream failure is a 502, never cached as empty', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => { throw Object.assign(new Error('timeout'), { name: 'TimeoutError' }); };
  try {
    const res = await alerts(47.6, -122.3);
    assert.equal(res.status, 502);
  } finally {
    globalThis.fetch = real;
  }
});
