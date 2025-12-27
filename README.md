# Texas Coastal Tides

A web application that displays real-time tide and weather data for Texas coastal stations on an interactive map.

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

## Data Sources

- **NOAA CO-OPS API**: Tide predictions, water levels, station weather
- **National Weather Service (NWS) API**: Weather forecasts and observations
- **Client-side calculation**: Moon phase

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- Python 3 (for local HTTP server) or any other HTTP server

### Running the Application

1. Open a terminal and navigate to the project directory:
   ```bash
   cd "/Users/andrewpope/Claude Projects/texas-tides"
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
│   │   └── moon.js       # Moon phase calculation
│   ├── data/
│   │   └── stations.js   # Texas station definitions
│   ├── ui/
│   │   ├── popup.js      # Popup content generation
│   │   └── chart.js      # Tide curve chart rendering
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

## Current Stations (10 for testing)

1. Galveston Pier 21
2. Galveston Bay Entrance
3. Texas Point, Sabine Pass
4. Rockport
5. Copano Bay
6. Port Aransas
7. Bob Hall Pier, Corpus Christi
8. South Padre Island Coast Guard Station
9. Port Isabel
10. Seadrift

*Full list of ~50 stations to be added*

## Development Notes

- API calls are made on-demand when clicking a station
- No backend required - all data fetched client-side
- Error handling: Gracefully degrades when data is unavailable
- Responsive design for mobile and desktop

## Known Limitations

- Some stations may not report all data types (wind, water temp, etc.)
- NWS API can occasionally be slow or unavailable
- Background refresh feature not yet implemented

## Future Enhancements

- [ ] Add all ~50 Texas coastal stations
- [ ] Implement 3-hour background data refresh
- [ ] Add station search/filter functionality
- [ ] Save favorite stations
- [ ] Historical tide data view
- [ ] Mobile app version

## License

This project uses public data from NOAA and NWS. Map tiles from CARTO.

## Acknowledgments

- Based on patterns from the Copano Bay fishing conditions Discord bot
- NOAA CO-OPS for tide and weather data
- National Weather Service for weather forecasts
