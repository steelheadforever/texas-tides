# How slackwater.app gets built and deployed

Written 2026-08-27 after the Dispatch launch, when we discovered the site had
been quietly served by GitHub Pages the whole time. This is the current truth;
if you change any of it, update this file.

## Hosting

| What | Where | Notes |
|---|---|---|
| `slackwater.app` (map app + Dispatch) | **Cloudflare Pages**, project `texas-tides` | Custom domain active since 2026-08-27. DNS: `slackwater.app` CNAME → `texas-tides.pages.dev`, proxied. |
| `api.slackwater.app` | Cloudflare Worker `slackwater-api` (`worker/`) | Deployed separately with `npx wrangler deploy` from `worker/`. |
| GitHub Pages | **Legacy — do not use** | Still enabled on the repo (API refused to disable it); it builds on every push but nothing points at it. Unpublish it in repo Settings → Pages when convenient. Do not re-add a `CNAME` file. |

Cloudflare account `d7000bc7…`, zone `slackwater.app` (id `b0016b34…`). The
wrangler OAuth login can manage the Pages project and Worker but **cannot read
or edit DNS records** — DNS changes are dashboard-only (or a scoped API token).

## Pages build (every push to `main`)

Cloudflare Pages runs, from the repo root:

```
npm ci            # implicit — Pages installs root deps first
npm run build     # → node scripts/build-site.mjs
```

`scripts/build-site.mjs` assembles `dist/`:

1. copies the static map app as-is: `index.html`, `css/`, `js/`, `images/`, `_headers`
2. runs `npm ci && npm run build` inside `dispatch/` (Astro) → `dist/dispatch/`

Output directory is `dist` (gitignored). Node version comes from `.node-version`
(22). Preview deployments build for every branch; production is `main`.

**A failing build leaves the previous deploy live** — the site goes stale, not
down. Check the deployments list in the Pages project (or via API
`/accounts/<acct>/pages/projects/texas-tides/deployments`) if a push doesn't
show up on the site.

### Working on the map app

Nothing changed for you: edit `index.html` / `css/` / `js/` at the root exactly
as before. The build step only copies them. You can still open `index.html`
from a local static server with no build. Two things to know:

- `_headers` now also has `/dispatch/*` rules — leave them.
- The header (`css/styles.css`, "Header" section) paints the camo at full
  opacity with a top-to-bottom scrim; the nav is Map · Dispatch · Get the app.
  `js/main.js` honors `/?station=<noaa id>` to open a station on load
  (Dispatch links into the map with it).

To build the full site locally, matching Pages: `npm run build` at the root,
then serve `dist/` (e.g. `python3 -m http.server -d dist 8766`).

## Dispatch (`dispatch/`)

Astro 5 sub-site, `base: '/dispatch'`, `outDir: '../dist/dispatch'`.

- Issues live in `dispatch/src/content/issues/YYYY-MM-DD.md` (filename = URL slug).
- Frontmatter: `number`, `date`, `title`, `summary`, `stations: [{id, name}]`
  (feeds the live tide ticker), `draft`.
- Body: intro paragraphs, then `## category · Headline` sections where category ∈
  catch / report / conditions / bite / tactics / gear / conservation / news / events.
  Shortcodes on their own line: `{youtube: ID}`, `{station: 8771450 Galveston Pier 21}`,
  `{partner: Name}`. The first section is the full-bleed lead; a photo as its
  first line becomes the background. See `src/plugins/remark-dispatch.mjs`.
- Photos go in `dispatch/public/img/`, referenced as `/dispatch/img/name.jpg`.
- Dev server: `npm run dev:dispatch` from the root (serves at `/dispatch/`).
- Browser authoring: Pages CMS (app.pagescms.org) using `.pages.yml` at the root.
  Saves are commits to `main`, so they deploy.
- Theme follows the map app's `localStorage['slackwater.settings'].appearance`.

## Worker (`worker/`)

Unchanged: `cd worker && npm test && npx wrangler deploy`. The ticker on Dispatch
uses `/api/noaa/query` with `product=predictions&interval=hilo`. A
`POST /dispatch/subscribe` route (email capture to KV) is planned but not built;
the subscribe form on the site degrades to a "not live yet" message meanwhile.
