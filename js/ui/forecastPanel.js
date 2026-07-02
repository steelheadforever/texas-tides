// 7-day forecast panel — day cards stacked vertically (matching the other
// panels), each with a tide sparkline + real NOAA high/low events.

import { fetchTidePredictions7Day, fetchTideHilo7Day } from '../api/noaa.js';
import { fetchWeatherForecast7Day } from '../api/nws.js';
import { fetchSunMoon7Day } from '../api/usno.js';
import { renderSparkline } from './charts.js';
import { openPanel } from '../panels.js';
import { getSettings } from '../settings.js';
import { fmtDay, fmtTime, fmtFeet, fmtWind, dayKey, tzMidnight, conditionIcon, moonIcon, escapeHtml } from '../format.js';

export async function openForecast(station) {
  // Bucket everything into the station's local calendar days.
  const dkey = (date) => dayKey(date, station.tz);
  document.getElementById('forecast-title').textContent = `7-Day · ${station.name}`;
  const body = document.getElementById('forecast-body');
  body.innerHTML = '<div class="loading">Loading forecast</div>';
  openPanel('forecast-panel');

  try {
    const [predictions, hilo, weather, sunMoon] = await Promise.all([
      fetchTidePredictions7Day(station.id, station.tz),
      fetchTideHilo7Day(station.id, station.tz),
      fetchWeatherForecast7Day(station.lat, station.lon),
      fetchSunMoon7Day(station.lat, station.lon, station.tz),
    ]);

    const allWeatherMissing = !weather || weather.every((d) => !d.shortForecast || d.shortForecast === 'N/A');
    if (allWeatherMissing && (!predictions || !predictions.length)) {
      body.innerHTML = emptyState();
      const r = document.getElementById('fc-retry');
      if (r) r.addEventListener('click', () => openForecast(station));
      return;
    }

    // Shared y-range across the whole week (±15%) for a continuous line.
    let yMin, yMax;
    if (predictions?.length) {
      const ys = predictions.map((p) => p.ft);
      const lo = Math.min(...ys), hi = Math.max(...ys), pad = (hi - lo) * 0.15;
      yMin = lo - pad; yMax = hi + pad;
    }

    // Bucket the real high/low events by station-local day.
    const hiloByDay = {};
    for (const e of (hilo || [])) {
      const k = dkey(e.time);
      if (!hiloByDay[k]) hiloByDay[k] = [];
      hiloByDay[k].push(e);
    }

    const unit = getSettings().windUnit;
    const days = weather && weather.length ? weather : [];
    const cards = days.map((day, idx) => {
      const key = dkey(day.date);
      const dayPts = (predictions || []).filter((p) => dkey(p.time) === key);
      const events = hiloByDay[key] || [];
      const sm = sunMoon?.[idx];
      const ci = conditionIcon(day.shortForecast);

      const eventsHtml = events.map((e) => {
        const high = e.kind === 'High';
        return `<div class="tide-event" style="font-size:0.82rem;padding:0.1rem 0;border:none;">
          <i class="ph-bold ${high ? 'ph-arrow-line-up' : 'ph-arrow-line-down'}" style="color:var(--${high ? 'high' : 'low'})"></i>
          <span>${e.kind} ${fmtTime(e.time)}</span>
          <span class="te-height">${fmtFeet(e.ft)}</span>
        </div>`;
      }).join('');

      const windText = day.windGust > day.windSpeed
        ? `${escapeHtml(day.windDirection)} ${fmtWind(day.windSpeed, unit)}–${fmtWind(day.windGust, unit)}`
        : `${escapeHtml(day.windDirection)} ${fmtWind(day.windSpeed, unit)}`;

      return `<div class="card day-card" data-idx="${idx}">
        <div class="day-card-title">${fmtDay(day.date)}</div>
        ${dayPts.length ? `<div class="chart-wrap" style="height:96px"><canvas class="fc-spark" data-idx="${idx}"></canvas></div>` : ''}
        ${eventsHtml ? `<div>${eventsHtml}</div>` : ''}
        <div class="divider"></div>
        <div class="sub"><i class="${ci.icon}" style="color:${ci.color}"></i><span>${escapeHtml(day.shortForecast || 'N/A')}</span></div>
        <div class="day-meta">
          ${day.tempHigh != null ? `<span><i class="ph-bold ph-arrow-up"></i> ${day.tempHigh}°</span>` : ''}
          ${day.tempLow != null ? `<span><i class="ph-bold ph-arrow-down"></i> ${day.tempLow}°</span>` : ''}
          <span><i class="ph-fill ph-drop"></i> ${day.precipProbability ?? 0}%</span>
          <span><i class="ph ph-wind"></i> ${windText}</span>
        </div>
        ${sm ? `<div class="divider"></div>
          <div class="day-meta">
            <span><i class="ph-fill ph-sun-horizon icon-sunrise"></i> ${escapeHtml(sm.sunrise)}</span>
            <span><i class="ph-fill ph-sun-horizon icon-sunset"></i> ${escapeHtml(sm.sunset)}</span>
            <span><i class="${moonIcon(sm.moonPhase)}"></i> ${escapeHtml(sm.moonPhase)}</span>
          </div>` : ''}
      </div>`;
    }).join('');

    body.innerHTML = cards;

    requestAnimationFrame(() => {
      document.querySelectorAll('#forecast-body .fc-spark').forEach((canvas) => {
        const idx = +canvas.dataset.idx;
        const day = days[idx];
        const key = dkey(day.date);
        const dayPts = (predictions || []).filter((p) => dkey(p.time) === key);
        // Sparkline x-range: the station-local day, not the viewer-local one.
        const [yy, mm, dd] = key.split('-').map(Number);
        const start = tzMidnight(yy, mm - 1, dd, station.tz);
        const end = new Date(start.getTime() + 24 * 3600000);
        renderSparkline(canvas, dayPts, { yMin, yMax, xMin: start, xMax: end, events: hiloByDay[key] || [], showTimeAxis: true, tz: station.tz });
      });
    });
  } catch (err) {
    console.error('Forecast load failed:', err);
    body.innerHTML = emptyState();
    const r = document.getElementById('fc-retry');
    if (r) r.addEventListener('click', () => openForecast(station));
  }
}

function emptyState() {
  return `<div class="panel-empty">
    <i class="ph ph-wifi-slash"></i>
    Couldn't reach the forecast services. Check your connection.
    <div style="margin-top:1rem"><button class="btn btn-primary" id="fc-retry">Retry</button></div>
  </div>`;
}
