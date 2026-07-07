// Precipitation: live RainViewer radar (global tiles, overzoomed past their
// z7 ceiling via Leaflet's maxNativeZoom) + forecast precip heatmap frames
// rendered from the Open-Meteo viewport grid. Mirrors the iOS radar layer.

import { precipColor } from './weather.js';

const gridLatLngBounds = (ext) => L.latLngBounds(
  [ext.minLat, ext.minLon],
  [ext.maxLat, ext.maxLon]
);

// RainViewer publishes ~2h of past radar as 10-minute frames; the newest
// frame is "live". Cached briefly — frames roll forward every ~10 minutes.
const FRAMES_TTL_MS = 5 * 60 * 1000;
let framesCache = null;
let framesAt = 0;

async function fetchRadarFrames() {
  if (framesCache && Date.now() - framesAt < FRAMES_TTL_MS) return framesCache;
  const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
  const data = await res.json();
  const past = data?.radar?.past;
  if (!Array.isArray(past) || !past.length) return framesCache || [];
  framesCache = past.map((f) => ({
    time: new Date(f.time * 1000),
    template: `${data.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`,
  }));
  framesAt = Date.now();
  return framesCache;
}

function renderPrecipImage(grid) {
  const W = 220, H = 220;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const { minLat, maxLat, minLon, maxLon } = grid.ext;
  for (let r = 0; r < H; r++) {
    const lat = maxLat - (r / H) * (maxLat - minLat);
    for (let c = 0; c < W; c++) {
      const lon = minLon + (c / W) * (maxLon - minLon);
      const mm = grid.sample(lon, lat);
      const col = mm == null ? null : precipColor(mm);
      const idx = (r * W + c) * 4;
      if (col) {
        img.data[idx] = col[0]; img.data[idx + 1] = col[1]; img.data[idx + 2] = col[2];
        img.data[idx + 3] = Math.round(col[3] * 255);
      } else {
        img.data[idx + 3] = 0;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

/** Standalone access for the scrubber (frames exist before any RadarLayer). */
export function getRadarFrames() {
  return fetchRadarFrames();
}

const RADAR_OPACITY = 0.65;

export class RadarLayer {
  constructor(map) {
    this.map = map;
    this.tileLayer = null;     // the visible frame
    this.pendingLayer = null;  // the next frame, loading invisibly
    this.imageOverlay = null;
    this.currentTemplate = null;
    this.frameSeq = 0;
  }

  /** Past radar frames, oldest → newest (newest = live). May be []. */
  getFrames() {
    return fetchRadarFrames();
  }

  makeTileLayer(template, opacity) {
    return L.tileLayer(template, {
      maxNativeZoom: 7,   // RainViewer free tier caps at z7; Leaflet overzooms
      maxZoom: 19,
      opacity,
      tileSize: 256,
      zIndex: 440,
    });
  }

  /** Show one past-radar tile frame; the newest frame is "live".
   * Double-buffered: the next frame loads invisibly on a second layer and
   * only swaps in once its tiles are ready — swapping the URL in place
   * blanks the layer while tiles reload, making playback "blink". After the
   * first full loop the browser cache makes swaps effectively instant. */
  async showFrame(template) {
    this.hideForecast();
    if (!template) {
      const frames = await fetchRadarFrames();
      template = frames[frames.length - 1]?.template;
      if (!template) return;
    }
    if (this.currentTemplate === template && this.tileLayer) return;
    const seq = ++this.frameSeq;

    if (!this.tileLayer) {
      this.tileLayer = this.makeTileLayer(template, RADAR_OPACITY).addTo(this.map);
      this.currentTemplate = template;
      return;
    }

    if (this.pendingLayer) { this.map.removeLayer(this.pendingLayer); this.pendingLayer = null; }
    const next = this.makeTileLayer(template, 0).addTo(this.map);
    this.pendingLayer = next;
    const swap = () => {
      if (seq !== this.frameSeq) { this.map.removeLayer(next); return; } // superseded
      next.setOpacity(RADAR_OPACITY);
      if (this.tileLayer) this.map.removeLayer(this.tileLayer);
      this.tileLayer = next;
      this.pendingLayer = null;
      this.currentTemplate = template;
    };
    next.once('load', swap);
    // Safety net: swap anyway if some tiles error out and 'load' stalls.
    setTimeout(() => { if (this.pendingLayer === next) swap(); }, 2000);
  }

  /** Latest radar frame (kept for compatibility with the live default). */
  showLive() {
    return this.showFrame(null);
  }

  hideLive() {
    this.frameSeq++;
    if (this.pendingLayer) { this.map.removeLayer(this.pendingLayer); this.pendingLayer = null; }
    if (this.tileLayer) { this.map.removeLayer(this.tileLayer); this.tileLayer = null; this.currentTemplate = null; }
  }

  showForecast(grid) {
    this.hideLive();
    this.hideForecast();
    if (!grid || !grid.hasAny) return;
    const url = renderPrecipImage(grid);
    this.imageOverlay = L.imageOverlay(url, gridLatLngBounds(grid.ext), { opacity: 0.85, zIndex: 440, interactive: false }).addTo(this.map);
  }

  hideForecast() {
    if (this.imageOverlay) { this.map.removeLayer(this.imageOverlay); this.imageOverlay = null; }
  }

  hide() { this.hideLive(); this.hideForecast(); }
}
