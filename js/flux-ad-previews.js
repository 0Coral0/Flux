(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root?.document) { root.fluxAdPreviews = api.create(root); root.fluxAdPreviews.start(); }
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const storageKey = 'flux_ad_preferences_v1';
  const publisherPattern = /^ca-pub-\d{16}$/;
  const slotPattern = /^\d{1,20}$/;
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
  function liveConfig(value, hostname, protocol) {
    const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
    if (protocol !== 'https:' || !host.endsWith('.netlify.app') && !host.endsWith('.onrender.com')) return null;
    if (host.endsWith('.netlify.app') && host.split('.')[0].includes('--')) return null;
    if (hostMode(host) !== 'preview' || !value || value.enabled !== true || !publisherPattern.test(value.publisherId || '')) return null;
    const hosts = Array.isArray(value.hosts) ? value.hosts.map(item => String(item).toLowerCase().replace(/\.$/, '')) : [];
    if (!hosts.includes(host) || !slotPattern.test(value.slots?.home || '') || !slotPattern.test(value.slots?.games || '')) return null;
    return { publisherId: value.publisherId, slots: { home: value.slots.home, games: value.slots.games } };
  }
  function create(win) {
    const doc = win.document, allowed = hostMode(win.location.hostname) === 'preview';
    const config = liveConfig(win.FLUX_ADSENSE, win.location.hostname, win.location.protocol);
    const read = () => { try { return preference(win.localStorage.getItem(storageKey)); } catch (_) { return true; } };
    const urlOptOut = () => new URLSearchParams(win.location.search || '').get('flux-ads') === 'off';
    let requested = !urlOptOut() && read(), started = false, scriptRequested = false, failed = false;
    const mounted = new Set();
    function loadVisible() {
      if (!config || !requested || failed || doc.hidden) return;
      doc.querySelectorAll('[data-ad-preview]').forEach(slot => {
        if (slot.hidden || mounted.has(slot)) return;
        const slotId = config.slots[slot.dataset.adPlacement];
        const box = slot.getBoundingClientRect();
        if (!slotId || box.width <= 0 || box.height <= 0 || box.bottom <= 0 || box.top >= win.innerHeight) return;
        const unit = doc.createElement('ins');
        unit.className = 'adsbygoogle flux-ad-unit';
        unit.style.display = 'block'; unit.style.width = '100%';
        unit.setAttribute('data-ad-client', config.publisherId);
        unit.setAttribute('data-ad-slot', slotId);
        unit.setAttribute('data-ad-format', 'horizontal');
        unit.setAttribute('data-full-width-responsive', 'false');
        slot.append(unit); mounted.add(slot);
        if (!scriptRequested) {
          scriptRequested = true;
          const script = doc.createElement('script');
          script.async = true; script.crossOrigin = 'anonymous';
          script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + config.publisherId;
          script.addEventListener('error', () => {
            failed = true;
            // The provider failed to load, so no ad content is being hidden.
            mounted.forEach(item => { item.hidden = true; });
          }, { once: true });
          doc.head.append(script);
        }
        try { (win.adsbygoogle = win.adsbygoogle || []).push({}); }
        catch (_) { /* A blocked provider must not interrupt Flux navigation. */ }
      });
    }
    function render() {
      const visible = allowed && requested;
      doc.documentElement.classList.toggle('flux-ad-previews', visible);
      doc.documentElement.classList.toggle('flux-ad-live', !!config);
      doc.querySelectorAll('[data-ad-preview]').forEach(slot => { slot.hidden = !visible; });
      const toggle = doc.getElementById('set-ad-previews'), note = doc.getElementById('ad-previews-description');
      if (toggle) { toggle.checked = visible; toggle.disabled = !allowed; }
      if (note) note.textContent = allowed
        ? config ? 'Show banner advertisements on Home and Games. Changing this setting may reload the page.'
          : 'Preview ad spaces on Home and Games. Real advertisements are not connected.'
        : 'This address stays ad-free. Advertisement previews are hidden.';
    }
    function applyPreference(value) {
      requested = !!value;
      if (!requested && scriptRequested) {
        // Unload the document before removing a live ad; the next load skips the provider.
        if (read() === false) win.location.reload();
        else {
          const address = new URL(win.location.href);
          address.searchParams.set('flux-ads', 'off'); win.location.replace(address.href);
        }
        return;
      }
      if (requested && urlOptOut()) {
        const address = new URL(win.location.href);
        address.searchParams.delete('flux-ads'); win.location.replace(address.href); return;
      }
      render(); loadVisible();
    }
    function setEnabled(value) {
      try { win.localStorage.setItem(storageKey, JSON.stringify({ enabled: !!value })); } catch (_) {}
      applyPreference(value);
    }
    function bind() {
      doc.getElementById('set-ad-previews')?.addEventListener('change', event => setEnabled(event.target.checked));
      render();
      if (config) {
        if (typeof win.IntersectionObserver === 'function') {
          const observer = new win.IntersectionObserver(loadVisible);
          doc.querySelectorAll('[data-ad-preview]').forEach(slot => observer.observe(slot));
        } else {
          win.addEventListener('resize', loadVisible, { passive: true });
          doc.addEventListener('scroll', loadVisible, { capture: true, passive: true });
        }
        win.addEventListener('flux-page-changed', loadVisible);
        doc.addEventListener('visibilitychange', loadVisible);
        loadVisible();
      }
    }
    function start() {
      if (started) return; started = true; render();
      if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
      win.addEventListener('storage', event => {
        if (event.key !== storageKey && event.key !== null) return;
        applyPreference(!urlOptOut() && (event.key === null ? true : preference(event.newValue)));
      });
    }
    return { start, setEnabled, isEnabled: () => allowed && requested };
  }
  return { create, hostMode, liveConfig };
});
