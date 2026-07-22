// Marine alert areas: NWS zone polygons tinted by the worst active alert in
// each zone, using the station-banner palette (warning red / watch orange /
// advisory amber). On by default — the layer is invisible when nothing is
// active, so the common case costs nothing visually. Only the off-state is
// a user choice worth remembering.

import { fetchMarineZoneAlerts, fetchZoneGeometry } from '../api/nws.js';
import { escapeHtml } from '../format.js';

const TIER_COLOR = { warning: '#e2403a', watch: '#ff9500', advisory: '#dfae00' };
const REFRESH_MS = 5 * 60 * 1000;
const STORAGE_KEY = 'alertZonesOn';
// Polite little burst limit: a busy SCA day alerts ~200 zones nationally and
// each geometry is its own (long-cached) request.
const CONCURRENCY = 6;

export class AlertZonesLayer {
  constructor(map) {
    this.map = map;
    this.group = L.layerGroup();
    this.geomCache = new Map(); // zone id -> GeoJSON geometry (static shapes)
    this.lastFetch = 0;
    this.gen = 0; // invalidates in-flight refreshes on toggle/re-refresh
    this.on = localStorage.getItem(STORAGE_KEY) !== '0';
    setInterval(() => { if (this.on) this.refresh(); }, REFRESH_MS);
    if (this.on) {
      this.group.addTo(map);
      this.refresh();
    }
  }

  setOn(on) {
    this.on = on;
    try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch {}
    if (on) {
      this.group.addTo(this.map);
      this.refresh();
    } else {
      this.gen++;
      this.map.removeLayer(this.group);
    }
  }

  async refresh() {
    // Collapse rapid re-toggles onto the worker's own 5-minute cache window.
    if (Date.now() - this.lastFetch < 30 * 1000) return;
    this.lastFetch = Date.now();
    const gen = ++this.gen;

    const zones = await fetchMarineZoneAlerts();
    if (gen !== this.gen || !this.on) return;
    this.group.clearLayers();

    const queue = [...zones];
    const worker = async () => {
      while (queue.length && gen === this.gen) {
        await this.addZone(queue.shift(), gen);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  async addZone(zone, gen) {
    let geom = this.geomCache.get(zone.id);
    if (!geom) {
      geom = await fetchZoneGeometry(zone.id);
      if (geom) this.geomCache.set(zone.id, geom);
    }
    if (!geom || gen !== this.gen) return;

    const color = TIER_COLOR[zone.tier] || TIER_COLOR.advisory;
    const layer = L.geoJSON({ type: 'Feature', geometry: geom }, {
      style: { color, weight: 1.2, opacity: 0.65, fillColor: color, fillOpacity: 0.16 },
    });
    layer.bindPopup(`<div class="alert-zone-popup">
      ${zone.events.map((e) => `<div class="alert-zone-event alert-zone-${zone.tier}">${escapeHtml(e)}</div>`).join('')}
      <div class="alert-zone-hint">Open a nearby station for details.</div>
    </div>`);
    this.group.addLayer(layer);
  }
}
