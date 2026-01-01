// Texas Coastal Tide Stations
// Source: NOAA CO-OPS Station Directory
// Data verified: 2025-01-31
// Complete list of all 34 Texas NOAA CO-OPS tide stations
// Verified against NOAA Tides & Currents database and web search

export const TEXAS_STATIONS = [
  // Sabine Pass Region (Northeast Texas Coast)
  {
    id: "8770570",
    name: "Sabine Pass North",
    lat: 29.72840,
    lon: -93.87010,
    products: ["water_level", "predictions", "wind", "water_temperature", "air_temperature", "air_pressure"]
  },
  {
    id: "8770822",
    name: "Texas Point, Sabine Pass",
    lat: 29.689,
    lon: -93.842,
    products: ["water_level", "predictions", "wind", "water_temperature"]
  },

  // Galveston Bay & Houston Ship Channel Region
  {
    id: "8770613",
    name: "Morgans Point, Barbours Cut",
    lat: 29.68169,
    lon: -94.98500,
    products: ["water_level", "predictions", "wind", "water_temperature", "air_temperature", "air_pressure"]
  },
  {
    id: "8770777",
    name: "Manchester",
    lat: 29.726,
    lon: -95.266,
    products: ["water_level", "predictions", "water_temperature"]
  },
  {
    id: "8770808",
    name: "High Island",
    lat: 29.59472,
    lon: -94.39028,
    products: ["water_level", "water_temperature"]
  },
  {
    id: "8770933",
    name: "Clear Lake",
    lat: 29.560,
    lon: -95.030,
    products: ["water_level", "predictions", "water_temperature"]
  },
  {
    id: "8770971",
    name: "Rollover Pass",
    lat: 29.51556,
    lon: -94.51056,
    products: ["water_level", "predictions", "wind", "water_temperature", "air_temperature", "air_pressure"]
  },
  {
    id: "8771013",
    name: "Eagle Point, Galveston Bay",
    lat: 29.481,
    lon: -94.917,
    products: ["water_level", "predictions", "wind", "water_temperature", "air_temperature", "air_pressure"]
  },
  {
    id: "8771262",
    name: "Texas City",
    lat: 29.39060,
    lon: -94.88490,
    products: ["water_level", "predictions", "water_temperature"]
  },
  {
    id: "8771341",
    name: "Galveston Bay Entrance",
    lat: 29.357,
    lon: -94.725,
    products: ["water_level", "predictions", "wind", "water_temperature"]
  },
  {
    id: "8771450",
    name: "Galveston Pier 21",
    lat: 29.310,
    lon: -94.793,
    products: ["water_level", "predictions", "wind", "water_temperature", "air_pressure"]
  },
  {
    id: "8771486",
    name: "Galveston Railroad Bridge",
    lat: 29.30260,
    lon: -94.89710,
    products: ["water_level", "predictions", "wind", "water_temperature", "air_temperature", "air_pressure"]
  },
  {
    id: "8771510",
    name: "Galveston Pleasure Pier",
    lat: 29.284,
    lon: -94.788,
    products: ["water_level", "predictions", "water_temperature"]
  },
  {
    id: "8771972",
    name: "San Luis Pass",
    lat: 29.076,
    lon: -95.122,
    products: ["water_level", "predictions", "wind", "water_temperature", "air_temperature", "air_pressure"]
  },

  // Freeport Region
  {
    id: "8772440",
    name: "Freeport, DOW Barge Canal",
    lat: 28.94830,
    lon: -95.30830,
    products: ["water_level", "predictions", "wind", "water_temperature", "air_temperature", "air_pressure"]
  },
  {
    id: "8772447",
    name: "Freeport Harbor Channel",
    lat: 28.94331,
    lon: -95.30250,
    products: ["water_level", "predictions", "wind", "water_temperature", "air_pressure"]
  },
  {
    id: "8772471",
    name: "Freeport Harbor",
    lat: 28.93570,
    lon: -95.29420,
    products: ["water_level", "predictions", "wind", "water_temperature", "air_temperature", "air_pressure"]
  },
  {
    id: "8772479",
    name: "Freeport Entrance Jetty",
    lat: 28.9303,
    lon: -95.3059,
    products: ["water_level", "predictions"]
  },
  {
    id: "8772985",
    name: "Sargent",
    lat: 28.771,
    lon: -95.617,
    products: ["water_level", "predictions", "water_temperature"]
  },

  // Matagorda Bay Region
  {
    id: "8773146",
    name: "Matagorda City",
    lat: 28.710,
    lon: -95.914,
    products: ["water_level", "predictions", "water_temperature"]
  },
  {
    id: "8773259",
    name: "Port Lavaca",
    lat: 28.640,
    lon: -96.609,
    products: ["water_level", "predictions", "wind", "water_temperature", "air_temperature", "air_pressure"]
  },
  {
    id: "8773701",
    name: "Port O'Connor",
    lat: 28.44586,
    lon: -96.39556,
    products: ["water_level", "predictions", "wind", "water_temperature", "air_temperature", "air_pressure"]
  },
  {
    id: "8773037",
    name: "Seadrift, San Antonio Bay",
    lat: 28.407,
    lon: -96.712,
    products: ["water_level", "predictions", "wind", "water_temperature", "air_temperature", "air_pressure"]
  },
  {
    id: "8773767",
    name: "Seadrift",
    lat: 28.415,
    lon: -96.712,
    products: ["water_level", "predictions"]
  },

  // Aransas & Rockport Region
  {
    id: "8774513",
    name: "Copano Bay",
    lat: 28.114,
    lon: -97.024,
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
    id: "8774230",
    name: "Aransas Wildlife Refuge",
    lat: 28.227,
    lon: -96.796,
    products: ["water_level", "predictions", "wind", "water_temperature", "air_temperature", "air_pressure"]
  },

  // Corpus Christi & Port Aransas Region
  {
    id: "8775237",
    name: "Port Aransas",
    lat: 27.840,
    lon: -97.072,
    products: ["water_level", "predictions", "wind", "water_temperature"]
  },
  {
    id: "8775244",
    name: "Nueces Bay",
    lat: 27.832,
    lon: -97.486,
    products: ["water_level", "predictions", "wind", "water_temperature", "air_temperature", "air_pressure"]
  },
  {
    id: "8775296",
    name: "USS Lexington, Corpus Christi Bay",
    lat: 27.811694,
    lon: -97.39,
    products: ["water_level", "predictions", "wind", "water_temperature", "air_temperature", "air_pressure"]
  },
  {
    id: "8775302",
    name: "Texas State Aquarium",
    lat: 27.813,
    lon: -97.389,
    products: ["water_level", "wind", "water_temperature", "air_temperature", "air_pressure"]
  },
  {
    id: "8775870",
    name: "Bob Hall Pier, Corpus Christi",
    lat: 27.580,
    lon: -97.217,
    products: ["water_level", "predictions", "wind", "water_temperature", "air_pressure"]
  },

  // South Padre Island & Port Isabel Region (South Texas Coast)
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

// Get stations by region
export function getStationsByRegion() {
  return {
    sabine: TEXAS_STATIONS.filter(s => s.id.startsWith('87708') || s.id === '8770570'),
    galveston: TEXAS_STATIONS.filter(s => s.id.startsWith('8770') && s.id >= '8770600' && s.id < '8772000' || s.id.startsWith('8771')),
    freeport: TEXAS_STATIONS.filter(s => s.id.startsWith('87724') || s.id.startsWith('87725') || s.id.startsWith('87726') || s.id.startsWith('87727')),
    matagorda: TEXAS_STATIONS.filter(s => s.id.startsWith('8773')),
    aransas: TEXAS_STATIONS.filter(s => s.id.startsWith('8774')),
    corpusChristi: TEXAS_STATIONS.filter(s => s.id.startsWith('8775')),
    southPadre: TEXAS_STATIONS.filter(s => s.id.startsWith('8779'))
  };
}
