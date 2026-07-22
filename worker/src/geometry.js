// GeoJSON simplification for the alert-zone map layer. NWS zone polygons
// trace the coastline in survey detail — hundreds of KB per zone — while the
// map draws them as a tinted wash at coastal zoom levels. Douglas-Peucker at
// ~0.005° (≈500 m) keeps the recognizable shape at a few KB.

// Perpendicular distance from p to the segment a-b, in degrees (fine for
// simplification tolerance — we never measure real distances with it).
function perpDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

// Iterative Douglas-Peucker (explicit stack — coastline rings can be deep
// enough to overflow recursion).
export function simplifyRing(points, epsilon) {
  if (points.length <= 4) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDist = 0;
    let index = 0;
    for (let i = first + 1; i < last; i++) {
      const d = perpDistance(points[i], points[first], points[last]);
      if (d > maxDist) { maxDist = d; index = i; }
    }
    if (maxDist > epsilon) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }
  const out = points.filter((_, i) => keep[i]);
  // A ring needs 4 points (closed) to be drawable; below that the
  // simplification ate the shape — keep the original.
  return out.length >= 4 ? out : points;
}

export function simplifyGeometry(geometry, epsilon = 0.005) {
  if (!geometry) return geometry;
  if (geometry.type === 'Polygon') {
    return { type: 'Polygon', coordinates: geometry.coordinates.map((r) => simplifyRing(r, epsilon)) };
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates.map((poly) => poly.map((r) => simplifyRing(r, epsilon))),
    };
  }
  return geometry;
}
