(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.document) {
    root.fluxLayout = api.create(root);
    root.fluxLayout.start();
  }
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const storageKey = 'flux_layout_preferences';
  const defaults = Object.freeze({ navigation: 'vertical', density: 'comfortable', order: ['dashboard', 'browser', 'ai', 'chat', 'archives', 'movies', 'records', 'settings', 'credits'] });
  const labels = Object.freeze({ dashboard: 'Home', browser: 'Browser', ai: 'Assistant', chat: 'Chat', archives: 'Games', movies: 'Movies', records: 'Records', settings: 'Settings', credits: 'Credits' });
  const safeRead = (storage, key) => { try { return JSON.parse(storage.getItem(key) || '{}'); } catch (_) { return {}; } };
  const normalize = value => {
    const saved = value && typeof value === 'object' ? value : {};
    const navigation = saved.navigation === 'horizontal' ? 'horizontal' : 'vertical';
    const density = ['compact', 'comfortable', 'spacious'].includes(saved.density) ? saved.density : 'comfortable';
    const known = new Set(defaults.order); const order = [];
    for (const id of Array.isArray(saved.order) ? saved.order : []) if (known.has(id) && !order.includes(id)) order.push(id);
    for (const id of defaults.order) if (!order.includes(id)) order.push(id);
    return { navigation, density, order };
  };
  function create(win) {
    const document = win.document; let preferences = normalize(safeRead(win.localStorage, storageKey));
    const nav = () => document.querySelector('.nav-list');
    const save = () => { try { win.localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch (_) {} };
    function buttons() { return preferences.order.map(id => document.getElementById('btn-' + id)).filter(Boolean); }
    function applyClasses() {
      document.body.classList.toggle('flux-nav-horizontal', preferences.navigation === 'horizontal');
      document.body.classList.remove('flux-density-compact', 'flux-density-comfortable', 'flux-density-spacious');
      document.body.classList.add('flux-density-' + preferences.density);
    }
    function renderOrder() {
      const list = document.getElementById('layout-page-order'); if (!list) return;
      list.replaceChildren(...preferences.order.map((id, index) => {
        const item = document.createElement('li');
        const name = document.createElement('span'); name.className = 'layout-page-name'; name.textContent = labels[id] || id;
        const up = document.createElement('button'); up.type = 'button'; up.className = 'layout-order-button'; up.textContent = '↑'; up.setAttribute('aria-label', 'Move ' + name.textContent + ' up'); up.disabled = index === 0;
        const down = document.createElement('button'); down.type = 'button'; down.className = 'layout-order-button'; down.textContent = '↓'; down.setAttribute('aria-label', 'Move ' + name.textContent + ' down'); down.disabled = index === preferences.order.length - 1;
        up.addEventListener('click', () => move(id, -1)); down.addEventListener('click', () => move(id, 1)); item.append(name, up, down); return item;
      }));
    }
    function syncControls() {
      const mode = document.getElementById('set-nav-layout'); const density = document.getElementById('set-content-density');
      if (mode) mode.value = preferences.navigation; if (density) density.value = preferences.density;
    }
    function apply() {
      const container = nav(); if (container) for (const button of buttons()) container.append(button);
      applyClasses(); syncControls(); renderOrder(); save();
    }
    function move(id, direction) {
      const index = preferences.order.indexOf(id); const next = index + direction;
      if (index < 0 || next < 0 || next >= preferences.order.length) return;
      [preferences.order[index], preferences.order[next]] = [preferences.order[next], preferences.order[index]]; apply();
    }
    function start() {
      const mode = document.getElementById('set-nav-layout'); const density = document.getElementById('set-content-density'); const reset = document.getElementById('reset-layout-preferences');
      mode?.addEventListener('change', () => { preferences.navigation = mode.value === 'horizontal' ? 'horizontal' : 'vertical'; apply(); });
      density?.addEventListener('change', () => { preferences.density = ['compact', 'spacious'].includes(density.value) ? density.value : 'comfortable'; apply(); });
      reset?.addEventListener('click', () => { preferences = normalize(defaults); apply(); });
      apply();
    }
    return { start, move, getPreferences: () => ({ ...preferences, order: [...preferences.order] }), setPreferences: value => { preferences = normalize(value); apply(); } };
  }
  return { create, normalize, defaults };
});
