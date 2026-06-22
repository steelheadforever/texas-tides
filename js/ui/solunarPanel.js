// 30-day solunar table panel. Computes everything client-side via solunar.js.

import { solunarDays } from '../solunar.js';
import { openPanel } from '../panels.js';
import { fmtDay, fmtTime, moonIcon, escapeHtml } from '../format.js';

let aboutVisible = false;

export function initSolunarPanel() {
  document.getElementById('solunar-info').addEventListener('click', () => {
    aboutVisible = !aboutVisible;
    const el = document.getElementById('solunar-about');
    if (el) el.style.display = aboutVisible ? 'block' : 'none';
  });
}

export function openSolunar(station) {
  document.getElementById('solunar-title').textContent = `Solunar · ${station.name}`;
  const body = document.getElementById('solunar-body');
  body.innerHTML = '<div class="loading">Calculating</div>';
  openPanel('solunar-panel');

  // Defer the heavy math one frame so the panel paints first.
  setTimeout(() => {
    const days = solunarDays(station.lat, station.lon, 30);
    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
    body.innerHTML = aboutCard() + days.map((d) => dayCard(d, todayKey)).join('');
    const aboutEl = document.getElementById('solunar-about');
    if (aboutEl) aboutEl.style.display = aboutVisible ? 'block' : 'none';
  }, 30);
}

function aboutCard() {
  return `<div class="card" id="solunar-about" style="display:none">
    <div class="card-label"><i class="ph ph-info"></i>Solunar Periods</div>
    <p style="font-size:0.85rem;color:var(--text-secondary)">Fish and game feed most during <strong>major periods</strong> (moon overhead or underfoot, ~2 hrs) and <strong>minor periods</strong> (moonrise and moonset, ~1 hr). Activity peaks around the new and full moon, and when a period lines up with sunrise or sunset.</p>
  </div>`;
}

function fishRating(rating) {
  let html = '';
  for (let i = 0; i < 4; i++) {
    const on = i < rating.fishCount;
    html += `<i class="ph-fill ph-fish ${on ? 'on-' + rating.level : ''}"></i>`;
  }
  return `<span class="fish-rating" title="${rating.level}">${html}</span>`;
}

function periodRow(kind, periods) {
  const cls = kind.toLowerCase();
  const times = periods.length
    ? periods.map((p) => `<span>${fmtTime(p.start)} – ${fmtTime(p.end)}</span>`).join('')
    : '<span style="color:var(--text-tertiary)">—</span>';
  return `<div class="period-row"><span class="period-kind ${cls}">${kind}</span><span class="times">${times}</span></div>`;
}

function dayCard(d, todayKey) {
  const dayKey = d.date.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const isToday = dayKey === todayKey;
  return `<div class="card solunar-day ${isToday ? 'today' : ''}">
    <div class="solunar-head">
      <span class="day-card-title">${fmtDay(d.date)}</span>
      ${isToday ? '<span class="today-badge">TODAY</span>' : ''}
      ${fishRating(d.rating)}
    </div>
    ${periodRow('Major', d.majors)}
    ${d.minors.length ? periodRow('Minor', d.minors) : ''}
    <div class="divider" style="height:1px;background:var(--hairline);margin:0.4rem 0"></div>
    <div class="day-meta">
      <span><i class="ph-fill ph-sun-horizon icon-sunrise"></i> ${d.sunrise ? fmtTime(d.sunrise) : '—'}</span>
      <span><i class="ph-fill ph-sun-horizon icon-sunset"></i> ${d.sunset ? fmtTime(d.sunset) : '—'}</span>
      <span style="margin-left:auto"><i class="${moonIcon(d.phaseName)}"></i> ${Math.round(d.illumination * 100)}%</span>
    </div>
  </div>`;
}
