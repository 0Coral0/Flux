(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FluxHomeEditor = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const storageKey = 'flux_home_preferences_v1';
  const ids = ['welcome', 'stats', 'recent', 'hot'];
  const labels = { welcome: 'Welcome banner', stats: 'Library and account', recent: 'Recently added', hot: 'Popular games' };
  const defaults = { order: ids, hidden: [], columns: 'auto', hero: 'full', updatedAt: 0 };
  function normalize(value) {
    const saved = value && typeof value === 'object' ? value : {};
    const order = [...new Set((Array.isArray(saved.order) ? saved.order : []).filter(id => ids.includes(id)))];
    ids.forEach(id => { if (!order.includes(id)) order.push(id); });
    return { order, hidden: [...new Set((Array.isArray(saved.hidden) ? saved.hidden : []).filter(id => ids.includes(id)))],
      columns: ['auto', '3', '4', '5', '6'].includes(String(saved.columns)) ? String(saved.columns) : 'auto',
      hero: saved.hero === 'compact' ? 'compact' : 'full', updatedAt: Number.isSafeInteger(saved.updatedAt) && saved.updatedAt >= 0 ? saved.updatedAt : 0 };
  }
  function move(order, id, target) {
    const next = [...order], index = next.indexOf(id); if (index < 0 || target < 0 || target >= next.length) return next;
    next.splice(index, 1); next.splice(target, 0, id); return next;
  }
  function create(win) {
    const doc = win.document, el = id => doc.getElementById(id);
    let preferences; try { preferences = normalize(JSON.parse(win.localStorage.getItem(storageKey) || '{}')); } catch (_) { preferences = normalize(); }
    let editing = false, syncTimer, revision = 0, dragging = null;
    const sections = new Map(ids.map(id => [id, doc.querySelector('[data-home-section="' + id + '"]')]));
    const node = (tag, className, text) => { const item = doc.createElement(tag); if (className) item.className = className; if (text !== undefined) item.textContent = text; return item; };
    function persist() { try { win.localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch (_) {} }
    function scheduleSync() {
      clearTimeout(syncTimer);
      if (win.fluxAuthState?.status !== 'signed-in' || !win.fluxData) return;
      const uid = win.fluxAuthState.uid;
      syncTimer = win.setTimeout(async () => {
        if (win.fluxAuthState?.uid !== uid) return;
        try { await win.fluxData.putSettings({ homepage: preferences }); el('home-edit-status').textContent = 'Homepage saved to your account.'; }
        catch (_) { el('home-edit-status').textContent = 'Saved on this device. Account sync is temporarily unavailable.'; }
      }, 700);
    }
    function change(value) {
      revision++; preferences = normalize({ ...preferences, ...value, updatedAt: Date.now() });
      persist(); apply(); scheduleSync(); el('home-edit-status').textContent = 'Homepage saved.';
    }
    function focusSection(id) { sections.get(id)?.querySelector('[data-home-drag]')?.focus(); }
    function reorder(id, target) { change({ order: move(preferences.order, id, target) }); focusSection(id); }
    function toggle(id) { change({ hidden: preferences.hidden.includes(id) ? preferences.hidden.filter(item => item !== id) : [...preferences.hidden, id] }); focusSection(id); }
    function apply() {
      const home = el('view-dashboard'); home.classList.toggle('home-editing', editing);
      home.dataset.homeColumns = preferences.columns; home.dataset.homeHero = preferences.hero;
      el('home-editor-panel').hidden = !editing;
      el('home-customize').textContent = editing ? 'Done editing' : 'Customize home';
      el('home-customize').setAttribute('aria-expanded', String(editing));
      el('home-empty-layout').hidden = editing || preferences.hidden.length !== ids.length;
      preferences.order.forEach((id, index) => {
        const section = sections.get(id); if (!section) return;
        section.hidden = !editing && preferences.hidden.includes(id);
        section.classList.toggle('home-section-muted', editing && preferences.hidden.includes(id));
        section.querySelector('.home-edit-tools')?.remove();
        if (editing) {
          const tools = node('div', 'home-edit-tools');
          const handle = node('button', 'home-edit-handle', '⠿ ' + labels[id]); handle.type = 'button'; handle.draggable = true; handle.dataset.homeDrag = id; handle.setAttribute('aria-label', 'Drag ' + labels[id] + ' to move it');
          const up = node('button', 'home-edit-action', '↑'), down = node('button', 'home-edit-action', '↓'), hide = node('button', 'home-edit-action', preferences.hidden.includes(id) ? 'Show' : 'Hide');
          up.type = down.type = hide.type = 'button'; up.disabled = index === 0; down.disabled = index === ids.length - 1;
          up.setAttribute('aria-label', 'Move ' + labels[id] + ' up'); down.setAttribute('aria-label', 'Move ' + labels[id] + ' down'); hide.setAttribute('aria-label', (preferences.hidden.includes(id) ? 'Show ' : 'Hide ') + labels[id]);
          up.onclick = () => reorder(id, index - 1); down.onclick = () => reorder(id, index + 1); hide.onclick = () => toggle(id);
          tools.append(handle, up, down, hide); section.prepend(tools);
        }
        home.append(section);
      });
      el('home-game-columns').value = preferences.columns; el('home-banner-size').value = preferences.hero;
    }
    async function cloud() {
      const uid = win.fluxAuthState?.uid, generation = revision;
      if (!uid || !win.fluxData) return;
      try {
        const result = await win.fluxData.getSettings();
        if (win.fluxAuthState?.uid !== uid || revision !== generation) return;
        const remote = normalize(result.settings?.homepage);
        if (remote.updatedAt > preferences.updatedAt) { preferences = remote; persist(); apply(); }
        else if (preferences.updatedAt > remote.updatedAt) scheduleSync();
      } catch (_) {}
    }
    function start() {
      el('home-customize').onclick = () => { editing = !editing; apply(); };
      el('home-edit-done').onclick = () => { editing = false; apply(); el('home-customize').focus(); };
      el('home-layout-reset').onclick = () => change(defaults);
      el('home-game-columns').onchange = event => change({ columns: event.target.value });
      el('home-banner-size').onchange = event => change({ hero: event.target.value });
      const home = el('view-dashboard');
      home.addEventListener('dragstart', event => { const handle = event.target.closest('[data-home-drag]'); if (!editing || !handle) return; dragging = handle.dataset.homeDrag; event.dataTransfer.setData('text/plain', dragging); event.dataTransfer.effectAllowed = 'move'; });
      home.addEventListener('dragover', event => { if (editing && dragging && event.target.closest('[data-home-section]')) event.preventDefault(); });
      home.addEventListener('drop', event => { const target = event.target.closest('[data-home-section]'); if (!editing || !dragging || !target) return; event.preventDefault(); reorder(dragging, preferences.order.indexOf(target.dataset.homeSection)); dragging = null; });
      home.addEventListener('dragend', () => { dragging = null; });
      win.addEventListener('flux-auth-changed', cloud);
      win.addEventListener('storage', event => { if (event.key !== storageKey) return; try { preferences = normalize(JSON.parse(event.newValue || '{}')); revision++; apply(); } catch (_) {} });
      apply(); cloud();
    }
    return { start, getPreferences: () => normalize(preferences), setPreferences: change };
  }
  return { defaults, normalize, move, create };
});
