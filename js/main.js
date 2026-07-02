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
import { RadarLayer } from './layers/radar.js';
import { fmtHour } from './format.js';

function waitForLibraries() {
  return new Promise((resolve) => {
    const check = () => (typeof L !== 'undefined' && typeof Chart !== 'undefined') ? resolve() : setTimeout(check, 60);
    check();
  });
}

// ---- Weather layer + scrubber controller ----------------------------------

const weather = {
  windOn: false, radarOn: false, hour: 0, playing: false, playTimer: null,
  timeline: null, windLayer: null, radarLayer: null, map: null,

  async ensureTimeline() {
    if (this.timeline) return this.timeline;
    try { this.timeline = await fetchTimeline(); } catch (e) { console.warn('Wind/precip timeline failed', e); }
    return this.timeline;
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
    const tl = await this.ensureTimeline();
    if (this.windOn && tl && this.windLayer) {
      this.windLayer.setGrid(tl.windGrids[Math.min(this.hour, tl.windGrids.length - 1)]);
    }
  },

  async setRadar(on) {
    this.radarOn = on;
    document.getElementById('radar-btn').classList.toggle('active', on);
    if (on) {
      if (!this.radarLayer) this.radarLayer = new RadarLayer(this.map);
      if (this.hour > 0) await this.ensureTimeline();
      this.applyHour();
    } else if (this.radarLayer) {
      this.radarLayer.hide();
    }
    this.updateChrome();
  },

  applyHour() {
    const tl = this.timeline;
    if (this.windOn && this.windLayer && tl) {
      this.windLayer.setGrid(tl.windGrids[Math.min(this.hour, tl.windGrids.length - 1)]);
    }
    if (this.radarOn && this.radarLayer) {
      if (this.hour === 0) this.radarLayer.showLive();
      else if (tl) this.radarLayer.showForecast(tl.precipGrids[Math.min(this.hour, tl.precipGrids.length - 1)]);
    }
    this.updateLabel();
  },

  async setHour(h) {
    this.hour = h;
    if (h > 0) await this.ensureTimeline();
    this.applyHour();
  },

  updateLabel() {
    const label = document.getElementById('timeline-label');
    if (this.hour === 0 || !this.timeline) {
      label.textContent = 'Live';
      label.classList.add('live');
    } else {
      label.textContent = fmtHour(this.timeline.hours[Math.min(this.hour, this.timeline.hours.length - 1)]);
      label.classList.remove('live');
    }
  },

  togglePlay() {
    this.playing = !this.playing;
    const icon = document.querySelector('#timeline-play i');
    icon.className = this.playing ? 'ph-fill ph-pause' : 'ph-fill ph-play';
    if (this.playing) {
      this.playTimer = setInterval(() => {
        const max = this.timeline ? this.timeline.stepCount - 1 : 12;
        const range = document.getElementById('timeline-range');
        this.hour = this.hour >= max ? 0 : this.hour + 1;
        range.value = this.hour;
        this.applyHour();
      }, 900);
    } else {
      clearInterval(this.playTimer);
    }
  },

  updateChrome() {
    const anyOn = this.windOn || this.radarOn;
    document.getElementById('timeline-bar').classList.toggle('active', anyOn);
    if (!anyOn && this.playing) this.togglePlay();
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

  // Control cluster
  document.getElementById('wind-btn').addEventListener('click', () => weather.setWind(!weather.windOn));
  document.getElementById('radar-btn').addEventListener('click', () => weather.setRadar(!weather.radarOn));
  document.getElementById('favorites-btn').addEventListener('click', openFavorites);
  document.getElementById('settings-btn').addEventListener('click', openSettings);

  // Timeline scrubber
  document.getElementById('timeline-range').addEventListener('input', (e) => {
    if (weather.playing) weather.togglePlay();
    weather.setHour(+e.target.value);
  });
  document.getElementById('timeline-play').addEventListener('click', () => weather.togglePlay());

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
