// Storage can be disabled (privacy settings, quota, embedded browsers).
// Keep successful reads and all writes available for the rest of this session.
const memory = new Map();
export const storage = {
  getItem(key) {
    if (memory.has(key)) return memory.get(key);
    try {
      const value = localStorage.getItem(key);
      if (value !== null) memory.set(key, value);
      return value;
    } catch { return null; }
  },
  setItem(key, value) {
    memory.set(key, String(value));
    try { localStorage.setItem(key, String(value)); } catch { /* session only */ }
  },
};
