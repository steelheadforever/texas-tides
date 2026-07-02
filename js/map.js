// Leaflet map: station markers + layer management. Selecting a station opens
// the panel and deliberately does NOT move the map (fixes the old autoPan).
//
// Markers come from the national catalog (stationStore) and are clustered —
// ~3,500 pins is far too many for raw DOM markers. If the markercluster
// plugin failed to load from the CDN, we fall back to the bundled Texas list
// unclustered rather than freezing the page.

import { TEXAS_STATIONS, TEXAS_COAST_BOUNDS } from './data/stations.js';
import { getStations } from './data/stationStore.js';
import { isDark } from './settings.js';

let map;
let currentTileLayer = null;
const markers = new Map();
let onSelect = null;

const TILE_LAYERS = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

function stationIcon() {
  return L.divIcon({
    className: 'station-marker',
    html: '<span class="pin"><i class="ph-fill ph-waves"></i></span>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function clusterIcon(cluster) {
  const n = cluster.getChildCount();
  const size = n >= 100 ? 40 : n >= 10 ? 34 : 28;
  return L.divIcon({
    className: 'station-cluster',
    html: `<span class="cluster-pin">${n}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function addStationMarkers(stations) {
  const clustered = typeof L.markerClusterGroup === 'function';
  const layer = clustered
    ? L.markerClusterGroup({
        chunkedLoading: true,
        showCoverageOnHover: false,
        maxClusterRadius: 46,
        disableClusteringAtZoom: 11,
        iconCreateFunction: clusterIcon,
      })
    : L.layerGroup();

  // Without the plugin, thousands of DOM markers would freeze the page —
  // keep the bundled Texas set as a degraded-but-usable map.
  const list = clustered ? stations : stations.slice(0, 200);
  if (!clustered) console.warn('markercluster plugin missing — rendering first 200 stations only');

  for (const station of list) {
    const marker = L.marker([station.lat, station.lon], { icon: stationIcon(), title: station.name });
    marker.bindTooltip(station.name, { direction: 'top', offset: [0, -16] });
    marker.on('click', () => { if (onSelect) onSelect(station); }); // no map movement
    layer.addLayer(marker);
    markers.set(station.id, marker);
  }
  layer.addTo(map);
  console.log(`Map ready with ${list.length} stations${clustered ? ' (clustered)' : ''}`);
}

export function initMap(onStationSelect) {
  onSelect = onStationSelect;
  map = L.map('map', { center: [27.9, -95.6], zoom: 7, zoomControl: true, attributionControl: true });
  L.control.zoom({ position: 'topleft' });

  currentTileLayer = L.tileLayer(isDark() ? TILE_LAYERS.dark : TILE_LAYERS.light, {
    attribution: ATTRIBUTION, maxZoom: 19, minZoom: 3,
  }).addTo(map);

  // Default view stays the Texas coast for now (national default lands with
  // the geolocation work). Markers arrive async from the catalog.
  map.fitBounds(L.latLngBounds(
    [TEXAS_COAST_BOUNDS.south, TEXAS_COAST_BOUNDS.west],
    [TEXAS_COAST_BOUNDS.north, TEXAS_COAST_BOUNDS.east]
  ));

  getStations()
    .then(addStationMarkers)
    .catch((err) => {
      console.error('Station load failed, using bundled Texas list:', err);
      addStationMarkers(TEXAS_STATIONS);
    });

  return map;
}

export function getMap() {
  return map;
}

/** Pan to a station (used by Favorites/search) without zooming out. */
export function panToStation(station) {
  if (!map) return;
  // Zoom past the cluster threshold so the station's own pin is visible.
  const zoom = Math.max(map.getZoom(), 11);
  map.setView([station.lat, station.lon], zoom, { animate: true });
}

export function switchMapTiles(dark) {
  if (!map || !currentTileLayer) return;
  map.removeLayer(currentTileLayer);
  currentTileLayer = L.tileLayer(dark ? TILE_LAYERS.dark : TILE_LAYERS.light, {
    attribution: ATTRIBUTION, maxZoom: 19, minZoom: 3,
  }).addTo(map);
}
