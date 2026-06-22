// Ordered favorite station ids in localStorage. Mirrors the iOS FavoritesStore.

const KEY = 'slackwater.favorites';
const listeners = new Set();

let ids = load();

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch {}
  listeners.forEach((fn) => fn(getFavoriteIds()));
}

export function getFavoriteIds() {
  return [...ids];
}

export function isFavorite(id) {
  return ids.includes(id);
}

export function toggleFavorite(id) {
  const i = ids.indexOf(id);
  if (i >= 0) ids.splice(i, 1);
  else ids.push(id);
  save();
}

export function moveFavorite(fromIndex, toIndex) {
  if (fromIndex === toIndex) return;
  const [item] = ids.splice(fromIndex, 1);
  ids.splice(toIndex, 0, item);
  save();
}

export function removeFavorite(id) {
  const i = ids.indexOf(id);
  if (i >= 0) { ids.splice(i, 1); save(); }
}

export function onFavoritesChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
