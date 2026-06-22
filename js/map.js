// Leaflet map: station markers + layer management. Selecting a station opens
// the panel and deliberately does NOT move the map (fixes the old autoPan).

import { TEXAS_STATIONS, TEXAS_COAST_BOUNDS } from './data/stations.js';
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

export function initMap(onStationSelect) {
  onSelect = onStationSelect;
  map = L.map('map', { center: [27.9, -95.6], zoom: 7, zoomControl: true, attributionControl: true });
  L.control.zoom({ position: 'topleft' });

  currentTileLayer = L.tileLayer(isDark() ? TILE_LAYERS.dark : TILE_LAYERS.light, {
    attribution: ATTRIBUTION, maxZoom: 19, minZoom: 5,
  }).addTo(map);

  map.fitBounds(L.latLngBounds(
    [TEXAS_COAST_BOUNDS.south, TEXAS_COAST_BOUNDS.west],
    [TEXAS_COAST_BOUNDS.north, TEXAS_COAST_BOUNDS.east]
  ));

  TEXAS_STATIONS.forEach((station) => {
    const marker = L.marker([station.lat, station.lon], { icon: stationIcon(), title: station.name });
    marker.bindTooltip(station.name, { direction: 'top', offset: [0, -16] });
    marker.on('click', () => { if (onSelect) onSelect(station); }); // no map movement
    marker.addTo(map);
    markers.set(station.id, marker);
  });

  console.log(`Map ready with ${TEXAS_STATIONS.length} stations`);
  return map;
}

export function getMap() {
  return map;
}

/** Pan to a station (used by Favorites) without zooming. */
export function panToStation(station) {
  if (map) map.panTo([station.lat, station.lon], { animate: true });
}

export function switchMapTiles(dark) {
  if (!map || !currentTileLayer) return;
  map.removeLayer(currentTileLayer);
  currentTileLayer = L.tileLayer(dark ? TILE_LAYERS.dark : TILE_LAYERS.light, {
    attribution: ATTRIBUTION, maxZoom: 19, minZoom: 5,
  }).addTo(map);
}
