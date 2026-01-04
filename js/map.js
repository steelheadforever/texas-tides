// Leaflet map initialization and marker management

import { TEXAS_STATIONS, TEXAS_COAST_BOUNDS } from './data/stations.js';
import { fetchTideNow, fetchNextTide, fetch24HourCurve, fetchWaterTemp, fetchWaterTempHistory, fetchAirTemp, fetchStationWind } from './api/noaa.js';
import { fetchForecast12h, fetchPressure } from './api/nws.js';
import { fetchSunMoonData } from './api/usno.js';
import { buildPopupContent } from './ui/popup.js';
import { renderTideChart, renderWaterTempChart } from './ui/chart.js';

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
      fetchWaterTempHistory(station.id, 1), // Past 1 hour
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
