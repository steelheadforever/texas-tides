// 7-day forecast panel — swipeable day cards with continuous tide sparklines
// (shared y-scale, midnight→midnight x-domain) matching the iOS forecast view.

import { fetchTidePredictions7Day } from '../api/noaa.js';
import { fetchWeatherForecast7Day } from '../api/nws.js';
import { fetchSunMoon7Day } from '../api/usno.js';
import { renderSparkline } from './charts.js';
import { openPanel } from '../panels.js';
import { getSettings } from '../settings.js';
import { fmtDay, fmtTime, fmtFeet, fmtWind, conditionIcon, moonIcon, escapeHtml } from '../format.js';

function centralDayKey(date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }); // YYYY-MM-DD
}

// Local maxima/minima of the dense prediction curve → hi/lo events for a day.
function findExtrema(points) {
  const events = [];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1].ft, cur = points[i].ft, next = points[i + 1].ft;
    if (cur >= prev && cur > next) events.push({ time: points[i].time, ft: cur, kind: 'High' });
    else if (cur <= prev && cur < next) events.push({ time: points[i].time, ft: cur, kind: 'Low' });
  }
  return events;
}

export async function openForecast(station) {
  document.getElementById('forecast-title').textContent = `7-Day · ${station.name}`;
  const body = document.getElementById('forecast-body');
  body.innerHTML = '<div class="loading">Loading forecast</div>';
  openPanel('forecast-panel');

  try {
    const [predictions, weather, sunMoon] = await Promise.all([
      fetchTidePredictions7Day(station.id),
      fetchWeatherForecast7Day(station.lat, station.lon),
      fetchSunMoon7Day(station.lat, station.lon),
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

    const unit = getSettings().windUnit;
    const days = weather && weather.length ? weather : [];
    const cards = days.map((day, idx) => {
      const key = centralDayKey(day.date);
      const dayPts = (predictions || []).filter((p) => centralDayKey(p.time) === key);
      const events = findExtrema(dayPts);
      const sm = sunMoon?.[idx];
      const ci = conditionIcon(day.shortForecast);
      const start = new Date(day.date); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(start.getDate() + 1);

      const eventsHtml = events.map((e) => {
        const high = e.kind === 'High';
        return `<div class="tide-event" style="font-size:0.82rem;padding:0.1rem 0;border:none;">
          <i class="ph-bold ${high ? 'ph-arrow-line-up' : 'ph-arrow-line-down'} ${high ? '' : ''}" style="color:var(--${high ? 'high' : 'low'})"></i>
          <span>${e.kind} ${fmtTime(e.time)}</span>
          <span class="te-height">${fmtFeet(e.ft)}</span>
        </div>`;
      }).join('');

      const windText = day.windGust > day.windSpeed
        ? `${escapeHtml(day.windDirection)} ${fmtWind(day.windSpeed, unit)}–${fmtWind(day.windGust, unit)}`
        : `${escapeHtml(day.windDirection)} ${fmtWind(day.windSpeed, unit)}`;

      return `<div class="day-card" data-idx="${idx}">
        <div class="day-card-title">${fmtDay(day.date)}</div>
        ${dayPts.length ? `<div class="chart-wrap" style="height:84px"><canvas class="fc-spark" data-idx="${idx}"></canvas></div>` : ''}
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

    body.innerHTML = `
      <div class="forecast-scroll" id="fc-scroll">${cards}</div>
      <div class="page-dots" id="fc-dots">${days.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}"></span>`).join('')}</div>
      <div class="scroll-hint"><i class="ph-bold ph-arrows-left-right"></i> Swipe for more days</div>`;

    requestAnimationFrame(() => {
      document.querySelectorAll('#forecast-body .fc-spark').forEach((canvas) => {
        const idx = +canvas.dataset.idx;
        const day = days[idx];
        const key = centralDayKey(day.date);
        const dayPts = (predictions || []).filter((p) => centralDayKey(p.time) === key);
        const start = new Date(day.date); start.setHours(0, 0, 0, 0);
        const end = new Date(start); end.setDate(start.getDate() + 1);
        renderSparkline(canvas, dayPts, { yMin, yMax, xMin: start, xMax: end, events: findExtrema(dayPts) });
      });
      wireDots();
    });
  } catch (err) {
    console.error('Forecast load failed:', err);
    body.innerHTML = emptyState();
    const r = document.getElementById('fc-retry');
    if (r) r.addEventListener('click', () => openForecast(station));
  }
}

function wireDots() {
  const scroll = document.getElementById('fc-scroll');
  const dots = [...document.querySelectorAll('#fc-dots .dot')];
  if (!scroll || !dots.length) return;
  scroll.addEventListener('scroll', () => {
    const cardW = scroll.scrollWidth / dots.length;
    const active = Math.round(scroll.scrollLeft / cardW);
    dots.forEach((d, i) => d.classList.toggle('active', i === active));
  });
}

function emptyState() {
  return `<div class="panel-empty">
    <i class="ph ph-wifi-slash"></i>
    Couldn't reach the forecast services. Check your connection.
    <div style="margin-top:1rem"><button class="btn btn-primary" id="fc-retry">Retry</button></div>
  </div>`;
}
