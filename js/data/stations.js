// Texas Coastal Tide Stations
// Source: NOAA CO-OPS Station Directory
// Data verified: 2025-01-26

export const TEXAS_STATIONS = [
  {
    id: "8771450",
    name: "Galveston Pier 21",
    lat: 29.310,
    lon: -94.793,
    products: ["water_level", "predictions", "wind", "water_temperature", "air_pressure"]
  },
  {
    id: "8771341",
    name: "Galveston Bay Entrance",
    lat: 29.357,
    lon: -94.725,
    products: ["water_level", "predictions", "wind", "water_temperature"]
  },
  {
    id: "8770822",
    name: "Texas Point, Sabine Pass",
    lat: 29.689,
    lon: -93.842,
    products: ["water_level", "predictions", "wind", "water_temperature"]
  },
  {
    id: "8774770",
    name: "Rockport",
    lat: 28.022,
    lon: -97.047,
    products: ["water_level", "predictions", "wind", "water_temperature"]
  },
  {
    id: "8774513",
    name: "Copano Bay",
    lat: 28.114,
    lon: -97.024,
    products: ["water_level", "predictions", "wind", "water_temperature"]
  },
  {
    id: "8775237",
    name: "Port Aransas",
    lat: 27.840,
    lon: -97.072,
    products: ["water_level", "predictions", "wind", "water_temperature"]
  },
  {
    id: "8775870",
    name: "Bob Hall Pier, Corpus Christi",
    lat: 27.580,
    lon: -97.217,
    products: ["water_level", "predictions", "wind", "water_temperature", "air_pressure"]
  },
  {
    id: "8779748",
    name: "South Padre Island Coast Guard Station",
    lat: 26.072,
    lon: -97.167,
    products: ["water_level", "predictions", "wind"]
  },
  {
    id: "8779770",
    name: "Port Isabel",
    lat: 26.061,
    lon: -97.216,
    products: ["water_level", "predictions"]
  },
  {
    id: "8773767",
    name: "Seadrift",
    lat: 28.415,
    lon: -96.712,
    products: ["water_level", "predictions"]
  }
];

// Map bounds for Texas coast
export const TEXAS_COAST_BOUNDS = {
  north: 30.0,
  south: 25.9,
  east: -93.8,
  west: -97.5
};

// Helper function to check if station supports a product
export function stationHasProduct(station, product) {
  return station.products && station.products.includes(product);
}

// Get station by ID
export function getStationById(stationId) {
  return TEXAS_STATIONS.find(s => s.id === stationId);
}

// Get all station IDs
export function getAllStationIds() {
  return TEXAS_STATIONS.map(s => s.id);
}
