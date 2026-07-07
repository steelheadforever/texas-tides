// Slackwater web — application entry point.

import { applyAppearance, onSettingsChange, getSettings, isDark } from './settings.js';
import { initMap, switchMapTiles, panToStation } from './map.js';
import { openStation, initStationPanel } from './ui/stationPanel.js';
import { openForecast } from './ui/forecastPanel.js';
import { openSolunar, initSolunarPanel } from './ui/solunarPanel.js';
import { openFavorites, initFavoritesPanel } from './ui/favoritesPanel.js';
import { initSearch } from './ui/search.js';
import { openSettings } from './ui/settingsPanel.js';
import { maybeShowSafetyNotice } from './ui/safetyNotice.js';
import { refreshChartsTheme } from './ui/charts.js';
import { fetchTimeline, windColor, precipColor } from './layers/weather.js';
import { WindLayer } from './layers/wind.js';
import { RadarLayer, getRadarFrames } from './layers/radar.js';
import { fmtHour, fmtTime } from './format.js';

function waitForLibraries() {
  return new Promise((resolve) => {
    const check = () => (typeof L !== 'undefined' && typeof Chart !== 'undefined') ? resolve() : setTimeout(check, 60);
    check();
  });
}

// ---- Weather layer + scrubber controller ----------------------------------
//
// The scrubber spans one combined index space: RainViewer's past radar
// frames (10-minute steps, ~2h) on the left, "now" at the notch, then the
// 12 Open-Meteo forecast hours on the right.
//   idx < liveIndex  → a past radar frame (real observed radar)
//   idx = liveIndex  → live (latest radar frame)
//   idx > liveIndex  → forecast hour (idx - liveIndex) precip heatmap
// Wind only has forecast data, so it holds current conditions across the
// whole past segment. The past/future buttons pick which segment plays.

const FORECAST_STEPS = 12;

const weather = {
  windOn: false, radarOn: false, idx: 0, liveIndex: 0, frames: [],
  segment: 'future', playing: false, playTimer: null,
  timeline: null, windLayer: null, radarLayer: null, map: null,

  forecastHour() { return Math.max(0, this.idx - this.liveIndex); },
  isPast() { return this.idx < this.liveIndex; },

  // Load/refresh the past radar frame list and remap the thumb so it keeps
  // pointing at the same logical spot (live stays live, +3h stays +3h).
  async ensureFrames() {
    let frames = this.frames;
    try { frames = await getRadarFrames(); } catch { /* keep what we have */ }
    const wasLive = this.idx === this.liveIndex;
    const futureHour = this.idx > this.liveIndex ? this.idx - this.liveIndex : null;
    this.frames = frames || [];
    this.liveIndex = Math.max(0, this.frames.length - 1);
    this.idx = futureHour != null ? this.liveIndex + futureHour
      : wasLive ? this.liveIndex
      : Math.min(this.idx, this.liveIndex);
    this.syncSlider();
  },

  // Reflect the combined index space in the DOM: slider bounds/position, the
  // "now" notch, and the past button's availability.
  syncSlider() {
    const range = document.getElementById('timeline-range');
    const max = this.liveIndex + FORECAST_STEPS;
    range.max = max;
    range.value = this.idx;
    const notch = document.getElementById('timeline-notch');
    const frac = this.liveIndex / max;
    notch.style.left = `calc(8px + (100% - 16px) * ${frac})`; // 16px ≈ thumb width
    notch.classList.toggle('hidden', this.liveIndex === 0);
    document.getElementById('past-btn').disabled = this.liveIndex === 0;
    this.updateSegmentButtons();
    this.updateLabel();
  },

  updateSegmentButtons() {
    document.getElementById('past-btn').classList.toggle('active', this.segment === 'past');
    document.getElementById('future-btn').classList.toggle('active', this.segment === 'future');
  },

  viewRegion() {
    if (!this.map) return null;
    const b = this.map.getBounds();
    return { minLat: b.getSouth(), maxLat: b.getNorth(), minLon: b.getWest(), maxLon: b.getEast() };
  },

  async ensureTimeline() {
    // fetchTimeline caches per region + step, so this is a no-op while the
    // viewport stays inside the fetched lattice and the cache is fresh.
    try {
      this.timeline = await fetchTimeline(this.viewRegion());
      clearTimeout(this.retryTimer);
    } catch (e) {
      console.warn('Wind/precip timeline failed', e);
      // Rate-limited into total failure (e.g. rapid cross-country panning):
      // retry once things have cooled down so the layer heals without the
      // user having to nudge the map. Cleared on the next success.
      clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => this.onViewChanged(), 20_000);
    }
    return this.timeline;
  },

  // Map settled somewhere new: refetch the grids for the visible region, but
  // only while a grid-driven layer is showing (live + past radar are global
  // tiles and need nothing; idle panning must not fetch in the background).
  async onViewChanged() {
    if (!(this.windOn || (this.radarOn && this.idx > this.liveIndex))) return;
    const prev = this.timeline;
    const tl = await this.ensureTimeline();
    if (tl && tl !== prev) this.applyIdx();
  },

  async setWind(on) {
    this.windOn = on;
    document.getElementById('wind-btn').classList.toggle('active', on);
    this.updateChrome();
    if (!on) {
      if (this.windLayer) this.windLayer.stop();
      return;
    }
    // Start the canvas immediately so the layer is responsive, then apply the
    // grid as soon as the (possibly slow) timeline fetch resolves.
    if (!this.windLayer) this.windLayer = new WindLayer(this.map);
    this.windLayer.start();
    this.ensureFrames(); // cheap JSON; gives the scrubber its past segment
    const tl = await this.ensureTimeline();
    if (this.windOn && tl && this.windLayer) {
      this.windLayer.setGrid(tl.windGrids[Math.min(this.forecastHour(), tl.windGrids.length - 1)]);
    }
  },

  async setRadar(on) {
    this.radarOn = on;
    document.getElementById('radar-btn').classList.toggle('active', on);
    if (on) {
      if (!this.radarLayer) this.radarLayer = new RadarLayer(this.map);
      await this.ensureFrames();
      if (this.idx > this.liveIndex) await this.ensureTimeline();
      this.applyIdx();
    } else if (this.radarLayer) {
      this.radarLayer.hide();
    }
    this.updateChrome();
  },

  applyIdx() {
    const tl = this.timeline;
    const fh = this.forecastHour(); // 0 across the whole past segment
    if (this.windOn && this.windLayer && tl) {
      this.windLayer.setGrid(tl.windGrids[Math.min(fh, tl.windGrids.length - 1)]);
    }
    if (this.radarOn && this.radarLayer) {
      if (this.idx <= this.liveIndex) {
        this.radarLayer.showFrame(this.frames[this.idx]?.template || null);
      } else if (tl) {
        this.radarLayer.showForecast(tl.precipGrids[Math.min(fh, tl.precipGrids.length - 1)]);
      }
    }
    this.updateLabel();
  },

  async setIdx(i) {
    this.idx = i;
    this.segment = i < this.liveIndex ? 'past' : 'future';
    this.updateSegmentButtons();
    if (i > this.liveIndex) await this.ensureTimeline();
    this.applyIdx();
  },

  updateLabel() {
    const label = document.getElementById('timeline-label');
    if (this.isPast() && this.frames[this.idx]) {
      label.textContent = fmtTime(this.frames[this.idx].time);
      label.classList.remove('live');
    } else if (this.idx <= this.liveIndex || !this.timeline) {
      label.textContent = 'Live';
      label.classList.add('live');
    } else {
      label.textContent = fmtHour(this.timeline.hours[Math.min(this.forecastHour(), this.timeline.hours.length - 1)]);
      label.classList.remove('live');
    }
  },

  // Play loops within the selected segment: past = real radar history up to
  // live, future = live plus the forecast hours.
  playBounds() {
    return this.segment === 'past'
      ? [0, this.liveIndex]
      : [this.liveIndex, this.liveIndex + FORECAST_STEPS];
  },

  togglePlay() {
    this.playing = !this.playing;
    const icon = document.querySelector('#timeline-play i');
    icon.className = this.playing ? 'ph-fill ph-pause' : 'ph-fill ph-play';
    if (this.playing) {
      this.playTimer = setInterval(() => {
        const [lo, hi] = this.playBounds();
        const range = document.getElementById('timeline-range');
        this.idx = (this.idx >= hi || this.idx < lo) ? lo : this.idx + 1;
        range.value = this.idx;
        this.applyIdx();
      }, 900);
    } else {
      clearInterval(this.playTimer);
    }
  },

  // The past/future buttons: pick a segment, rewind to its start, and play.
  async playSegment(seg) {
    this.segment = seg;
    this.updateSegmentButtons();
    if (seg === 'past') await this.ensureFrames();
    else await this.ensureTimeline();
    this.idx = this.playBounds()[0];
    document.getElementById('timeline-range').value = this.idx;
    this.applyIdx();
    if (!this.playing) this.togglePlay();
  },

  updateChrome() {
    const anyOn = this.windOn || this.radarOn;
    document.getElementById('timeline-bar').classList.toggle('active', anyOn);
    if (!anyOn && this.playing) this.togglePlay();
    this.syncSlider();
    renderLegend(this.windOn, this.radarOn);
  },
};

function renderLegend(windOn, radarOn) {
  const legend = document.getElementById('legend');
  const show = (windOn || radarOn) && getSettings().showLegend;
  legend.classList.toggle('active', show);
  if (!show) return;
  const content = document.getElementById('legend-content');
  const windStops = [[1, '0'], [5, '7'], [11, '18'], [18, '34'], [26, '49'], [35, '67+']];
  const precipStops = [[0.3, 'Light'], [1, ''], [2.5, 'Mod'], [6, ''], [12, 'Heavy'], [20, '']];
  let html = '';
  if (windOn) {
    html += `<div class="legend-group"><div class="legend-group-title">Wind (mph)</div>
      <div class="legend-ramp">${windStops.map(([s]) => `<span style="background:${windColor(s).replace('ALPHA', '1')}"></span>`).join('')}</div>
      <div class="legend-scale">${windStops.map(([, l]) => `<span>${l}</span>`).join('')}</div></div>`;
  }
  if (radarOn) {
    html += `<div class="legend-group"><div class="legend-group-title">Rain</div>
      <div class="legend-ramp">${precipStops.map(([mm]) => { const c = precipColor(mm); return `<span style="background:rgba(${c[0]},${c[1]},${c[2]},${c[3]})"></span>`; }).join('')}</div>
      <div class="legend-scale">${precipStops.map(([, l]) => `<span>${l}</span>`).join('')}</div></div>`;
  }
  content.innerHTML = html;
}

// ---- Boot -----------------------------------------------------------------

async function init() {
  applyAppearance();
  await waitForLibraries();

  const map = initMap(openStation);
  weather.map = map;

  initStationPanel({ onForecast: openForecast, onSolunar: openSolunar });
  initSolunarPanel();
  initFavoritesPanel({ onSelect: (station) => { panToStation(station); openStation(station); } });
  initSearch({ onSelect: (station) => { panToStation(station); openStation(station); } });

  // Warm the wind/precip grid a couple seconds after load so the wind layer
  // appears instantly on first click instead of waiting on a cold fetch.
  setTimeout(() => { weather.ensureTimeline(); }, 2000);

  // Refetch weather grids for the new region once the map settles (debounced;
  // onViewChanged bails immediately unless a grid-driven layer is active).
  let settleTimer = null;
  map.on('moveend zoomend', () => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => weather.onViewChanged(), 600);
  });

  // Control cluster
  document.getElementById('wind-btn').addEventListener('click', () => weather.setWind(!weather.windOn));
  document.getElementById('radar-btn').addEventListener('click', () => weather.setRadar(!weather.radarOn));
  document.getElementById('favorites-btn').addEventListener('click', openFavorites);
  document.getElementById('settings-btn').addEventListener('click', openSettings);

  // Timeline scrubber
  document.getElementById('timeline-range').addEventListener('input', (e) => {
    if (weather.playing) weather.togglePlay();
    weather.setIdx(+e.target.value);
  });
  document.getElementById('timeline-play').addEventListener('click', () => weather.togglePlay());
  document.getElementById('past-btn').addEventListener('click', () => weather.playSegment('past'));
  document.getElementById('future-btn').addEventListener('click', () => weather.playSegment('future'));

  // Legend collapse
  document.getElementById('legend-collapse').addEventListener('click', () => {
    const legend = document.getElementById('legend');
    legend.classList.toggle('collapsed');
    document.getElementById('legend-content').style.display = legend.classList.contains('collapsed') ? 'none' : 'block';
  });

  // React to settings changes
  let wasDark = isDark();
  onSettingsChange(() => {
    if (isDark() !== wasDark) { wasDark = isDark(); switchMapTiles(wasDark); refreshChartsTheme(); }
    renderLegend(weather.windOn, weather.radarOn);
  });

  // One-time safety notice (first launch only).
  maybeShowSafetyNotice();

  console.log('Slackwater web initialized');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
