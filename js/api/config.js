// API Configuration
// Backend is the Slackwater Cloudflare Worker (worker/), a KV-cached proxy in
// front of NOAA/NWS/USNO with a cron warmer for tide predictions.

// Production - Cloudflare Worker on the custom domain.
export const API_BASE_URL = 'https://api.slackwater.app/api';

// Local development against the Worker:
//   cd worker && npx wrangler dev   ->  http://localhost:8787
// export const API_BASE_URL = 'http://localhost:8787/api';

// Legacy Raspberry Pi backend (retired):
// export const API_BASE_URL = 'http://192.168.1.119:3001/api';

export const REQUEST_TIMEOUT = 10000; // 10 seconds
