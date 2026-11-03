/* Restore the same palette before any Flux page is painted. */
(function () {
  'use strict';
  let config = {};
  try { config = JSON.parse(localStorage.getItem('flux_config') || '{}') || {}; } catch (_) {}
  window.FluxThemes.applyTo(document.documentElement, config);
  window.addEventListener('storage', event => {
    if (event.key !== 'flux_config') return;
    let saved = {};
    try { saved = JSON.parse(event.newValue || '{}') || {}; } catch (_) {}
    window.FluxThemes.applyTo(document.documentElement, saved);
    const theme = window.FluxThemes.withDefaults(saved);
    for (const [id, field] of [['set-accent', 'accent'], ['set-bg', 'bg'], ['set-card-bg', 'cardBg'], ['set-border', 'borderColor'], ['set-text', 'textColor']]) {
      const input = document.getElementById(id);
      if (input) input.value = theme[field];
    }
  });
})();
