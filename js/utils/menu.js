// Menu toggle functionality

/**
 * Initialize menu functionality
 */
export function initMenu() {
  const menuToggle = document.getElementById('menu-toggle');
  const sideMenu = document.getElementById('side-menu');
  const menuBackdrop = document.getElementById('menu-backdrop');

  if (!menuToggle || !sideMenu || !menuBackdrop) {
    console.warn('Menu elements not found');
    return;
  }

  // Toggle menu when button is clicked
  menuToggle.addEventListener('click', () => {
    toggleMenu();
  });

  // Close menu when backdrop is clicked
  menuBackdrop.addEventListener('click', () => {
    closeMenu();
  });

  // Close menu on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sideMenu.classList.contains('active')) {
      closeMenu();
    }
  });
}

/**
 * Toggle menu open/closed
 */
function toggleMenu() {
  const menuToggle = document.getElementById('menu-toggle');
  const sideMenu = document.getElementById('side-menu');
  const menuBackdrop = document.getElementById('menu-backdrop');

  if (sideMenu.classList.contains('active')) {
    closeMenu();
  } else {
    openMenu();
  }
}

/**
 * Open the menu
 */
function openMenu() {
  const menuToggle = document.getElementById('menu-toggle');
  const sideMenu = document.getElementById('side-menu');
  const menuBackdrop = document.getElementById('menu-backdrop');

  menuToggle.classList.add('active');
  sideMenu.classList.add('active');
  menuBackdrop.classList.add('active');
}

/**
 * Close the menu
 */
function closeMenu() {
  const menuToggle = document.getElementById('menu-toggle');
  const sideMenu = document.getElementById('side-menu');
  const menuBackdrop = document.getElementById('menu-backdrop');

  menuToggle.classList.remove('active');
  sideMenu.classList.remove('active');
  menuBackdrop.classList.remove('active');
}
