// Precipitation: live RainViewer radar (clipped to the coast, overzoomed past
// their z7 ceiling via Leaflet's maxNativeZoom) + forecast precip heatmap
// frames rendered from the Open-Meteo grid. Mirrors the iOS radar layer.

import { COAST_BOUNDS, precipColor } from './weather.js';

const coastLatLngBounds = () => L.latLngBounds(
  [COAST_BOUNDS.minLat, COAST_BOUNDS.minLon],
  [COAST_BOUNDS.maxLat, COAST_BOUNDS.maxLon]
);

async function latestFrame() {
  const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
  const data = await res.json();
  const frame = data?.radar?.past?.[data.radar.past.length - 1];
  if (!frame) return null;
  return `${data.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
}

function renderPrecipImage(grid) {
  const W = 220, H = 220;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const { minLat, maxLat, minLon, maxLon } = COAST_BOUNDS;
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

export class RadarLayer {
  constructor(map) {
    this.map = map;
    this.tileLayer = null;
    this.imageOverlay = null;
    this.liveTemplate = null;
  }

  async ensureLiveTemplate() {
    if (!this.liveTemplate) this.liveTemplate = await latestFrame();
    return this.liveTemplate;
  }

  async showLive() {
    this.hideForecast();
    if (this.tileLayer) return;
    const template = await this.ensureLiveTemplate();
    if (!template) return;
    this.tileLayer = L.tileLayer(template, {
      bounds: coastLatLngBounds(),
      maxNativeZoom: 7,   // RainViewer free tier caps at z7; Leaflet overzooms
      maxZoom: 19,
      opacity: 0.65,
      tileSize: 256,
      zIndex: 440,
    }).addTo(this.map);
  }

  hideLive() {
    if (this.tileLayer) { this.map.removeLayer(this.tileLayer); this.tileLayer = null; }
  }

  showForecast(grid) {
    this.hideLive();
    this.hideForecast();
    if (!grid || !grid.hasAny) return;
    const url = renderPrecipImage(grid);
    this.imageOverlay = L.imageOverlay(url, coastLatLngBounds(), { opacity: 0.85, zIndex: 440, interactive: false }).addTo(this.map);
  }

  hideForecast() {
    if (this.imageOverlay) { this.map.removeLayer(this.imageOverlay); this.imageOverlay = null; }
  }

  hide() { this.hideLive(); this.hideForecast(); }
}
