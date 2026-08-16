// Simple localStorage-backed store, namespaced per key.
export const Store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  update(key, fallback, fn) {
    const cur = Store.get(key, fallback);
    const next = fn(cur);
    Store.set(key, next);
    return next;
  }
};

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function fmtDateShort(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}
