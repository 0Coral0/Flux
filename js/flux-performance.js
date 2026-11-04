(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root?.document) { root.fluxPerformance = api.create(root); root.fluxPerformance.start(); }
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const storageKey = 'flux_config';
  function parse(value) {
    try { const config = JSON.parse(value || '{}'); return config && typeof config === 'object' && !Array.isArray(config) ? config : {}; }
    catch (_) { return {}; }
  }
  function create(win) {
    const doc = win.document;
    const read = () => { try { return parse(win.localStorage.getItem(storageKey)); } catch (_) { return {}; } };
    let enabled = read().liteMode === true, started = false, particleController = null, particlePreference;
    function apply(config, value) {
      const changed = enabled !== value;
      enabled = value;
      doc.documentElement.classList.toggle('flux-lite-mode', enabled);
      const toggle = doc.getElementById('set-lite-mode'), particles = doc.getElementById('set-particles');
      const note = doc.getElementById('particle-settings-note');
      if (toggle) toggle.checked = enabled;
      const preferredParticles = config.particlesEnabled !== false;
      if (particles) { particles.disabled = enabled; particles.checked = preferredParticles; }
      if (note) note.textContent = enabled ? 'Paused while Lite Mode is on. Your usual setting will return when you turn it off.' : 'Enable or disable animated gray grid particles.';
      if (win.fluxParticles) {
        if (changed || particleController !== win.fluxParticles) win.fluxParticles.setLiteMode(enabled);
        if (particleController !== win.fluxParticles || particlePreference !== preferredParticles) win.fluxParticles.setEnabled(preferredParticles);
        particleController = win.fluxParticles; particlePreference = preferredParticles;
      }
      if (changed && typeof win.CustomEvent === 'function') win.dispatchEvent(new win.CustomEvent('flux-performance-changed', { detail: { liteMode: enabled } }));
    }
    function setEnabled(value) {
      const config = { ...read(), liteMode: !!value };
      try { win.localStorage.setItem(storageKey, JSON.stringify(config)); } catch (_) {}
      apply(config, config.liteMode);
    }
    function bind() {
      const toggle = doc.getElementById('set-lite-mode');
      toggle?.addEventListener('change', () => setEnabled(toggle.checked));
      const config = read(); apply(config, enabled);
    }
    return {
      isEnabled: () => enabled,
      allowsParticles: () => !enabled && read().particlesEnabled !== false,
      setEnabled,
      start() {
        if (started) return;
        started = true; apply(read(), enabled);
        if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', bind, { once: true });
        else bind();
        win.addEventListener('storage', event => {
          if (event.key !== storageKey && event.key !== null) return;
          const config = event.key === null ? {} : parse(event.newValue);
          apply(config, config.liteMode === true);
        });
      }
    };
  }
  return { create };
});
