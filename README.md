# Slackwater — US Coastal Tides

A web application that displays real-time tide and weather data for US coastal stations on an interactive map. The frontend is a static site on Cloudflare Pages; all external data is served through a Cloudflare Worker that caches NOAA/NWS/USNO responses.

**Live site:** [slackwater.app](https://slackwater.app) · **API:** [api.slackwater.app](https://api.slackwater.app/health)

## Features

### Interactive Map & Station Data
- Grayscale map with the full NOAA CO-OPS network (~3,500 stations, clustered), station search, and GPS "near me"
- Click any station to view comprehensive current conditions:
  - Current tide status (observed vs predicted water levels)
  - 24-hour tide curve with current position
  - Next high/low tide prediction
  - Water temperature with historical graph
  - Current wind conditions (speed, gust, direction)
  - 12-hour wind forecast
  - Barometric pressure and trend
  - Sky conditions
  - Sun/Moon rise/set times and moon phase

### 7-Day Forecast
Click "Forecast" on any station for:
- Vertical day cards with individual 24-hour tide sparklines
- Daily weather forecast (temperature range, precipitation, conditions)
- High/low tide times for each day
- Wind speed and direction forecasts
- Sunrise/sunset and moonrise/moonset times
- Moon phase progression
- Responsive design with horizontal scrolling on mobile

### General
- Dark mode toggle
- Mobile-responsive design
- Graceful degradation when a data source is unavailable

## Architecture

```
┌─────────────────┐
│   Web Browser   │
└────────┬────────┘
         │
         ▼
┌──────────────────────────┐        ┌──────────────────────────────┐
│  Cloudflare Pages        │        │  Cloudflare Worker           │
│  slackwater.app          │  API   │  api.slackwater.app          │
│  (static frontend)       │ ─────► │  - KV-cached proxy           │
└──────────────────────────┘        │  - Cron warms tide preds     │
                                     │  - NOAA / NWS / USNO          │
                                     └───────────────┬──────────────┘
                                                     │ (cache miss)
                                                     ▼
                                     ┌──────────────────────────────┐
                                     │  External APIs               │
                                     │  - NOAA CO-OPS               │
                                     │  - NWS                       │
                                     │  - USNO                      │
                                     └──────────────────────────────┘
```

The browser never calls the external APIs directly — every request goes through the Worker, which serves cached data from Workers KV and only reaches upstream on a miss. See [`worker/README.md`](worker/README.md) for the backend details.

## Data Sources

- **NOAA CO-OPS API**: Tide predictions, water levels, station weather
- **National Weather Service (NWS) API**: Weather forecasts and observations
- **USNO API**: Sun/moon rise/set times and moon phase data

## Project Structure

```
texas-tides/
├── index.html              # Main HTML page
├── css/
│   └── styles.css          # Grayscale theme and styles
├── js/
│   ├── main.js             # Application initialization
│   ├── map.js              # Leaflet map and markers
│   ├── api/
│   │   ├── config.js       # API base URL (api.slackwater.app)
│   │   ├── noaa.js         # NOAA API (proxied through the Worker)
│   │   ├── nws.js          # NWS API (proxied through the Worker)
│   │   └── usno.js         # USNO API (proxied through the Worker)
│   ├── data/
│   │   └── stations.js     # Texas station definitions
│   ├── ui/
│   │   ├── popup.js         # Current conditions popup
│   │   ├── forecastPopup.js # 7-day forecast popup
│   │   └── chart.js         # Tide charts and sparklines
│   └── utils/              # Date/time, conversions, formatting, dark mode, menu
├── worker/                 # Cloudflare Worker backend (KV cache + cron warmer)
│   ├── src/                # index, cache, upstream, nws, stations
│   └── wrangler.toml
└── pi-backend/             # Retired Raspberry Pi backend (kept for reference)
```

## Technologies Used

### Frontend
- **Leaflet.js**: Interactive map library
- **Chart.js**: Tide curve and temperature graph visualization
- **CartoDB Positron/Dark Matter**: Grayscale map tiles
- **Vanilla JavaScript**: ES6 modules, no frameworks

### Backend
- **Cloudflare Workers**: Edge compute serving the API
- **Workers KV**: Response cache
- **Cron Triggers**: Scheduled warming of tide predictions

## Current Stations

The station catalog covers the **entire NOAA CO-OPS network** — ~3,450 tide-prediction
stations (1,212 harmonic with full curves, 2,238 subordinate with high/low times only)
plus ~300 real-time water-level gauges, every US coastal state and territory, each with
its own IANA timezone. It's generated from NOAA's metadata API:

```bash
npm run generate:stations   # rebuilds worker/src/catalog.json from NOAA MDAPI
```

Clients fetch it from `GET /api/stations` (ETag-cached); the bundled 44-station Texas
list remains as the offline fallback.

## Deployment

### Frontend (Cloudflare Pages)
- **Live site**: [slackwater.app](https://slackwater.app)
- Auto-deploys on every push to `main`
- SSL/HTTPS and global CDN managed by Cloudflare
- Every branch gets a preview URL, commented on its Pull Request

### Backend (Cloudflare Worker)
```bash
cd worker
npx wrangler dev      # local at http://localhost:8787
npx wrangler deploy   # publish to api.slackwater.app
npx wrangler tail     # live logs
```
Config (KV binding, cron schedule, custom domain) lives in `worker/wrangler.toml`. Full details in [`worker/README.md`](worker/README.md).

### Development Workflow
1. Create a feature branch: `git checkout -b claude/your-feature`
2. Make changes and commit
3. Push to GitHub; Cloudflare creates a preview URL
4. Open a Pull Request and review the preview
5. Merge to `main` to deploy to production

## Caching

- **Lazy cache:** any request the Worker hasn't seen is fetched upstream, stored in KV with a per-type TTL (predictions ~24h, live data ~6–10m, weather ~15m, sun/moon ~12h), and served from cache thereafter.
- **Cron warmer:** every 15 minutes the Worker pre-fetches tide predictions + hi/lo for the 38 prediction stations, so the most-requested data is always warm.
- **Serve-stale-on-error:** if an upstream API fails, the last good cached value is returned.

Runs on the Cloudflare Workers Free plan as configured; aggressively warming live data for all stations would want Workers Paid ($5/mo). See `worker/README.md`.

## Known Limitations

- Some stations don't report all data types (wind, water temp, etc.)
- The NWS API can occasionally be slow or unavailable
- The cron warmer covers the Texas warm list; other stations are cached lazily on first request

## Future Enhancements

- [x] Server-side caching for API requests ✅ (Cloudflare Worker + KV)
- [x] Native iOS app ✅ (private repo, in App Store review)
- [x] Station search/filter functionality ✅
- [x] Save favorite stations (localStorage) ✅
- [ ] Historical tide data view
- [ ] Progressive Web App (PWA) support
- [ ] Push notifications for tide alerts

## License

This project uses public data from NOAA and NWS. Map tiles from CARTO.

## Acknowledgments

- Based on patterns from the Copano Bay fishing conditions Discord bot
- NOAA CO-OPS for tide and weather data
- National Weather Service for weather forecasts and observations
- US Naval Observatory for astronomical data

## Contributing

This is a personal project, but suggestions and bug reports are welcome via GitHub issues.
