// Leaflet map initialization and marker management

import { TEXAS_STATIONS, TEXAS_COAST_BOUNDS } from './data/stations.js';
import { fetchTideNow, fetchNextTide, fetch24HourCurve, fetchWaterTemp, fetchWaterTempHistory, fetchAirTemp, fetchStationWind, fetchTidePredictions7Day } from './api/noaa.js';
import { fetchForecast12h, fetchPressure, fetchWeatherForecast7Day } from './api/nws.js';
import { fetchSunMoonData, fetchSunMoon7Day } from './api/usno.js';
import { buildPopupContent } from './ui/popup.js';
import { buildForecastPopupContent } from './ui/forecastPopup.js';
import { renderTideChart, renderWaterTempChart, renderDayTideSparkline } from './ui/chart.js';

let map;
const markers = new Map(); // stationId -> marker
let currentTileLayer = null; // Store current tile layer for switching

// CartoDB tile layers
const TILE_LAYERS = {
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }
};

/**
 * Initialize the map and add station markers
 */
export function initMap() {
  // Create map centered on Texas coast
  map = L.map('map', {
    center: [27.5, -96.0],
    zoom: 7,
    zoomControl: true
  });

  // Add initial tile layer based on dark mode
  const isDarkMode = document.body.classList.contains('dark-mode');
  const tileConfig = isDarkMode ? TILE_LAYERS.dark : TILE_LAYERS.light;

  currentTileLayer = L.tileLayer(tileConfig.url, {
    attribution: tileConfig.attribution,
    maxZoom: 19,
    minZoom: 5
  }).addTo(map);

  // Fit map to Texas coast bounds
  const bounds = L.latLngBounds(
    [TEXAS_COAST_BOUNDS.south, TEXAS_COAST_BOUNDS.west],
    [TEXAS_COAST_BOUNDS.north, TEXAS_COAST_BOUNDS.east]
  );
  map.fitBounds(bounds);

  // Add markers for all stations
  TEXAS_STATIONS.forEach(station => {
    addStationMarker(station);
  });

  // Set up event delegation for forecast button clicks
  setupForecastButtonHandler();

  console.log(`Map initialized with ${TEXAS_STATIONS.length} stations`);
}

/**
 * Add a marker for a station
 */
function addStationMarker(station) {
  const marker = L.marker([station.lat, station.lon], {
    title: station.name
  });

  // Add tooltip on hover
  marker.bindTooltip(station.name, {
    permanent: false,
    direction: 'top',
    offset: [0, -20]
  });

  // Add click handler
  marker.on('click', () => handleStationClick(station));

  marker.addTo(map);
  markers.set(station.id, marker);
}

/**
 * Handle station marker click
 * Fetch data and display popup
 */
async function handleStationClick(station) {
  console.log(`Clicked station: ${station.name} (${station.id})`);

  // Create and show loading popup
  const popup = L.popup({
    maxWidth: 700,
    minWidth: 600,
    className: 'station-popup-container',
    autoPan: true,
    autoPanPaddingTopLeft: [20, 80],  // Keep popup visible from top-left
    autoPanPaddingBottomRight: [20, 80]  // Keep popup visible from bottom (footer + margin)
  })
    .setLatLng([station.lat, station.lon])
    .setContent('<div class="loading">Loading station data</div>')
    .openOn(map);

  try {
    // Fetch all data in parallel
    console.log('Fetching data for station:', station.id);

    const [
      tideNow,
      nextTide,
      curve,
      waterTemp,
      waterTempHistory,
      airTemp,
      wind,
      windForecast,
      pressure,
      sunMoon
    ] = await Promise.all([
      fetchTideNow(station.id),
      fetchNextTide(station.id),
      fetch24HourCurve(station.id),
      fetchWaterTemp(station.id),
      fetchWaterTempHistory(station.id, 24), // Past 24 hours
      fetchAirTemp(station.id, station.lat, station.lon),
      fetchStationWind(station.id),
      fetchForecast12h(station.lat, station.lon),
      fetchPressure(station.lat, station.lon),
      fetchSunMoonData(station.lat, station.lon)
    ]);

    console.log('Data fetched successfully');

    // Build popup content
    const content = buildPopupContent(station, {
      tideNow,
      nextTide,
      waterTemp,
      waterTempHistory,
      airTemp,
      wind,
      windForecast,
      pressure,
      sunMoon
    });

    // Update popup with content
    popup.setContent(content);

    // Render charts after browser paint (ensures DOM is fully rendered and measurable)
    requestAnimationFrame(() => {
      if (curve) {
        renderTideChart(curve);
      } else {
        console.warn('No curve data available for chart');
      }

      // Render water temperature chart if data is available
      if (waterTempHistory && waterTempHistory.length > 0) {
        renderWaterTempChart(waterTempHistory);
      } else {
        console.log('No water temperature history data available');
      }
    });

  } catch (err) {
    console.error('Error fetching station data:', err);
    popup.setContent(`
      <div class="error">
        <h3>Error Loading Data</h3>
        <p>Unable to fetch data for ${station.name}.</p>
        <p style="font-size: 0.85rem; margin-top: 0.5rem;">Please try again later.</p>
      </div>
    `);
  }
}

/**
 * Switch map tiles between light and dark mode
 */
export function switchMapTiles(isDarkMode) {
  if (!map || !currentTileLayer) return;

  // Remove current tile layer
  map.removeLayer(currentTileLayer);

  // Add new tile layer
  const tileConfig = isDarkMode ? TILE_LAYERS.dark : TILE_LAYERS.light;
  currentTileLayer = L.tileLayer(tileConfig.url, {
    attribution: tileConfig.attribution,
    maxZoom: 19,
    minZoom: 5
  }).addTo(map);
}

/**
 * Set up event delegation for forecast button clicks
 * Since buttons are created dynamically in popups, we need event delegation
 */
function setupForecastButtonHandler() {
  // Listen for clicks on the entire document
  document.addEventListener('click', (event) => {
    // Check if the clicked element is a forecast button
    if (event.target.classList.contains('forecast-button')) {
      handleForecastClick(event);
    }
  });
}

/**
 * Handle forecast button click
 * Fetch 8-day forecast data and display forecast popup
 */
async function handleForecastClick(event) {
  const button = event.target;

  // Extract station data from button attributes
  const stationId = button.getAttribute('data-station-id');
  const stationName = button.getAttribute('data-station-name');
  const lat = parseFloat(button.getAttribute('data-lat'));
  const lon = parseFloat(button.getAttribute('data-lon'));

  console.log(`Forecast button clicked for station: ${stationName} (${stationId})`);

  const station = {
    id: stationId,
    name: stationName,
    lat: lat,
    lon: lon
  };

  // Create and show loading popup
  const popup = L.popup({
    maxWidth: 1000,
    minWidth: 900,
    className: 'forecast-popup-container',
    autoPan: true,
    autoPanPaddingTopLeft: [20, 80],
    autoPanPaddingBottomRight: [20, 80]
  })
    .setLatLng([lat, lon])
    .setContent('<div class="loading">Loading 7-day forecast...</div>')
    .openOn(map);

  try {
    console.log('Fetching 7-day forecast data for station:', stationId);

    // Fetch all forecast data in parallel
    const [
      tidePredictions7Day,
      weatherForecast7Day,
      sunMoon7Day
    ] = await Promise.all([
      fetchTidePredictions7Day(stationId),
      fetchWeatherForecast7Day(lat, lon),
      fetchSunMoon7Day(lat, lon)
    ]);

    console.log('7-day forecast data fetched successfully');

    // Build forecast popup content
    const content = buildForecastPopupContent({
      weather: weatherForecast7Day || [],
      sunMoon: sunMoon7Day || []
    }, station);

    // Update popup with content
    popup.setContent(content);

    // Render tide sparklines for each day after browser paint
    requestAnimationFrame(() => {
      if (tidePredictions7Day && tidePredictions7Day.length > 0) {
        // Render sparkline for each of the 7 days
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
          renderDayTideSparkline(dayIndex, tidePredictions7Day);
        }
      } else {
        console.warn('No 7-day tide prediction data available for charts');
      }
    });

  } catch (err) {
    console.error('Error fetching 7-day forecast data:', err);
    popup.setContent(`
      <div class="error">
        <h3>Error Loading Forecast</h3>
        <p>Unable to fetch 7-day forecast for ${stationName}.</p>
        <p style="font-size: 0.85rem; margin-top: 0.5rem;">Please try again later.</p>
      </div>
    `);
  }
}
