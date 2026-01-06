// Dark mode toggle functionality

import { switchMapTiles } from '../map.js';

const STORAGE_KEY = 'texas-tides-dark-mode';

/**
 * Initialize dark mode based on localStorage preference
 */
export function initDarkMode() {
  // Check localStorage for saved preference
  const savedMode = localStorage.getItem(STORAGE_KEY);

  // If no saved preference, check system preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Apply dark mode if saved or preferred
  if (savedMode === 'dark' || (savedMode === null && prefersDark)) {
    enableDarkMode();
  }

  // Set up toggle checkbox in menu
  const toggleCheckbox = document.getElementById('dark-mode-toggle');
  if (toggleCheckbox) {
    // Set initial state
    toggleCheckbox.checked = document.body.classList.contains('dark-mode');

    // Listen for changes
    toggleCheckbox.addEventListener('change', toggleDarkMode);
  }
}

/**
 * Toggle dark mode on/off
 */
function toggleDarkMode() {
  if (document.body.classList.contains('dark-mode')) {
    disableDarkMode();
  } else {
    enableDarkMode();
  }
}

/**
 * Enable dark mode
 */
function enableDarkMode() {
  document.body.classList.add('dark-mode');
  localStorage.setItem(STORAGE_KEY, 'dark');
  updateToggleCheckbox();
  switchMapTiles(true);
}

/**
 * Disable dark mode
 */
function disableDarkMode() {
  document.body.classList.remove('dark-mode');
  localStorage.setItem(STORAGE_KEY, 'light');
  updateToggleCheckbox();
  switchMapTiles(false);
}

/**
 * Update the toggle checkbox state
 */
function updateToggleCheckbox() {
  const toggleCheckbox = document.getElementById('dark-mode-toggle');
  if (toggleCheckbox) {
    toggleCheckbox.checked = document.body.classList.contains('dark-mode');
  }
}
