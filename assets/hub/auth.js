(function (global) {
  const STORE = 'workix_hub_auth_v1';

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORE) || '{}');
    } catch (e) {
      return {};
    }
  }

  function save(data) {
    localStorage.setItem(STORE, JSON.stringify(data || {}));
  }

  function get() {
    return load();
  }

  function set(partial) {
    const next = { ...load(), ...partial };
    save(next);
    return next;
  }

  function clear() {
    localStorage.removeItem(STORE);
  }

  function bearer() {
    const a = load();
    return a.agentApiKey || a.token || null;
  }

  global.WorkixAuth = { get, set, clear, bearer, STORE };
})(typeof window !== 'undefined' ? window : globalThis);
