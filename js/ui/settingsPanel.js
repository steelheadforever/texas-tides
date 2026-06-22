// Settings panel — appearance, wind units, legend visibility.

import { openPanel } from '../panels.js';
import { getSettings, setSetting } from '../settings.js';

export function openSettings() {
  render();
  openPanel('settings-panel');
}

function segmented(key, options, current) {
  return `<div class="segmented" data-key="${key}">
    ${options.map((o) => `<button data-value="${o.value}" class="${o.value === current ? 'active' : ''}">${o.label}</button>`).join('')}
  </div>`;
}

function render() {
  const s = getSettings();
  const body = document.getElementById('settings-body');
  body.innerHTML = `
    <div class="card">
      <div class="card-label"><i class="ph ph-paint-brush"></i>Appearance</div>
      <div class="setting-row">
        <span class="label">Theme</span>
        ${segmented('appearance', [
          { value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' },
        ], s.appearance)}
      </div>
    </div>
    <div class="card">
      <div class="card-label"><i class="ph ph-wind"></i>Units</div>
      <div class="setting-row">
        <span class="label">Wind speed</span>
        ${segmented('windUnit', [{ value: 'mph', label: 'mph' }, { value: 'knots', label: 'knots' }], s.windUnit)}
      </div>
    </div>
    <div class="card">
      <div class="card-label"><i class="ph ph-map-trifold"></i>Map</div>
      <div class="setting-row">
        <span class="label">Show layer legend</span>
        <label class="switch"><input type="checkbox" id="set-legend" ${s.showLegend ? 'checked' : ''}><span class="slider"></span></label>
      </div>
    </div>
    <p style="font-size:0.72rem;color:var(--text-secondary);padding:0 0.3rem;">
      Tides &amp; conditions from NOAA CO-OPS. Weather from the National Weather Service. Sun &amp; moon from the U.S. Naval Observatory. Radar via RainViewer. Forecast grids from Open-Meteo.
    </p>`;

  body.querySelectorAll('.segmented').forEach((seg) => {
    seg.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      setSetting(seg.dataset.key, btn.dataset.value);
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });
  body.querySelector('#set-legend').addEventListener('change', (e) => {
    setSetting('showLegend', e.target.checked);
  });
}
