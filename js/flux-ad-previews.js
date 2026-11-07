(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root?.document) { root.fluxAdPreviews = api.create(root); root.fluxAdPreviews.start(); }
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const storageKey = 'flux_ad_preferences_v1';
  // Placement mockups only. This module never loads an ad provider or sends ad requests.
  function hostMode(value) {
    const host = String(value || '').trim().toLowerCase().replace(/\.$/, '');
    if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) return 'preview';
    if (!/^[a-z0-9.-]+$/.test(host)) return 'ad-free';
    if (host.endsWith('.netlify.app') || host.endsWith('.onrender.com')) return 'preview';
    return 'ad-free';
  }
  function preference(value) {
    try { const saved = JSON.parse(value || '{}'); return saved?.enabled !== false; }
    catch (_) { return true; }
  }
  function create(win) {
    const doc = win.document, allowed = hostMode(win.location.hostname) === 'preview';
    const read = () => { try { return preference(win.localStorage.getItem(storageKey)); } catch (_) { return true; } };
    let requested = read(), started = false;
    function render() {
      const visible = allowed && requested;
      doc.documentElement.classList.toggle('flux-ad-previews', visible);
      doc.querySelectorAll('[data-ad-preview]').forEach(slot => { slot.hidden = !visible; });
      const toggle = doc.getElementById('set-ad-previews'), note = doc.getElementById('ad-previews-description');
      if (toggle) { toggle.checked = visible; toggle.disabled = !allowed; }
      if (note) note.textContent = allowed
        ? 'Preview ad spaces on Home and Games. Real advertisements are not connected.'
        : 'This address stays ad-free. Advertisement previews are hidden.';
    }
    function setEnabled(value) {
      requested = !!value;
      try { win.localStorage.setItem(storageKey, JSON.stringify({ enabled: requested })); } catch (_) {}
      render();
    }
    function bind() {
      doc.getElementById('set-ad-previews')?.addEventListener('change', event => setEnabled(event.target.checked));
      render();
    }
    function start() {
      if (started) return; started = true; render();
      if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
      win.addEventListener('storage', event => {
        if (event.key !== storageKey && event.key !== null) return;
        requested = event.key === null ? true : preference(event.newValue); render();
      });
    }
    return { start, setEnabled, isEnabled: () => allowed && requested };
  }
  return { create, hostMode };
});
