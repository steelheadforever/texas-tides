// User preferences, persisted to localStorage. Mirrors the iOS AppSettings:
// appearance (system/light/dark), wind unit (mph/knots), legend visibility.

const KEY = 'slackwater.settings';

const defaults = { appearance: 'system', windUnit: 'mph', showLegend: true };

let state = load();
const listeners = new Set();

function load() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...defaults };
  }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

export function getSettings() {
  return { ...state };
}

export function setSetting(key, value) {
  state[key] = value;
  save();
  if (key === 'appearance') applyAppearance();
  listeners.forEach((fn) => fn(getSettings()));
}

export function onSettingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

export function applyAppearance() {
  const dark = state.appearance === 'dark' || (state.appearance === 'system' && darkQuery.matches);
  document.body.classList.toggle('dark-mode', dark);
  listeners.forEach((fn) => fn(getSettings()));
}

// React to OS theme changes when in "system" mode.
darkQuery.addEventListener('change', () => {
  if (state.appearance === 'system') applyAppearance();
});

export function isDark() {
  return document.body.classList.contains('dark-mode');
}
