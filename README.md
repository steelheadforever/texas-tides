# Texas Coastal Tides

A web application that displays real-time tide and weather data for Texas coastal stations on an interactive map.

**Live site:** [slackwater.app](https://slackwater.app)

## Features

- Interactive grayscale map showing ~50 Texas coastal tide stations
- Click any station to view comprehensive data:
  - Current tide status (observed vs predicted water levels)
  - 24-hour tide curve with current position
  - Next high/low tide prediction
  - Water temperature
  - Current wind conditions (speed, gust, direction)
  - 12-hour wind forecast
  - Barometric pressure and trend
  - Sky conditions
  - Moon phase
- **7-Day Forecast** (click "Forecast" button on any station):
  - Vertical day cards with individual 24-hour tide sparklines
  - Daily weather forecast (temperature range, precipitation, conditions)
  - High/low tide times for each day
  - Wind speed and direction forecasts
  - Sunrise/sunset and moonrise/moonset times
  - Moon phase progression
  - Responsive design with horizontal scrolling on mobile

## Data Sources

- **NOAA CO-OPS API**: Tide predictions, water levels, station weather
- **National Weather Service (NWS) API**: Weather forecasts and observations
- **USNO API**: Moon phase data

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- Python 3 (for local HTTP server) or any other HTTP server

### Running the Application

1. Open a terminal and navigate to the project directory:
   ```bash
   cd /path/to/texas-tides
   ```

2. Start a local HTTP server:
   ```bash
   python -m http.server 8000
   ```

3. Open your web browser and navigate to:
   ```
   http://localhost:8000
   ```

4. The map will load showing tide stations along the Texas coast. Click any marker to view station data.

### Alternative: Direct File Opening

For simple testing, you can open `index.html` directly in your browser, but some features may not work due to CORS restrictions. Using a local HTTP server is recommended.

## Deployment

The application is deployed on **Cloudflare Pages** with automatic deployments from GitHub.

### Production Deployment

- **Live site**: [slackwater.app](https://slackwater.app)
- **Hosted on**: Cloudflare Pages
- **Auto-deployment**: Every push to the `main` branch automatically deploys to production
- **SSL/HTTPS**: Automatically provisioned and managed by Cloudflare
- **CDN**: Global content delivery network for fast loading worldwide

### Development Workflow

1. **Create a feature branch**: `git checkout -b claude/your-feature`
2. **Make your changes** and commit
3. **Push to GitHub**: `git push -u origin claude/your-feature`
4. **Preview deployment**: Cloudflare automatically creates a preview URL for your branch
5. **Create a Pull Request** on GitHub
6. **Review the preview**: Test your changes on the auto-generated preview URL
7. **Merge to main**: Once approved, merging deploys to production automatically

### Branch Previews

Every branch pushed to GitHub gets its own preview URL:
- Format: `your-branch-name.texas-tides.pages.dev`
- Perfect for testing changes before merging to production
- Preview URLs are automatically commented on Pull Requests

### Rollback & Build History

- View all deployments in the Cloudflare Pages dashboard
- Instant rollback to any previous deployment if needed
- Build logs available for debugging

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
│   │   ├── noaa.js       # NOAA CO-OPS API functions
│   │   ├── nws.js        # NWS weather API functions
│   │   └── usno.js       # USNO moon phase API
│   ├── data/
│   │   └── stations.js   # Texas station definitions
│   ├── ui/
│   │   ├── popup.js      # Current conditions popup
│   │   ├── forecastPopup.js # 7-day forecast popup
│   │   └── chart.js      # Tide charts and sparklines
│   └── utils/
│       ├── datetime.js   # Date/time utilities
│       ├── conversions.js # Unit conversions
│       └── formatting.js # Formatting and emojis
└── README.md
```

## Technologies Used

- **Leaflet.js**: Interactive map library
- **Chart.js**: Tide curve visualization
- **CartoDB Positron**: Grayscale map tiles
- **Vanilla JavaScript**: No frameworks, pure ES6 modules

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

## Development Notes

- API calls are made on-demand when clicking a station
- Currently serverless - all data fetched client-side from public APIs
- Cloudflare Pages infrastructure provides CDN and global edge network
- Future backend features possible via Cloudflare Workers if needed
- Error handling: Gracefully degrades when data is unavailable
- Responsive design for mobile and desktop

## Known Limitations

- Some stations may not report all data types (wind, water temp, etc.)
- NWS API can occasionally be slow or unavailable
- Background refresh feature not yet implemented

## Future Enhancements

- [ ] Server-side caching via Cloudflare Workers for faster API responses
- [ ] Add station search/filter functionality
- [ ] Save favorite stations (localStorage)
- [ ] Historical tide data view
- [ ] Progressive Web App (PWA) support
- [ ] Push notifications for tide alerts
- [ ] Analytics dashboard using Cloudflare Pages analytics

## License

This project uses public data from NOAA and NWS. Map tiles from CARTO.

## Acknowledgments

- Based on patterns from the Copano Bay fishing conditions Discord bot
- NOAA CO-OPS for tide and weather data
- National Weather Service for weather forecasts
