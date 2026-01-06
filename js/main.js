// Main application entry point
// Texas Coastal Tides Web Application

import { initMap } from './map.js';
import { initDarkMode } from './utils/dark-mode.js';
import { initMenu } from './utils/menu.js';

/**
 * Wait for external libraries (Leaflet, Chart.js) to load
 */
function waitForLibraries() {
  return new Promise((resolve) => {
    const checkLibraries = () => {
      if (typeof L !== 'undefined' && typeof Chart !== 'undefined') {
        console.log('External libraries loaded successfully');
        resolve();
      } else {
        console.log('Waiting for libraries...');
        setTimeout(checkLibraries, 100);
      }
    };
    checkLibraries();
  });
}

/**
 * Initialize the application when DOM is loaded
 */
async function init() {
  console.log('Texas Coastal Tides - Initializing...');

  // Initialize dark mode first (before anything renders)
  initDarkMode();

  // Initialize menu
  initMenu();

  // Wait for external libraries to load
  await waitForLibraries();

  // Initialize the map
  try {
    initMap();
    console.log('Map initialized successfully');
  } catch (err) {
    console.error('Error initializing map:', err);
  }

  // Update status bar
  updateStatusBar();

  console.log('Application initialized successfully');
}

/**
 * Update status bar with last update time
 */
function updateStatusBar() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const lastUpdateElement = document.querySelector('#last-update .time');
  if (lastUpdateElement) {
    lastUpdateElement.textContent = timeString;
  }

  const nextUpdateElement = document.querySelector('#next-update .time');
  if (nextUpdateElement) {
    nextUpdateElement.textContent = 'on station click';
  }
}

// Wait for DOM to be fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // DOM already loaded
  init();
}
