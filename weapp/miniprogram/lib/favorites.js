// Favorites + recently opened (web: useLocalStorage('favorites' | 'recent')).
const storage = require('./storage');
const bus = require('./bus');

const FAV_KEY = 'biolab_favorites';
const RECENT_KEY = 'biolab_recent';

function favs() {
  const v = storage.get(FAV_KEY, []);
  return Array.isArray(v) ? v : [];
}
function recent() {
  const v = storage.get(RECENT_KEY, []);
  return Array.isArray(v) ? v : [];
}
function isFav(id) { return favs().includes(id); }

// Returns the new state (true = now a favorite).
function toggle(id) {
  const list = favs();
  const on = !list.includes(id);
  const next = on ? list.concat(id) : list.filter((x) => x !== id);
  storage.set(FAV_KEY, next);
  bus.emit('favs', { favs: next, recent: recent() });
  return on;
}

function addRecent(id) {
  const next = [id].concat(recent().filter((x) => x !== id)).slice(0, 8);
  storage.set(RECENT_KEY, next);
  bus.emit('favs', { favs: favs(), recent: next });
}

module.exports = { favs, recent, isFav, toggle, addRecent };
