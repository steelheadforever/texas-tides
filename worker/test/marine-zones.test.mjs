// Tests for the map alert layer's worker pieces: the national marine-zone
// reduction and the Douglas-Peucker geometry simplification.
//
// Run: node --test worker/test/*.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reduceMarineZones } from '../src/nws.js';
import { simplifyRing, simplifyGeometry } from '../src/geometry.js';

function feature(event, zones, props = {}) {
  return {
    properties: {
      id: `urn:${event}:${zones.join(',')}`,
      event,
      status: 'Actual',
      messageType: 'Alert',
      affectedZones: zones.map((z) => `https://api.weather.gov/zones/coastal/${z}`),
      ...props,
    },
  };
}

test('zones aggregate events and take the worst tier', () => {
  const out = reduceMarineZones({
    features: [
      feature('Small Craft Advisory', ['PZZ650', 'PZZ645']),
      feature('Gale Warning', ['PZZ650']),
    ],
  });
  const z650 = out.find((z) => z.id === 'PZZ650');
  const z645 = out.find((z) => z.id === 'PZZ645');
  assert.equal(z650.tier, 'warning');
  assert.deepEqual(z650.events.sort(), ['Gale Warning', 'Small Craft Advisory']);
  assert.equal(z645.tier, 'advisory');
});

test('cancelled and test messages contribute no zones', () => {
  const out = reduceMarineZones({
    features: [
      feature('Gale Warning', ['PZZ650'], { messageType: 'Cancel' }),
      feature('Storm Warning', ['PZZ645'], { status: 'Test' }),
    ],
  });
  assert.deepEqual(out, []);
});

test('duplicate events in one zone are listed once', () => {
  const out = reduceMarineZones({
    features: [
      feature('Small Craft Advisory', ['PZZ650']),
      { properties: { id: 'urn:other', event: 'Small Craft Advisory', status: 'Actual', messageType: 'Update', affectedZones: ['https://api.weather.gov/zones/coastal/PZZ650'] } },
    ],
  });
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].events, ['Small Craft Advisory']);
});

test('simplifyRing drops collinear detail but keeps corners', () => {
  // A square traced with 3 redundant points per edge.
  const square = [];
  for (const [sx, sy, ex, ey] of [[0, 0, 1, 0], [1, 0, 1, 1], [1, 1, 0, 1], [0, 1, 0, 0]]) {
    for (let t = 0; t < 4; t++) square.push([sx + (ex - sx) * (t / 4), sy + (ey - sy) * (t / 4)]);
  }
  square.push([0, 0]);
  const out = simplifyRing(square, 0.005);
  assert.equal(out.length, 5, 'square should reduce to its 4 corners + closure');
  assert.deepEqual(out[0], out[out.length - 1], 'ring stays closed');
});

test('simplification that would destroy a ring keeps the original', () => {
  const sliver = [[0, 0], [0.0001, 0.00005], [0.0002, 0], [0, 0]];
  assert.deepEqual(simplifyRing(sliver, 0.005), sliver);
});

test('simplifyGeometry handles Polygon and MultiPolygon', () => {
  const ring = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
  const poly = simplifyGeometry({ type: 'Polygon', coordinates: [ring] });
  assert.equal(poly.type, 'Polygon');
  const multi = simplifyGeometry({ type: 'MultiPolygon', coordinates: [[ring], [ring]] });
  assert.equal(multi.coordinates.length, 2);
});
