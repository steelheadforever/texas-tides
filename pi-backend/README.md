# Slackwater Backend

Backend server for the Slackwater tide tracking app (texas-tides). This Node.js/Express server runs on a Raspberry Pi and acts as a proxy for NOAA, NWS, and USNO APIs.

## Features

- **NOAA CO-OPS API Proxy** - Tide predictions, water levels, temperatures, wind data
- **NWS API Proxy** - Weather forecasts, barometric pressure, air temperature
- **USNO API Proxy** - Sun/moon rise/set times, moon phase
- Rate limiting to prevent API abuse
- CORS support for frontend connectivity
- PM2 process management for production deployment
- Comprehensive error handling and logging

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- PM2 (for production deployment)

## Installation

### Local Development

1. Clone the repository or copy the pi-backend directory
2. Install dependencies:
   ```bash
   cd pi-backend
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3001` (or the PORT specified in .env)

### Raspberry Pi Deployment

1. SSH into your Raspberry Pi:
   ```bash
   ssh pi@your-pi-hostname
   ```

2. Install Node.js (if not already installed):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. Install PM2 globally:
   ```bash
   sudo npm install -g pm2
   ```

4. Transfer files to Raspberry Pi:
   ```bash
   # From your local machine
   rsync -avz --exclude 'node_modules' --exclude '.git' \
     pi-backend/ pi@your-pi-hostname:~/slackwater-backend/
   ```

5. On the Raspberry Pi, install dependencies:
   ```bash
   cd ~/slackwater-backend
   npm install --production
   ```

6. Configure environment variables:
   ```bash
   cp .env.example .env
   nano .env
   ```

   Update these settings:
   - `NODE_ENV=production`
   - `CORS_ORIGIN=http://slackwater.app` (or your frontend URL)

7. Create logs directory:
   ```bash
   mkdir -p logs
   ```

8. Start with PM2:
   ```bash
   npm run pm2:start
   ```

9. Save PM2 process list and configure auto-start:
   ```bash
   pm2 save
   pm2 startup
   # Follow the instructions printed by the command above
   ```

## PM2 Management Commands

```bash
# Start the server
npm run pm2:start

# Stop the server
npm run pm2:stop

# Restart the server
npm run pm2:restart

# View logs
npm run pm2:logs

# Delete from PM2
npm run pm2:delete

# View PM2 status
pm2 status

# Monitor with PM2
pm2 monit
```

## API Endpoints

### Health Check
- `GET /health` - Server health status

### NOAA Endpoints
- `GET /api/noaa/query` - Generic NOAA API proxy (pass query params)
- `GET /api/noaa/water-level/:stationId` - Latest water level
- `GET /api/noaa/water-temp/:stationId` - Latest water temperature
- `GET /api/noaa/air-temp/:stationId` - Latest air temperature
- `GET /api/noaa/predictions/:stationId` - Tide predictions (requires begin_date, end_date)
- `GET /api/noaa/water-levels/:stationId` - Observed water levels (requires begin_date, end_date)
- `GET /api/noaa/hilo/:stationId` - High/low tide events (requires begin_date, end_date)
- `GET /api/noaa/water-temp-history/:stationId` - Water temp history (requires begin_date, end_date)
- `GET /api/noaa/wind/:stationId` - Wind data

### NWS Endpoints
- `GET /api/nws/points?lat=...&lon=...` - NWS points data
- `GET /api/nws/forecast-12h?lat=...&lon=...` - 12-hour wind forecast
- `GET /api/nws/pressure?lat=...&lon=...` - Barometric pressure and trend
- `GET /api/nws/temperature?lat=...&lon=...` - Air temperature from NWS

### USNO Endpoints
- `GET /api/usno/sun-moon?lat=...&lon=...&date=YYYY-MM-DD` - Sun/moon rise/set times and moon phase

## Example Requests

### Get water level for a station
```bash
curl http://localhost:3001/api/noaa/water-level/8771450
```

### Get 24-hour tide predictions
```bash
curl "http://localhost:3001/api/noaa/predictions/8771450?begin_date=20260106&end_date=20260107&interval=6"
```

### Get 12-hour wind forecast
```bash
curl "http://localhost:3001/api/nws/forecast-12h?lat=27.8364&lon=-97.0511"
```

### Get sun/moon data
```bash
curl "http://localhost:3001/api/usno/sun-moon?lat=27.8364&lon=-97.0511"
```

## Configuration

### Environment Variables

- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)
- `CORS_ORIGIN` - Allowed origin for CORS (* for all, or specific URL)
- `NOAA_BASE_URL` - NOAA API base URL
- `NWS_BASE_URL` - NWS API base URL
- `USNO_BASE_URL` - USNO API base URL
- `REQUEST_TIMEOUT` - API request timeout in milliseconds
- `NOAA_APP_ID` - Application identifier for NOAA API

### Rate Limiting

The server implements rate limiting:
- 100 requests per 15 minutes per IP address
- Applied to all `/api/*` endpoints

## Project Structure

```
pi-backend/
├── src/
│   ├── server.js           # Main Express server
│   ├── routes/
│   │   ├── noaa.js         # NOAA API routes
│   │   ├── nws.js          # NWS API routes
│   │   └── usno.js         # USNO API routes
│   └── services/
│       ├── noaa.js         # NOAA API service functions
│       ├── nws.js          # NWS API service functions
│       └── usno.js         # USNO API service functions
├── logs/                   # PM2 logs directory
├── ecosystem.config.cjs    # PM2 configuration
├── package.json
├── .env                    # Environment variables
├── .env.example            # Example environment file
├── .gitignore
└── README.md
```

## Updating the Server

To update the server on your Raspberry Pi:

```bash
# On local machine - transfer updated files
rsync -avz --exclude 'node_modules' --exclude '.git' \
  pi-backend/ pi@your-pi-hostname:~/slackwater-backend/

# SSH into Pi
ssh pi@your-pi-hostname

# Navigate to project
cd ~/slackwater-backend

# Install any new dependencies
npm install --production

# Restart PM2
npm run pm2:restart
```

## Troubleshooting

### Check if server is running
```bash
pm2 status
```

### View logs
```bash
pm2 logs slackwater-backend
# Or
tail -f logs/combined.log
```

### Test endpoints locally on Pi
```bash
curl http://localhost:3001/health
```

### Check if port is in use
```bash
sudo lsof -i :3001
```

### Restart PM2 if issues occur
```bash
pm2 restart slackwater-backend
```

## Frontend Integration

Update your frontend API calls to point to your Raspberry Pi backend:

```javascript
// Instead of:
const response = await fetch('https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?...');

// Use:
const response = await fetch('http://your-pi-ip:3001/api/noaa/query?...');
```

Or for specific endpoints:
```javascript
// Water level
const response = await fetch(`http://your-pi-ip:3001/api/noaa/water-level/${stationId}`);

// Tide predictions
const response = await fetch(`http://your-pi-ip:3001/api/noaa/predictions/${stationId}?begin_date=${begin}&end_date=${end}`);
```

## Security Considerations

1. **Firewall**: Configure your Pi's firewall to only allow connections from trusted IPs
2. **CORS**: Set `CORS_ORIGIN` to your frontend domain in production
3. **Rate Limiting**: Adjust rate limits in `src/server.js` if needed
4. **HTTPS**: Consider setting up a reverse proxy (nginx) with SSL certificates

## License

MIT
