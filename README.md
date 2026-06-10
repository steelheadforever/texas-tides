# Texas Coastal Tides

A web application that displays real-time tide and weather data for Texas coastal stations on an interactive map, powered by a Raspberry Pi backend with caching, analytics, and an admin dashboard.

## Features

### Frontend Web App
- Interactive grayscale map showing ~45 Texas coastal tide stations
- Click any station to view comprehensive data:
  - Current tide status (observed vs predicted water levels)
  - 24-hour tide curve with current position
  - Next high/low tide prediction
  - Water temperature with historical graph
  - Current wind conditions (speed, gust, direction)
  - 12-hour wind forecast
  - Barometric pressure and trend
  - Sky conditions
  - Sun/Moon rise/set times and moon phase
- Dark mode toggle
- Mobile-responsive design

### Backend Infrastructure (Raspberry Pi)
- **API Server** (port 3001): Serves web app and proxies API requests
- **Admin Dashboard** (port 8080): Monitor system health and analytics
- **Intelligent Caching**: Reduces API load, faster response times
- **Analytics Tracking**: Privacy-focused usage metrics
- **Background Jobs**: Automated cache cleanup and data retention
- **PM2 Process Management**: Auto-restart, logging, monitoring

### Admin Dashboard Features
- **System Health**: CPU, memory, disk usage, temperature, uptime
- **Data Pipeline**: Cache statistics, station health, fetch logs
- **User Analytics**: Traffic trends, device breakdown, popular stations
- **Request Logs**: Searchable request history with pagination
- Session-based authentication with rate limiting

## Architecture

```
┌─────────────────┐
│   Web Browser   │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────────────────────────┐
│   Raspberry Pi (Your Local Network) │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  API Server (:3001)          │  │
│  │  - Serves web app            │  │
│  │  - Proxies NOAA/NWS/USNO     │  │
│  │  - Caching + Analytics       │  │
│  │  - Background jobs           │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  Dashboard Server (:8080)    │  │
│  │  - Admin interface           │  │
│  │  - System monitoring         │  │
│  │  - Analytics dashboard       │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  SQLite Databases            │  │
│  │  - operational.db (cache)    │  │
│  │  - analytics.db (metrics)    │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  External APIs  │
│  - NOAA CO-OPS  │
│  - NWS          │
│  - USNO         │
└─────────────────┘
```

## Data Sources

- **NOAA CO-OPS API**: Tide predictions, water levels, station weather
- **National Weather Service (NWS) API**: Weather forecasts and observations
- **USNO API**: Sun/moon rise/set times and moon phase data

All external API calls are proxied through your Raspberry Pi backend for caching and analytics.

## Getting Started

### Quick Start (Local Development)

The web app is configured to use your Raspberry Pi backend at `http://192.168.1.119:3001`.

Simply open in your browser:
```
http://192.168.1.119:3001
```

The Pi backend serves the static web app and handles all API requests.

### Raspberry Pi Setup

**See [pi-backend/DEPLOYMENT.md](pi-backend/DEPLOYMENT.md) for full deployment instructions.**

Quick setup on your Pi:

```bash
# Clone the repository
git clone https://github.com/yourusername/texas-tides.git
cd texas-tides/pi-backend

# Run setup script
chmod +x scripts/setup.sh
./scripts/setup.sh

# Configure environment
cp .env.example .env
nano .env  # Set SESSION_SECRET and other configs

# Start servers
pm2 start ecosystem.config.cjs
pm2 save
```

Access points:
- **Web App**: `http://YOUR_PI_IP:3001`
- **Admin Dashboard**: `http://YOUR_PI_IP:8080/admin`
- **API Health**: `http://YOUR_PI_IP:3001/health`

Default admin credentials:
- Username: `admin`
- Password: `slackwater123` (change this immediately!)

## Project Structure

```
texas-tides/
├── index.html              # Main HTML page
├── css/
│   └── styles.css         # Grayscale theme and styles
├── js/
│   ├── main.js            # Application initialization
│   ├── map.js             # Leaflet map and markers
│   ├── api/
│   │   ├── config.js      # API base URL configuration
│   │   ├── noaa.js        # NOAA API (proxied through Pi)
│   │   ├── nws.js         # NWS API (proxied through Pi)
│   │   └── usno.js        # USNO API (proxied through Pi)
│   ├── data/
│   │   └── stations.js    # Texas station definitions
│   ├── ui/
│   │   ├── popup.js       # Popup content generation
│   │   └── chart.js       # Chart rendering (tide, temp)
│   └── utils/
│       ├── datetime.js    # Date/time utilities
│       ├── conversions.js # Unit conversions
│       ├── formatting.js  # Formatting and emojis
│       ├── dark-mode.js   # Dark mode toggle
│       └── menu.js        # Mobile menu
├── pi-backend/            # Raspberry Pi backend server
│   ├── src/
│   │   ├── server.js      # Main API server
│   │   ├── routes/        # API endpoints (NOAA, NWS, USNO)
│   │   ├── services/      # Business logic
│   │   ├── middleware/    # Cache, analytics, auth
│   │   ├── jobs/          # Background job scheduler
│   │   ├── dashboard/     # Admin dashboard
│   │   └── config/        # Database configuration
│   ├── scripts/           # Deployment scripts
│   ├── ecosystem.config.cjs  # PM2 configuration
│   ├── deploy-to-pi.sh    # Quick deploy script
│   └── DEPLOYMENT.md      # Full deployment guide
├── deploy-web-app.sh      # Deploy web app to Pi
└── API_SETUP.md           # API integration guide
```

## Technologies Used

### Frontend
- **Leaflet.js**: Interactive map library
- **Chart.js**: Tide curve and temperature graph visualization
- **CartoDB Positron/Dark Matter**: Grayscale map tiles
- **Vanilla JavaScript**: ES6 modules, no frameworks

### Backend
- **Node.js + Express**: API server and web serving
- **sql.js**: Pure JavaScript SQLite (WASM-based)
- **Helmet**: Security headers and CSP
- **express-rate-limit**: Rate limiting protection
- **bcrypt**: Password hashing for admin auth
- **PM2**: Process management and monitoring

## Current Stations

The application includes **45 verified NOAA CO-OPS tide stations** along the Texas coast, covering:

- Sabine Pass Region (Northeast Texas Coast)
- Galveston Bay & Houston Ship Channel Region
- Freeport Region
- Matagorda Bay Region
- Aransas & Rockport Region
- Corpus Christi & Port Aransas Region
- Laguna Madre & Port Mansfield Region
- South Padre Island & Port Isabel Region (South Texas Coast)

*All station data verified against NOAA database as of 2026-01-03*

## Deployment

### Development (Local Network)
1. Deploy backend to Raspberry Pi (see pi-backend/DEPLOYMENT.md)
2. Access web app at `http://YOUR_PI_IP:3001`
3. Monitor via dashboard at `http://YOUR_PI_IP:8080/admin`

### Production (Public Access)
1. Set up domain with your Pi's public IP
2. Configure nginx with Let's Encrypt for HTTPS
3. Update `.env`: `USE_HTTPS=true`
4. Update `js/api/config.js`: `API_BASE_URL = 'https://yourdomain.com/api'`
5. Deploy web app to GitHub Pages or serve from Pi

See [API_SETUP.md](API_SETUP.md) for switching to production.

## Admin Dashboard

Access the admin dashboard at `http://YOUR_PI_IP:8080/admin`

Features:
- **System Health**: Real-time CPU, memory, disk, temperature monitoring
- **Data Pipeline**: Cache hit rates, station health, API fetch logs
- **User Analytics**: Traffic trends, device breakdown, popular stations
- **Request Logs**: Searchable history with pagination

Default credentials (change immediately!):
- Username: `admin`
- Password: `slackwater123`

Generate new password hash:
```bash
node -e "import('bcrypt').then(bcrypt => bcrypt.default.hash('YOUR_PASSWORD', 10).then(console.log))"
```

## Configuration

### Backend Environment Variables

Edit `pi-backend/.env`:

```bash
# Server Configuration
PORT=3001
NODE_ENV=production
CORS_ORIGIN=*

# Admin Dashboard
DASHBOARD_PORT=8080
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=your_bcrypt_hash_here
SESSION_SECRET=your_64_char_random_hex_string_here

# Database Configuration
DB_OPERATIONAL=./data/operational.db
DB_ANALYTICS=./data/analytics.db
CACHE_TTL_SECONDS=360
DATA_RETENTION_DAYS=30

# HTTPS (for production)
USE_HTTPS=false  # Set to true when behind nginx with SSL
```

### Web App Configuration

Edit `js/api/config.js`:

```javascript
// Local development - use your Pi's local IP
export const API_BASE_URL = 'http://192.168.1.119:3001/api';

// Production - use your public domain
// export const API_BASE_URL = 'https://yourdomain.com/api';
```

## Monitoring & Maintenance

### PM2 Commands

```bash
# Check status
pm2 status

# View logs
pm2 logs slackwater-api
pm2 logs slackwater-dashboard

# Restart services
pm2 restart all
pm2 restart slackwater-api

# Stop services
pm2 stop all

# Monitor in real-time
pm2 monit
```

### Background Jobs

Automated tasks running on the Pi:

- **Cache Cleanup** (hourly): Removes expired cache entries
- **Analytics Aggregation** (hourly): Processes analytics data
- **Data Cleanup** (daily at 2 AM): Enforces 30-day data retention

### Database Management

Databases are in-memory (sql.js) with periodic saves to disk:
- Auto-save every 5 minutes
- Save on SIGTERM/SIGINT (graceful shutdown)

Manual backup:
```bash
cp ~/slackwater-backend/data/operational.db ~/backups/
cp ~/slackwater-backend/data/analytics.db ~/backups/
```

## Performance

With Raspberry Pi backend:
- **Cache hit rate**: ~80-90% after warming up
- **Response time**: <100ms for cached requests
- **API load**: Reduced by 80% vs direct calls
- **Concurrent users**: Handles 10-20 easily on Pi 3/4

## Security

- Session-based authentication with bcrypt password hashing
- Rate limiting: 100 requests per 15 minutes per IP
- Content Security Policy (CSP) configured
- HTTPS ready (requires nginx + Let's Encrypt)
- Automatic security headers via Helmet
- Login rate limiting: 5 attempts per 15 minutes

## Known Limitations

- Some stations may not report all data types (wind, water temp, etc.)
- NWS API can occasionally be slow or unavailable
- Pi backend currently HTTP only (HTTPS requires nginx setup)
- Dashboard requires manual password reset via bcrypt

## Future Enhancements

- [x] Server-side caching for API requests ✅
- [x] Admin dashboard for monitoring ✅
- [x] Analytics tracking ✅
- [ ] Station search/filter functionality
- [ ] Save favorite stations (localStorage)
- [ ] Historical tide data view
- [ ] Progressive Web App (PWA) support
- [ ] Push notifications for tide alerts
- [ ] Multi-user dashboard authentication
- [ ] Automated SSL certificate renewal

## Troubleshooting

**Web app shows "Not found":**
- Check Pi is running: `pm2 status`
- Verify web files deployed: `ls ~/slackwater-backend/web/`
- Check logs: `pm2 logs slackwater-api`

**Dashboard shows no data:**
- Ensure both servers are running on same Pi
- Check working directory in PM2: `pm2 info slackwater-api`
- Verify databases exist: `ls ~/slackwater-backend/data/`

**Map not loading:**
- Check browser console for CSP errors
- Hard refresh browser (Cmd+Shift+R)
- Verify Leaflet CDN accessible

**API requests failing:**
- Check cache stats in dashboard
- Test direct API: `curl http://YOUR_PI_IP:3001/health`
- Check NOAA/NWS API status

See [pi-backend/DEPLOYMENT.md](pi-backend/DEPLOYMENT.md) for more troubleshooting.

## License

This project uses public data from NOAA and NWS. Map tiles from CARTO.

## Acknowledgments

- Based on patterns from the Copano Bay fishing conditions Discord bot
- NOAA CO-OPS for tide and weather data
- National Weather Service for weather forecasts and observations
- US Naval Observatory for astronomical data
- The Raspberry Pi Foundation for affordable computing

## Contributing

This is a personal project, but suggestions and bug reports are welcome via GitHub issues.

---

**Live Demo**: Visit your deployment at `http://YOUR_PI_IP:3001`
**Admin Dashboard**: `http://YOUR_PI_IP:8080/admin`
