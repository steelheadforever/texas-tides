// Chart.js helpers styled to match the iOS TideCurveChart. Colors are read
// from CSS variables so charts follow light/dark automatically.

const charts = new Map(); // canvas element -> Chart instance

function cssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function destroyFor(canvas) {
  const existing = charts.get(canvas);
  if (existing) { existing.destroy(); charts.delete(canvas); }
}

// Inline plugin: dashed vertical "now" line. Chart-local, no registration.
function nowLinePlugin() {
  return {
    id: 'nowLine',
    afterDraw(chart) {
      const x = chart.scales.x;
      if (!x) return;
      const now = Date.now();
      if (now < x.min || now > x.max) return;
      const px = x.getPixelForValue(now);
      const { top, bottom } = chart.chartArea;
      const ctx = chart.ctx;
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = cssVar('--text-tertiary');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, top);
      ctx.lineTo(px, bottom);
      ctx.stroke();
      ctx.restore();
    },
  };
}

function pts(arr) {
  return (arr || []).map((p) => ({ x: p.time instanceof Date ? p.time : new Date(p.time), y: p.ft ?? p.value ?? p.y }));
}

/**
 * Full 24h tide curve: predicted (blue + soft fill) vs observed (red), hi/lo
 * markers, now line.
 * @param curve { predicted:{times,heights}|null, observed:{times,heights}|null, noPredictions }
 * @param events [{time, ft, kind}]
 */
export function renderTideCurve(canvas, curve, events = []) {
  destroyFor(canvas);
  const tide = cssVar('--tide');
  const observed = cssVar('--observed');
  const high = cssVar('--high');
  const low = cssVar('--low');

  const predictedPts = curve?.predicted
    ? curve.predicted.times.map((t, i) => ({ x: t, y: curve.predicted.heights[i] }))
    : [];
  const observedPts = curve?.observed
    ? curve.observed.times.map((t, i) => ({ x: t, y: curve.observed.heights[i] }))
    : [];
  const eventPts = events.map((e) => ({ x: e.time, y: e.ft, kind: e.kind }));

  const datasets = [];
  if (predictedPts.length) {
    datasets.push({
      label: 'Predicted', data: predictedPts, borderColor: tide,
      backgroundColor: cssVar('--tide-area'), fill: true, tension: 0.4,
      borderWidth: 2, pointRadius: 0,
    });
  }
  if (observedPts.length) {
    datasets.push({
      label: 'Observed', data: observedPts, borderColor: observed,
      fill: false, tension: 0.4, borderWidth: 2, pointRadius: 0,
    });
  }
  if (eventPts.length) {
    datasets.push({
      label: 'Tides', data: eventPts, showLine: false,
      pointRadius: 4, pointHoverRadius: 5,
      pointBackgroundColor: eventPts.map((e) => (e.kind === 'High' ? high : low)),
      pointBorderColor: eventPts.map((e) => (e.kind === 'High' ? high : low)),
    });
  }

  const chart = new Chart(canvas, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { type: 'time', time: { unit: 'hour' }, grid: { display: false },
             ticks: { color: cssVar('--text-secondary'), maxTicksLimit: 5, font: { size: 10 } } },
        y: { grid: { color: cssVar('--hairline') },
             ticks: { color: cssVar('--text-secondary'), font: { size: 10 } } },
      },
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
    },
    plugins: [nowLinePlugin()],
  });
  charts.set(canvas, chart);
  return chart;
}

/**
 * Minimal sparkline (forecast day cards + favorites). `points` = [{time, ft}].
 * yDomain pins a shared scale; events draw hi/lo dots.
 */
export function renderSparkline(canvas, points, { yMin, yMax, events = [], xMin, xMax, showNow = true, showTimeAxis = false } = {}) {
  destroyFor(canvas);
  const tide = cssVar('--tide');
  const high = cssVar('--high');
  const low = cssVar('--low');
  const data = pts(points);

  const datasets = [{
    data, borderColor: tide, backgroundColor: cssVar('--tide-area'),
    fill: true, tension: 0.4, borderWidth: 1.5, pointRadius: 0,
  }];
  if (events.length) {
    datasets.push({
      data: events.map((e) => ({ x: e.time, y: e.ft, kind: e.kind })), showLine: false,
      pointRadius: 2.5,
      pointBackgroundColor: events.map((e) => (e.kind === 'High' ? high : low)),
      pointBorderColor: events.map((e) => (e.kind === 'High' ? high : low)),
    });
  }

  const chart = new Chart(canvas, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: showTimeAxis
          ? {
              type: 'time', min: xMin, max: xMax,
              time: { unit: 'hour', displayFormats: { hour: 'ha' } },
              grid: { display: false }, border: { display: false },
              ticks: { color: cssVar('--text-secondary'), font: { size: 9 }, maxRotation: 0, autoSkip: false },
              // Chart.js ignores time.stepSize here, so pin the markers to a
              // fixed 6-hour set (12AM/6AM/12PM/6PM) for consistency everywhere.
              afterTickToLabelConversion(scale) {
                const keep = new Set(['12AM', '6AM', '12PM', '6PM']);
                scale.ticks = scale.ticks.filter((t) => keep.has(t.label));
              },
            }
          : { type: 'time', display: false, min: xMin, max: xMax },
        y: { display: false, min: yMin, max: yMax },
      },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
    },
    plugins: showNow ? [nowLinePlugin()] : [],
  });
  charts.set(canvas, chart);
  return chart;
}

/** 24h water-temperature trend (teal). `history` = [{time, temp}]. */
export function renderWaterTemp(canvas, history) {
  destroyFor(canvas);
  const teal = cssVar('--water-temp');
  const data = history.map((h) => ({ x: h.time, y: h.temp }));
  const chart = new Chart(canvas, {
    type: 'line',
    data: { datasets: [{ data, borderColor: teal, fill: false, tension: 0.4, borderWidth: 2, pointRadius: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { type: 'time', time: { unit: 'hour' }, grid: { display: false },
             ticks: { color: cssVar('--text-secondary'), maxTicksLimit: 5, font: { size: 10 } } },
        y: { grid: { color: cssVar('--hairline') }, ticks: { color: cssVar('--text-secondary'), font: { size: 10 } } },
      },
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
    },
  });
  charts.set(canvas, chart);
  return chart;
}

/** Recolor all live charts after a theme switch. */
export function refreshChartsTheme() {
  charts.forEach((chart) => {
    // Cheapest correct path: re-read vars by updating known color options.
    chart.update();
  });
}
