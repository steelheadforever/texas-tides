// Leaflet map initialization and marker management

import { TEXAS_STATIONS, TEXAS_COAST_BOUNDS } from './data/stations.js';
import { fetchTideNow, fetchNextTide, fetch24HourCurve, fetchWaterTemp, fetchStationWind } from './api/noaa.js';
import { fetchForecast12h, fetchPressure } from './api/nws.js';
import { getMoonPhase } from './api/moon.js';
import { buildPopupContent } from './ui/popup.js';
import { renderTideChart } from './ui/chart.js';

let map;
const markers = new Map(); // stationId -> marker

// CartoDB Positron grayscale tiles
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

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

  // Add grayscale tile layer
  L.tileLayer(TILE_URL, {
    attribution: ATTRIBUTION,
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
    autoPanPaddingBottomRight: [20, 20]  // Keep popup visible from bottom-right
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
      wind,
      windForecast,
      pressure,
      moon
    ] = await Promise.all([
      fetchTideNow(station.id),
      fetchNextTide(station.id),
      fetch24HourCurve(station.id),
      fetchWaterTemp(station.id),
      fetchStationWind(station.id),
      fetchForecast12h(station.lat, station.lon),
      fetchPressure(station.lat, station.lon),
      getMoonPhase()
    ]);

    console.log('Data fetched successfully');

    // Build popup content
    const content = buildPopupContent(station, {
      tideNow,
      nextTide,
      waterTemp,
      wind,
      windForecast,
      pressure,
      moon
    });

    // Update popup with content
    popup.setContent(content);

    // Render chart after a short delay to ensure DOM is ready
    setTimeout(() => {
      if (curve) {
        renderTideChart(curve);
      } else {
        console.warn('No curve data available for chart');
      }
    }, 100);

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
 * Get map instance (for external use)
 */
export function getMap() {
  return map;
}

/**
 * Get all markers
 */
export function getMarkers() {
  return markers;
}
