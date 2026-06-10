# Slackwater API Worker

Cloudflare Worker that replaces the Raspberry Pi backend. It's a KV-cached proxy
in front of NOAA CO-OPS, NWS, and USNO, plus a cron warmer that pre-fetches tide
predictions for all Texas stations. **The app only ever talks to this Worker —
never the upstream APIs directly.**

```
NOAA / NWS / USNO
      ▲  (cron every 15m warms predictions; lazy fetch on miss for everything else)
      │
  Cloudflare Worker  ──►  Workers KV (response cache)
      ▲
      │  (edge cache via Cache-Control)
  app / web frontend  ──►  on-device cache (recommended)
```

## Endpoints

Base URL: `https://api.slackwater.app/api`

| Endpoint | Notes | Cache TTL |
|---|---|---|
| `GET /api/noaa/query?station=&product=&...` | Generic NOAA CO-OPS passthrough | predictions 6h · latest 6m · observed 10m |
| `GET /api/nws/points?lat=&lon=` | Raw NWS points | 15m |
| `GET /api/nws/forecast-12h?lat=&lon=` | 12h wind summary | 15m |
| `GET /api/nws/pressure?lat=&lon=` | Barometric pressure + trend | 15m |
| `GET /api/nws/temperature?lat=&lon=` | Air temp from nearest station | 15m |
| `GET /api/usno/sun-moon?lat=&lon=&date=YYYY-MM-DD` | Sun/moon rise-set + phase | 12h |
| `GET /health` | Liveness + station count | — |

## How caching works

- **Lazy cache (all endpoints):** on a request, the Worker builds a normalized
  cache key, checks KV, and serves a hit. On a miss it fetches upstream, stores
  the result with a per-type TTL, and returns it. If upstream fails and a stale
  entry exists, the stale value is served (resilience).
- **Key normalization (`src/cache.js`):** `application`/`format` are stripped,
  and NOAA `begin_date`/`end_date` are snapped down to the hour. This collapses
  all clients within a clock-hour onto one cached entry and lets the warmer hit
  the same keys the app requests.
- **Cron warmer (`scheduled` in `src/index.js`):** every 15 minutes it warms the
  tide curve (`interval=6`) and hi/lo (`interval=hilo`) for the 38 prediction
  stations, but only for entries that are missing or within 25% of expiry. It's
  capped at `WARM_FETCH_BUDGET` upstream fetches per tick so it stays under the
  free-tier subrequest limit; unreached stations are picked up next tick.

## Plan & cost

Works on the **Workers Free** plan as built: predictions are warmed with
write-on-near-expiry (~a few hundred KV writes/day), and live data is lazy
(written only on real demand). If you later want to aggressively warm **live**
data (water level / wind / temp) for all 44 stations every few minutes, the KV
free write cap (1,000/day) is too low — move to **Workers Paid ($5/mo)**, which
raises KV writes to 1M/day and subrequests to 1,000/invocation. Then add live
products to the warmer and raise `WARM_FETCH_BUDGET`.

## Develop & deploy

```bash
cd worker
npx wrangler dev                 # local, http://localhost:8787
npx wrangler dev --test-scheduled  # then: curl 'localhost:8787/__scheduled'
npx wrangler deploy              # publish
npx wrangler tail                # live logs
```

Config lives in `wrangler.toml` (KV namespace binding `CACHE`, cron schedule,
custom domain `api.slackwater.app`, `WARM_FETCH_BUDGET`).

## Layout

```
src/
  index.js      router (fetch) + cron warmer (scheduled)
  cache.js      KV cache, key normalization, TTL policy
  upstream.js   NOAA / NWS / USNO fetch clients
  nws.js        derived NWS endpoints (forecast-12h, pressure, temperature)
  stations.js   44 Texas stations (generated from ../js/data/stations.js)
```
