// National station catalog generator.
//
// Pulls the NOAA CO-OPS station directory (MDAPI) for every product the app
// cares about, merges the per-product lists into one catalog, derives each
// station's IANA timezone from lat/lon, and writes worker/src/catalog.json.
// The Worker serves that file at /api/stations; web and iOS fetch it instead
// of shipping hardcoded station lists.
//
// Run:  npm run generate:stations   (from the repo root)
//
// Design notes:
// - MDAPI "type=" lists are the cheap way to learn which stations carry which
//   sensor/product (6 requests total vs. 3,450 per-station product queries).
// - Prediction stations keep NOAA's harmonic/subordinate distinction:
//   predType "R" (reference/harmonic — full 6-min curves) vs "S" (subordinate
//   — high/low times only, refId points at the parent harmonic station).
// - Stations with water_level but no predictions are kept (Great Lakes lake
//   gauges, TCOON-style obs-only sites); the apps decide presentation.
// - The products vocabulary matches the existing frontend station shape:
//   water_level, predictions, wind, water_temperature, air_temperature,
//   air_pressure.

import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import tzLookup from 'tz-lookup';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = join(ROOT, 'worker', 'src', 'catalog.json');

const MDAPI = 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json';

// product name (app vocabulary) → candidate MDAPI type params, first hit wins.
// MDAPI has no per-sensor list for meteorology — 'met' bundles wind, air temp,
// and pressure, so it expands to all three product flags (coarse but safe: the
// apps degrade gracefully when one sensor of a met suite is absent). Refining
// via the per-station /sensors endpoint (~3.5k requests) is possible later.
const MET_PRODUCTS = ['wind', 'air_temperature', 'air_pressure'];
const PRODUCT_SOURCES = [
  { product: 'predictions',       types: ['tidepredictions'] },
  { product: 'water_level',       types: ['waterlevels'] },
  { product: 'water_temperature', types: ['watertemp'] },
  { product: 'met',               types: ['met'] },
];

async function fetchStationsForType(type) {
  const res = await fetch(`${MDAPI}?type=${type}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data.stations) || data.stations.length === 0) return null;
  return data.stations;
}

function round5(n) {
  return Math.round(n * 1e5) / 1e5;
}

function stationTz(lat, lon, id, name) {
  try {
    return tzLookup(lat, lon);
  } catch (err) {
    console.warn(`  ! no timezone for ${id} ${name} (${lat},${lon}): ${err.message}`);
    return null;
  }
}

async function main() {
  const byId = new Map();

  for (const { product, types } of PRODUCT_SOURCES) {
    let list = null;
    let usedType = null;
    for (const type of types) {
      list = await fetchStationsForType(type);
      if (list) { usedType = type; break; }
    }
    if (!list) {
      console.warn(`! MDAPI returned no stations for ${product} (tried: ${types.join(', ')})`);
      continue;
    }
    console.log(`${product.padEnd(18)} type=${usedType.padEnd(16)} ${list.length} stations`);

    for (const s of list) {
      const lat = Number(s.lat);
      const lon = Number(s.lng);
      if (!s.id || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        console.warn(`  ! skipping malformed record in ${usedType}: ${JSON.stringify(s).slice(0, 120)}`);
        continue;
      }
      let entry = byId.get(s.id);
      if (!entry) {
        entry = {
          id: String(s.id),
          name: String(s.name || '').trim(),
          state: String(s.state || '').trim(),
          lat: round5(lat),
          lon: round5(lon),
          tz: null, // filled below, once per station
          products: [],
          predType: null,
          refId: null,
        };
        byId.set(s.id, entry);
      }
      const expanded = product === 'met' ? MET_PRODUCTS : [product];
      for (const p of expanded) {
        if (!entry.products.includes(p)) entry.products.push(p);
      }
      if (product === 'predictions') {
        // 'R' = reference/harmonic (full curve), 'S' = subordinate (hi/lo only).
        entry.predType = s.type === 'R' || s.type === 'S' ? s.type : null;
        entry.refId = s.reference_id && s.reference_id !== s.id ? String(s.reference_id) : null;
      }
    }
  }

  const stations = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  for (const s of stations) s.tz = stationTz(s.lat, s.lon, s.id, s.name);

  // ---- Sanity checks -------------------------------------------------------

  // Every station in the current hand-maintained Texas list must be present,
  // with a matching predictions flag.
  const { STATIONS: TX } = await import(join(ROOT, 'worker', 'src', 'stations.js'));
  let txMissing = 0;
  for (const tx of TX) {
    const hit = byId.get(tx.id);
    if (!hit) {
      console.warn(`! TX station missing from catalog: ${tx.id} ${tx.name}`);
      txMissing++;
    } else if (hit.products.includes('predictions') !== tx.hasPredictions) {
      console.warn(`! TX predictions mismatch for ${tx.id} ${tx.name}: catalog=${hit.products.includes('predictions')} legacy=${tx.hasPredictions}`);
    }
  }

  // Timezone spot checks across the awkward zones.
  const TZ_EXPECT = {
    8729840: 'America/Chicago',     // Pensacola — FL panhandle is Central
    1612340: 'Pacific/Honolulu',    // Honolulu — no DST
    9461380: 'America/Adak',        // Adak — HST *with* DST, unlike Honolulu
    9755371: 'America/Puerto_Rico', // San Juan — AST, no DST
    8518750: 'America/New_York',    // The Battery, NYC
  };
  for (const [id, want] of Object.entries(TZ_EXPECT)) {
    const hit = byId.get(id);
    if (!hit) console.warn(`! tz spot-check station ${id} not in catalog`);
    else if (hit.tz !== want) console.warn(`! tz mismatch ${id} ${hit.name}: got ${hit.tz}, want ${want}`);
  }

  // ---- Summary + write -----------------------------------------------------

  const counts = {};
  for (const s of stations) for (const p of s.products) counts[p] = (counts[p] || 0) + 1;
  const pred = stations.filter((s) => s.products.includes('predictions'));
  const noTz = stations.filter((s) => !s.tz).length;
  const noState = stations.filter((s) => !s.state);

  console.log('\n=== catalog summary ===');
  console.log(`stations: ${stations.length}`);
  console.log(`products: ${JSON.stringify(counts)}`);
  console.log(`predictions: ${pred.length} (R=${pred.filter((s) => s.predType === 'R').length}, S=${pred.filter((s) => s.predType === 'S').length})`);
  console.log(`missing tz: ${noTz}, missing state: ${noState.length}`);
  console.log(`TX legacy list: ${TX.length} stations, ${txMissing} missing from catalog`);
  if (noState.length) {
    console.log(`sample no-state stations: ${noState.slice(0, 8).map((s) => `${s.id} ${s.name}`).join(' | ')}`);
  }

  const body = JSON.stringify(stations);
  const version = createHash('sha256').update(body).digest('hex').slice(0, 12);
  const catalog = {
    version,
    generatedAt: new Date().toISOString(),
    source: 'NOAA CO-OPS MDAPI',
    count: stations.length,
    stations,
  };

  await writeFile(OUT_PATH, JSON.stringify(catalog, null, 1) + '\n');
  console.log(`\nwrote ${OUT_PATH} (version ${version}, ${(body.length / 1024).toFixed(0)} KB of station data)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
