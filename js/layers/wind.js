// Animated wind streamlines over the Leaflet map — particle advection with
// fading trails. Ported from the iOS WindParticleOverlayView (which itself
// came from VMG's web canvas). Wind field is swappable for the scrubber.

import { windColor } from './weather.js';

const PARTICLE_COUNT = 700;
const FADE = 0.10;       // trail fade per frame
const POINTS_PER_MS = 0.09; // screen px per (m/s) per frame

export class WindLayer {
  constructor(map) {
    this.map = map;
    this.grid = null;
    this.particles = [];
    this.raf = null;
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:450;';
    this.ctx = this.canvas.getContext('2d');
    this._onResize = () => this.resize();
    this._onMoveStart = () => this.clear();
    this._onMove = () => {}; // projection is recomputed per frame
  }

  setGrid(grid) { this.grid = grid; }

  start() {
    if (this.raf) return;
    this.map.getContainer().appendChild(this.canvas);
    this.resize();
    this.map.on('resize', this._onResize);
    this.map.on('movestart zoomstart', this._onMoveStart);
    this.spawnAll();
    const loop = () => { this.step(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.map.off('resize', this._onResize);
    this.map.off('movestart zoomstart', this._onMoveStart);
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.particles = [];
  }

  resize() {
    const size = this.map.getSize();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = size.x * dpr;
    this.canvas.height = size.y * dpr;
    this.canvas.style.width = size.x + 'px';
    this.canvas.style.height = size.y + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.clear();
  }

  clear() {
    const s = this.map.getSize();
    this.ctx.clearRect(0, 0, s.x, s.y);
  }

  bounds() {
    const b = this.map.getBounds();
    return { minLon: b.getWest(), maxLon: b.getEast(), minLat: b.getSouth(), maxLat: b.getNorth() };
  }

  spawn() {
    const b = this.bounds();
    return {
      lon: b.minLon + Math.random() * (b.maxLon - b.minLon),
      lat: b.minLat + Math.random() * (b.maxLat - b.minLat),
      age: 0, maxAge: 50 + Math.random() * 50,
    };
  }

  spawnAll() {
    this.particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) this.particles.push(this.spawn());
  }

  step() {
    if (!this.grid) return;
    const ctx = this.ctx;
    const size = this.map.getSize();
    if (!this.particles.length) this.spawnAll();

    // Fade existing trails.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${FADE})`;
    ctx.fillRect(0, 0, size.x, size.y);
    ctx.globalCompositeOperation = 'source-over';

    const b = this.bounds();
    const degPerPx = (b.maxLon - b.minLon) / size.x;
    const advect = degPerPx * POINTS_PER_MS;
    ctx.lineCap = 'round';

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const w = this.grid.sample(p.lon, p.lat);
      if (!w) { this.particles[i] = this.spawn(); continue; }
      const speed = Math.hypot(w.u, w.v);

      const pt0 = this.map.latLngToContainerPoint([p.lat, p.lon]);
      p.lon += w.u * advect;
      p.lat += w.v * advect;
      p.age += 1;

      const escaped = p.lon < b.minLon || p.lon > b.maxLon || p.lat < b.minLat || p.lat > b.maxLat;
      if (p.age > p.maxAge || escaped) { this.particles[i] = this.spawn(); continue; }

      const pt1 = this.map.latLngToContainerPoint([p.lat, p.lon]);
      const alpha = 0.9 * (1 - (p.age / p.maxAge) * 0.5);
      ctx.strokeStyle = windColor(speed).replace('ALPHA', alpha.toFixed(2));
      ctx.lineWidth = speed > 15 ? 2 : 1.3;
      ctx.beginPath();
      ctx.moveTo(pt0.x, pt0.y);
      ctx.lineTo(pt1.x, pt1.y);
      ctx.stroke();
    }
  }
}
