// Slackwater Dispatch — Astro config.
//
// The journal is a sub-site of slackwater.app: it builds into ../dist/dispatch
// so the root build script (scripts/build-site.mjs) can lay it beside the
// static map app. `base` makes every generated link and asset URL start with
// /dispatch.
import { defineConfig } from 'astro/config';
import remarkDispatch from './src/plugins/remark-dispatch.mjs';

export default defineConfig({
  site: 'https://slackwater.app',
  base: '/dispatch',
  outDir: '../dist/dispatch',
  trailingSlash: 'always',
  build: { format: 'directory' },
  markdown: {
    remarkPlugins: [remarkDispatch],
  },
});
