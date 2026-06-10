# Texas Tides - API Backend Setup

## Overview

Your Texas Tides web app now connects to your Raspberry Pi backend instead of calling external APIs directly. This gives you:

- ✅ **Caching** - Faster responses, reduced API load
- ✅ **Analytics** - Track usage in the admin dashboard
- ✅ **Rate limiting** - Protect against API abuse
- ✅ **Centralized management** - One place to handle all API calls

## What Changed

### API Configuration

All API calls now go through: `http://192.168.1.119:3001/api`

**File:** `js/api/config.js`
```javascript
export const API_BASE_URL = 'http://192.168.1.119:3001/api';
```

### Updated Files

1. **`js/api/noaa.js`** - NOAA tide data proxied through Pi
2. **`js/api/nws.js`** - NWS weather data proxied through Pi
3. **`js/api/usno.js`** - USNO sun/moon data proxied through Pi
4. **`js/api/config.js`** - New config file with API_BASE_URL

## How to Test

### 1. Open Your Web App

Since this is a static site, you can open it directly:

```bash
cd /Users/andrewpope/Claude\ Projects/texas-tides
open index.html
```

Or use a local server (better for testing):

```bash
# Using Python
python3 -m http.server 8000

# Then open: http://localhost:8000
```

### 2. Check Browser Console

Open Developer Tools (Cmd+Option+I) and look for:
- ✅ No CORS errors
- ✅ API calls going to `http://192.168.1.119:3001/api/*`
- ✅ Successful responses with data

### 3. Check Pi Dashboard

Open your admin dashboard: `http://192.168.1.119:8080/admin`

You should see:
- **Data Pipeline tab** - Cache hits increasing
- **User Analytics tab** - Pageviews being tracked
- **Request Logs tab** - All your API requests logged

## Switching to Production

When you're ready to deploy with a public domain:

1. Edit `js/api/config.js`:
   ```javascript
   export const API_BASE_URL = 'https://yourdomain.com/api';
   ```

2. Set up nginx + HTTPS on your Pi (see pi-backend/DEPLOYMENT.md)

3. Update Pi's `.env`:
   ```bash
   USE_HTTPS=true
   ```

## Troubleshooting

### CORS Errors

If you see CORS errors, make sure your Pi backend's CORS is configured:
```javascript
// pi-backend/src/server.js already has:
cors({ origin: '*' })  // Allows all origins
```

### Connection Refused

- Make sure Pi backend is running: `ssh steelheadforever@192.168.1.119 "pm2 status"`
- Check firewall isn't blocking port 3001
- Verify Pi's IP hasn't changed

### Data Not Loading

- Check browser console for errors
- Check Pi dashboard logs: `ssh steelheadforever@192.168.1.119 "pm2 logs slackwater-api"`
- Test direct API call: `curl http://192.168.1.119:3001/health`

## Next Steps

1. Test your web app with the new backend
2. Generate some traffic by using the app
3. Check the dashboard to see analytics
4. Consider setting up a domain + HTTPS for production use
