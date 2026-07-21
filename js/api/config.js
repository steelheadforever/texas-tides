// API Configuration
// Backend is the Slackwater Cloudflare Worker (worker/), a KV-cached proxy in
// front of NOAA/NWS/USNO with a cron warmer for tide predictions.

// ?api=<name> on the page URL selects a backend for that tab only — e.g.
// slackwater.app/?api=staging tests the staging worker without touching
// production visitors. Named presets only: accepting arbitrary URLs would let
// a crafted link point the app at a hostile backend.
const BACKENDS = {
  // Cloudflare Worker on the custom domain.
  production: 'https://api.slackwater.app/api',
  // Staging worker: cd worker && npx wrangler deploy --env staging
  // (no custom domain, no cron, no KV — uncached, always hits upstream).
  staging: 'https://slackwater-api-staging.steelheadforever.workers.dev/api',
  // Local development: cd worker && npx wrangler dev  ->  http://localhost:8787
  local: 'http://localhost:8787/api',
};

const requested = new URLSearchParams(window.location.search).get('api');
export const API_BASE_URL = BACKENDS[requested] || BACKENDS.production;

if (API_BASE_URL !== BACKENDS.production) {
  console.log(`[config] API override active: ${requested} -> ${API_BASE_URL}`);
}

export const REQUEST_TIMEOUT = 10000; // 10 seconds
