// Client-side solunar engine — JS port of the iOS Shared/Support/Solunar.swift.
// Truncated-Meeus sun/moon position, altitude sampling for transit/rise/set,
// illumination from elongation. Pure + offline.

import { tzMidnight } from './format.js';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const norm360 = (d) => { const x = d % 360; return x < 0 ? x + 360 : x; };

export function julianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

export function sunEquatorial(jd) {
  const t = (jd - 2451545.0) / 36525;
  const L0 = norm360(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
  const M = norm360(357.52911 + 35999.05029 * t - 0.0001537 * t * t) * RAD;
  const C = (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(M)
    + (0.019993 - 0.000101 * t) * Math.sin(2 * M)
    + 0.000289 * Math.sin(3 * M);
  const trueLong = L0 + C;
  const omega = (125.04 - 1934.136 * t) * RAD;
  const lambda = (trueLong - 0.00569 - 0.00478 * Math.sin(omega)) * RAD;
  const eps = (23.439291 - 0.0130042 * t + 0.00256 * Math.cos(omega)) * RAD;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  return { ra: norm360(ra * DEG), dec: dec * DEG, lon: norm360(trueLong - 0.00569 - 0.00478 * Math.sin(omega)) };
}

// [coeff*1e-6 deg, D, M, M', F]
const LON_TERMS = [
  [6288774, 0, 0, 1, 0], [1274027, 2, 0, -1, 0], [658314, 2, 0, 0, 0],
  [213618, 0, 0, 2, 0], [-185116, 0, 1, 0, 0], [-114332, 0, 0, 0, 2],
  [58793, 2, 0, -2, 0], [57066, 2, -1, -1, 0], [53322, 2, 0, 1, 0],
  [45758, 2, -1, 0, 0], [-40923, 0, 1, -1, 0], [-34720, 1, 0, 0, 0],
  [-30383, 0, 1, 1, 0], [15327, 2, 0, 0, -2], [-12528, 0, 0, 1, 2],
  [10980, 0, 0, 1, -2], [10675, 4, 0, -1, 0], [10034, 0, 0, 3, 0],
  [8548, 4, 0, -2, 0], [-7888, 2, 1, -1, 0], [-6766, 2, 1, 0, 0],
];
const LAT_TERMS = [
  [5128122, 0, 0, 0, 1], [280602, 0, 0, 1, 1], [277693, 0, 0, 1, -1],
  [173237, 2, 0, 0, -1], [55413, 2, 0, -1, 1], [46271, 2, 0, -1, -1],
  [32573, 2, 0, 0, 1], [17198, 0, 0, 2, 1], [9266, 2, 0, 1, -1],
  [8822, 0, 0, 2, -1], [8216, 2, -1, 0, -1], [4324, 2, 0, -2, -1],
  [4200, 2, 0, 1, 1],
];

export function moonEquatorial(jd) {
  const t = (jd - 2451545.0) / 36525;
  const Lp = 218.3164477 + 481267.88123421 * t - 0.0015786 * t * t + t * t * t / 538841 - t * t * t * t / 65194000;
  const D = (297.8501921 + 445267.1114034 * t - 0.0018819 * t * t + t * t * t / 545868) * RAD;
  const M = (357.5291092 + 35999.0502909 * t - 0.0001536 * t * t) * RAD;
  const Mp = (134.9633964 + 477198.8675055 * t + 0.0087414 * t * t + t * t * t / 69699) * RAD;
  const F = (93.2720950 + 483202.0175233 * t - 0.0036539 * t * t - t * t * t / 3526000) * RAD;

  let sumL = 0, sumB = 0;
  for (const [c, d, m, mp, f] of LON_TERMS) sumL += c * Math.sin(D * d + M * m + Mp * mp + F * f);
  for (const [c, d, m, mp, f] of LAT_TERMS) sumB += c * Math.sin(D * d + M * m + Mp * mp + F * f);

  const lambda = norm360(Lp + sumL / 1e6);
  const beta = (sumB / 1e6) * RAD;
  const lamR = lambda * RAD;
  const eps = (23.439291 - 0.0130042 * t) * RAD;
  const ra = Math.atan2(Math.sin(lamR) * Math.cos(eps) - Math.tan(beta) * Math.sin(eps), Math.cos(lamR));
  const dec = Math.asin(Math.sin(beta) * Math.cos(eps) + Math.cos(beta) * Math.sin(eps) * Math.sin(lamR));
  return { ra: norm360(ra * DEG), dec: dec * DEG, lon: lambda };
}

function gmst(jd) {
  const t = (jd - 2451545.0) / 36525;
  return norm360(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t - t * t * t / 38710000);
}

function altitude(ra, dec, latDeg, lonEastDeg, jd) {
  const lst = norm360(gmst(jd) + lonEastDeg);
  const H = norm360(lst - ra) * RAD;
  const phi = latDeg * RAD, d = dec * RAD;
  const sinAlt = Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H);
  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) * DEG;
}

export function moonIllumination(jd) {
  const s = sunEquatorial(jd), m = moonEquatorial(jd);
  const elong = Math.abs(m.lon - s.lon) * RAD;
  return (1 - Math.cos(elong)) / 2;
}

// ---- Station-local day boundaries ------------------------------------------

function todayYMD(now, tz) {
  const [y, mo, d] = now.toLocaleDateString('en-CA', { timeZone: tz }).split('-').map(Number);
  return [y, mo - 1, d];
}

// ---- Crossings / extrema --------------------------------------------------

function crossing(times, alts, threshold, rising) {
  for (let i = 1; i < alts.length; i++) {
    const a = alts[i - 1] - threshold, b = alts[i] - threshold;
    const crosses = rising ? (a < 0 && b >= 0) : (a >= 0 && b < 0);
    if (crosses) {
      const frac = a / (a - b);
      return new Date(times[i - 1].getTime() + frac * (times[i].getTime() - times[i - 1].getTime()));
    }
  }
  return null;
}

function interiorExtremum(times, alts, maximum) {
  let best = -1, bestVal = maximum ? -Infinity : Infinity;
  for (let i = 1; i < alts.length - 1; i++) {
    const v = alts[i];
    const isExtreme = maximum
      ? (v >= alts[i - 1] && v >= alts[i + 1] && v > bestVal)
      : (v <= alts[i - 1] && v <= alts[i + 1] && v < bestVal);
    if (isExtreme) { best = i; bestVal = v; }
  }
  if (best <= 0) return null;
  const y0 = alts[best - 1], y1 = alts[best], y2 = alts[best + 1];
  const denom = y0 - 2 * y1 + y2;
  const offset = denom === 0 ? 0 : 0.5 * (y0 - y2) / denom;
  const dt = times[best].getTime() - times[best - 1].getTime();
  return new Date(times[best].getTime() + offset * dt);
}

function phaseName(illum, waxing) {
  if (illum < 0.02) return 'New Moon';
  if (illum > 0.98) return 'Full Moon';
  if (illum > 0.48 && illum < 0.52) return waxing ? 'First Quarter' : 'Last Quarter';
  if (waxing) return illum < 0.5 ? 'Waxing Crescent' : 'Waxing Gibbous';
  return illum < 0.5 ? 'Waning Crescent' : 'Waning Gibbous';
}

const RATINGS = ['poor', 'average', 'good', 'excellent'];

function rate(illum, periods, sunrise, sunset) {
  const strength = Math.abs(0.5 - illum) * 2;
  let level = strength > 0.85 ? 3 : strength > 0.55 ? 2 : strength > 0.25 ? 1 : 0;
  const suns = [sunrise, sunset].filter(Boolean);
  const coincides = periods.some((p) => {
    const center = (p.start.getTime() + p.end.getTime()) / 2;
    return suns.some((s) => Math.abs(center - s.getTime()) <= 3600000);
  });
  if (coincides && level < 3) level += 1;
  return { level: RATINGS[level], fishCount: level + 1 };
}

function makePeriod(kind, center, halfMin) {
  return { kind, start: new Date(center.getTime() - halfMin * 60000), end: new Date(center.getTime() + halfMin * 60000) };
}

/** `count` consecutive station-local days of solunar data for a location.
 * `tz` is the station's IANA timezone; defaults to Central for the legacy
 * Texas station list. */
export function solunarDays(latitude, longitude, count = 30, now = new Date(), tz = 'America/Chicago') {
  const [y, mo, d] = todayYMD(now, tz);
  const out = [];
  for (let offset = 0; offset < count; offset++) {
    const dayStart = tzMidnight(y, mo, d + offset, tz);
    out.push(computeDay(dayStart, latitude, longitude));
  }
  return out;
}

function computeDay(dayStart, lat, lon) {
  const steps = 288; // 5-min over 24h
  const times = [], moonAlt = [], sunAlt = [];
  for (let i = 0; i <= steps; i++) {
    const t = new Date(dayStart.getTime() + i * 5 * 60000);
    const jd = julianDate(t);
    const moon = moonEquatorial(jd), sun = sunEquatorial(jd);
    times.push(t);
    moonAlt.push(altitude(moon.ra, moon.dec, lat, lon, jd));
    sunAlt.push(altitude(sun.ra, sun.dec, lat, lon, jd));
  }

  const moonrise = crossing(times, moonAlt, 0.125, true);
  const moonset = crossing(times, moonAlt, 0.125, false);
  const sunrise = crossing(times, sunAlt, -0.833, true);
  const sunset = crossing(times, sunAlt, -0.833, false);
  const upper = interiorExtremum(times, moonAlt, true);
  const lower = interiorExtremum(times, moonAlt, false);

  const majors = [];
  if (upper) majors.push(makePeriod('major', upper, 60));
  if (lower) majors.push(makePeriod('major', lower, 60));
  const minors = [];
  if (moonrise) minors.push(makePeriod('minor', moonrise, 30));
  if (moonset) minors.push(makePeriod('minor', moonset, 30));
  majors.sort((a, b) => a.start - b.start);
  minors.sort((a, b) => a.start - b.start);

  const noonJD = julianDate(new Date(dayStart.getTime() + 12 * 3600000));
  const illum = moonIllumination(noonJD);
  const waxing = moonIllumination(noonJD + 0.25) > illum;

  return {
    date: dayStart,
    illumination: illum,
    phaseName: phaseName(illum, waxing),
    majors, minors, sunrise, sunset, moonrise, moonset,
    rating: rate(illum, [...majors, ...minors], sunrise, sunset),
  };
}
