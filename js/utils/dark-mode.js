// Dark mode toggle functionality

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

  // Set up toggle button
  const toggleButton = document.getElementById('dark-mode-toggle');
  if (toggleButton) {
    toggleButton.addEventListener('click', toggleDarkMode);
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
  updateToggleIcon();
}

/**
 * Disable dark mode
 */
function disableDarkMode() {
  document.body.classList.remove('dark-mode');
  localStorage.setItem(STORAGE_KEY, 'light');
  updateToggleIcon();
}

/**
 * Update the toggle button icon
 */
function updateToggleIcon() {
  const toggleIcon = document.querySelector('.toggle-icon');
  if (toggleIcon) {
    if (document.body.classList.contains('dark-mode')) {
      toggleIcon.textContent = '☀️'; // Sun icon for dark mode
    } else {
      toggleIcon.textContent = '🌙'; // Moon icon for light mode
    }
  }
}
