#!/usr/bin/env node
// Assemble the deployable site in dist/:
//   1. copy the static map app (index.html, css/, js/, images/, _headers…)
//   2. build the Dispatch journal (Astro) into dist/dispatch
//
// Cloudflare Pages runs `npm run build` and publishes `dist`.
import { cp, mkdir, rm } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');

const STATIC = ['index.html', 'css', 'js', 'images', '_headers', 'CNAME', 'favicon.ico'];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const entry of STATIC) {
  try {
    await cp(resolve(root, entry), resolve(dist, entry), { recursive: true });
  } catch (err) {
    if (err.code !== 'ENOENT') throw err; // optional files (CNAME, favicon) may be absent
  }
}

const run = (cmd) => execSync(cmd, { cwd: resolve(root, 'dispatch'), stdio: 'inherit' });
run('npm ci --no-audit --no-fund');
run('npm run build');

console.log('\nSite assembled in dist/ (map app at /, Dispatch at /dispatch/)');
