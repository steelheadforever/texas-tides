// Slide-in panel manager. One panel open at a time + shared backdrop.
// On mobile these become bottom sheets (CSS-driven).

let backdrop;
let activePanel = null;
const closeListeners = new Map(); // panelId -> fn

function ensureBackdrop() {
  if (backdrop) return;
  backdrop = document.getElementById('panel-backdrop');
  backdrop.addEventListener('click', () => closePanel());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
  // Wire every [data-close] button inside panels.
  document.querySelectorAll('.panel [data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closePanel());
  });
}

export function openPanel(id, onClose) {
  ensureBackdrop();
  const panel = document.getElementById(id);
  if (!panel) return;
  // If switching panels, keep the backdrop up and swap.
  if (activePanel && activePanel !== panel) {
    activePanel.classList.remove('active');
    activePanel.setAttribute('aria-hidden', 'true');
  }
  panel.classList.add('active');
  panel.setAttribute('aria-hidden', 'false');
  backdrop.classList.add('active');
  activePanel = panel;
  if (onClose) closeListeners.set(id, onClose);
}

export function closePanel() {
  if (!activePanel) return;
  const id = activePanel.id;
  activePanel.classList.remove('active');
  activePanel.setAttribute('aria-hidden', 'true');
  backdrop.classList.remove('active');
  activePanel = null;
  const fn = closeListeners.get(id);
  if (fn) { closeListeners.delete(id); fn(); }
}

export function isPanelOpen(id) {
  return activePanel && activePanel.id === id;
}
