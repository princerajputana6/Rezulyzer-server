// Simple in-memory cache with TTL
// Usage:
//   const cache = require('../utils/cache');
//   const value = cache.get(key);
//   cache.set(key, data, ttlSeconds);

const store = new Map();

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  const { value, expiresAt } = entry;
  if (Date.now() > expiresAt) {
    store.delete(key);
    return null;
  }
  return value;
}

function set(key, value, ttlSeconds = 60) {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  store.set(key, { value, expiresAt });
}

function del(key) {
  store.delete(key);
}

function clear() {
  store.clear();
}

module.exports = { get, set, del, clear };
