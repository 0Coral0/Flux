(function (root, factory) {
  const api = factory(typeof module !== 'undefined' && module.exports ? require('./flux-theme-core.js') : root.FluxThemes);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root?.document) { root.fluxOnboarding = api.create(root); root.fluxOnboarding.start(); }
})(typeof window === 'undefined' ? null : window, function (themes) {
  'use strict';
  const storageKey = 'flux_onboarding_v1';
  const presets = themes.presets;
  const read = (storage, key) => { try { return JSON.parse(storage.getItem(key) || 'null'); } catch (_) { return null; } };
  const normalizeTheme = themes.withDefaults;
  const isComplete = storage => read(storage, storageKey)?.completed === true;

  function create(win) {
    const doc = win.document, el = id => doc.getElementById(id);
    const dialog = el('flux-onboarding');
    let step = 0, theme = normalizeTheme(null), navigation = 'vertical', observer;
    const titles = ['A little more you.', 'Find your flow.', 'Ready when you are.'];
    const descriptions = ['Pick a palette for your corner of the internet.', 'Choose where your pages live. You can change this any time.', 'Set up an account, or jump straight into games as a guest.'];
    function updateAccount() {
      const signedIn = win.fluxAuthState?.status === 'signed-in';
      el('onboarding-account-options').hidden = signedIn;
      el('onboarding-signed-in').hidden = !signedIn;
      el('onboarding-account-name').textContent = signedIn ? `You're signed in as ${win.fluxAuthState.name || 'Gamer'}.` : '';
      if (step === 2) el('onboarding-description').textContent = signedIn ? 'Your account is already connected. Your space is ready.' : descriptions[2];
    }
    function previewTheme() {
      themes.applyTo(dialog, theme);
      dialog.style.setProperty('--onboarding-on-accent', themes.tokens(theme)['--on-accent']);
      for (const [id, key] of [['onboarding-accent', 'accent'], ['onboarding-background', 'bg'], ['onboarding-cards', 'cardBg']]) el(id).value = theme[key];
      doc.querySelectorAll('[data-onboarding-theme]').forEach(button => {
        const preset = presets.find(item => item.id === button.dataset.onboardingTheme);
        button.setAttribute('aria-pressed', String(Object.keys(theme).every(key => theme[key] === preset[key])));
      });
    }
    function renderStep(focus = false) {
      doc.querySelectorAll('[data-onboarding-panel]').forEach(panel => { panel.hidden = Number(panel.dataset.onboardingPanel) !== step; });
      doc.querySelectorAll('[data-onboarding-step]').forEach(item => {
        const index = Number(item.dataset.onboardingStep);
        if (index === step) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
        item.classList.toggle('is-complete', index < step);
      });
      const heading = el('onboarding-title'); heading.replaceChildren(doc.createTextNode(titles[step].slice(0, -1)));
      const period = doc.createElement('span'); period.textContent = '.'; heading.append(period);
      el('onboarding-description').textContent = descriptions[step];
      el('onboarding-step-count').textContent = `Step ${step + 1} of 3`;
      el('onboarding-announcement').textContent = `Step ${step + 1} of 3. ${titles[step]}`;
      el('onboarding-back').hidden = step === 0;
      el('onboarding-next').hidden = step === 2;
      doc.querySelectorAll('[data-onboarding-layout]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.onboardingLayout === navigation)));
      updateAccount();
      if (focus) { el('onboarding-title').focus(); dialog.querySelector('.onboarding-body').scrollTop = 0; }
    }
    function open() {
      if (!dialog || dialog.open) return;
      observer?.disconnect();
      const saved = read(win.localStorage, 'flux_config') || {};
      theme = normalizeTheme(saved);
      navigation = win.fluxLayout?.getPreferences().navigation === 'horizontal' ? 'horizontal' : 'vertical';
      step = 0; previewTheme(); renderStep(); dialog.showModal(); el('onboarding-title').focus();
    }
    function remember(mode) {
      try { win.localStorage.setItem(storageKey, JSON.stringify({ completed: true, mode, version: 1 })); } catch (_) { /* Setup can still finish when storage is unavailable. */ }
    }
    function dismiss() { observer?.disconnect(); remember('skipped'); dialog.close(); }
    function finish(destination) {
      for (const [id, key] of [['set-accent', 'accent'], ['set-bg', 'bg'], ['set-card-bg', 'cardBg'], ['set-border', 'borderColor'], ['set-text', 'textColor']]) {
        const control = el(id); if (control) control.value = theme[key];
      }
      try { win.applyThemeColors(); } catch (_) { /* The current theme still works if local saving is unavailable. */ }
      win.fluxLayout?.setPreferences({ ...win.fluxLayout.getPreferences(), navigation });
      remember(destination === 'account' ? 'account' : win.fluxAuthState?.status === 'signed-in' ? 'signed-in' : 'guest');
      dialog.close();
      win.showPage(destination === 'account' ? 'account' : 'dashboard');
      const main = doc.querySelector('main'); if (main) main.scrollTop = 0;
      (destination === 'account' ? el('flux-auth-email') : el('btn-dashboard'))?.focus();
    }
    function start() {
      if (!dialog) return;
      const options = el('onboarding-themes');
      for (const preset of presets) {
        const button = doc.createElement('button'); button.type = 'button'; button.className = 'onboarding-theme'; button.dataset.onboardingTheme = preset.id;
        button.setAttribute('aria-pressed', 'false');
        const swatches = doc.createElement('span'); swatches.className = 'onboarding-theme-swatches'; swatches.setAttribute('aria-hidden', 'true');
        for (const color of [preset.accent, preset.bg, preset.cardBg]) { const swatch = doc.createElement('i'); swatch.style.backgroundColor = color; swatches.append(swatch); }
        const label = doc.createElement('span'); label.textContent = preset.name; button.append(swatches, label);
        button.addEventListener('click', () => { theme = normalizeTheme(preset); previewTheme(); }); options.append(button);
      }
      for (const [id, key] of [['onboarding-accent', 'accent'], ['onboarding-background', 'bg'], ['onboarding-cards', 'cardBg']]) el(id).addEventListener('input', event => { theme = normalizeTheme({ ...theme, [key]: event.target.value }); previewTheme(); });
      doc.querySelectorAll('[data-onboarding-layout]').forEach(button => button.addEventListener('click', () => { navigation = button.dataset.onboardingLayout === 'horizontal' ? 'horizontal' : 'vertical'; renderStep(); }));
      el('onboarding-next').addEventListener('click', () => { step = Math.min(2, step + 1); renderStep(true); });
      el('onboarding-back').addEventListener('click', () => { step = Math.max(0, step - 1); renderStep(true); });
      el('onboarding-skip').addEventListener('click', dismiss);
      dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
      el('onboarding-guest').addEventListener('click', () => finish('dashboard'));
      el('onboarding-finish').addEventListener('click', () => finish('dashboard'));
      el('onboarding-signin').addEventListener('click', () => finish('account'));
      el('open-onboarding')?.addEventListener('click', open);
      win.addEventListener('flux-auth-changed', updateAccount);
      function firstVisit() {
        if (isComplete(win.localStorage)) return;
        if (win.fluxGameLinks?.hasInitialGame()) { win.addEventListener('flux-player-closed', () => { if (!isComplete(win.localStorage)) open(); }, { once: true }); return; }
        const loader = el('loader-overlay');
        if (!loader || win.getComputedStyle(loader).display === 'none') { open(); return; }
        observer = new win.MutationObserver(() => { if (win.getComputedStyle(loader).display === 'none') { observer.disconnect(); if (!isComplete(win.localStorage)) open(); } });
        observer.observe(loader, { attributes: true, attributeFilter: ['style'] });
      }
      if (doc.readyState === 'complete') firstVisit(); else win.addEventListener('load', firstVisit, { once: true });
    }
    return { start, open };
  }
  return { create, presets, normalizeTheme, isComplete, storageKey };
});
