const test = require('node:test');
const assert = require('node:assert/strict');
const onboarding = require('../js/flux-onboarding.js');
const layout = require('../js/flux-layout.js');

function fixture({ saved = {}, signedIn = false, loaderVisible = false } = {}) {
  const records = new Map(Object.entries(saved).map(([key, value]) => [key, JSON.stringify(value)]));
  const events = {}, nodes = {}, panels = [], steps = [], layouts = [];
  let preferences = layout.normalize(), themeApplications = 0;
  const doc = { readyState: 'complete', activeElement: null };
  function element() {
    const listeners = {}, attributes = {}, classes = new Set();
    return {
      children: [], dataset: {}, hidden: false, value: '', textContent: '', open: false, scrollTop: 0,
      style: { properties: {}, setProperty(name, value) { this.properties[name] = value; } },
      classList: { toggle(name, value) { if (value) classes.add(name); else classes.delete(name); } },
      setAttribute(name, value) { attributes[name] = value; }, removeAttribute(name) { delete attributes[name]; }, getAttribute(name) { return attributes[name]; },
      append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; },
      addEventListener(name, fn) { listeners[name] = fn; }, dispatch(name, event = {}) { listeners[name]?.(event); },
      focus() { doc.activeElement = this; }, showModal() { this.open = true; }, close() { this.open = false; },
      querySelector() { return nodes.body; }
    };
  }
  for (const id of ['flux-onboarding', 'onboarding-account-options', 'onboarding-signed-in', 'onboarding-account-name', 'onboarding-description', 'onboarding-accent', 'onboarding-background', 'onboarding-cards', 'onboarding-title', 'onboarding-step-count', 'onboarding-announcement', 'onboarding-back', 'onboarding-next', 'onboarding-themes', 'onboarding-skip', 'onboarding-guest', 'onboarding-finish', 'onboarding-signin', 'open-onboarding', 'loader-overlay', 'set-accent', 'set-bg', 'set-card-bg', 'set-border', 'set-text', 'flux-auth-email', 'btn-dashboard', 'main', 'body']) nodes[id] = element();
  for (let i = 0; i < 3; i++) { const panel = element(), step = element(); panel.dataset.onboardingPanel = String(i); step.dataset.onboardingStep = String(i); panels.push(panel); steps.push(step); }
  for (const mode of ['vertical', 'horizontal']) { const button = element(); button.dataset.onboardingLayout = mode; layouts.push(button); }
  doc.getElementById = id => nodes[id] || null;
  doc.createElement = element;
  doc.createTextNode = text => ({ textContent: text });
  doc.querySelector = () => nodes.main;
  doc.querySelectorAll = selector => ({ '[data-onboarding-theme]': nodes['onboarding-themes'].children, '[data-onboarding-panel]': panels, '[data-onboarding-step]': steps, '[data-onboarding-layout]': layouts })[selector] || [];
  const win = {
    document: doc, fluxAuthState: signedIn ? { status: 'signed-in', name: 'Coral', uid: 'existing-user' } : { status: 'signed-out' },
    localStorage: { getItem: key => records.get(key) || null, setItem: (key, value) => records.set(key, value) },
    addEventListener: (name, fn) => { events[name] = fn; },
    getComputedStyle: () => ({ display: loaderVisible ? 'flex' : 'none' }),
    MutationObserver: class { constructor(callback) { win.loaderChanged = callback; } observe() {} disconnect() {} },
    fluxLayout: { getPreferences: () => preferences, setPreferences: value => { preferences = layout.normalize(value); } },
    showPage: page => { win.page = page; },
    applyThemeColors() {
      themeApplications++;
      const config = JSON.parse(records.get('flux_config') || '{}');
      for (const [id, key] of [['set-accent', 'accent'], ['set-bg', 'bg'], ['set-card-bg', 'cardBg'], ['set-border', 'borderColor'], ['set-text', 'textColor']]) config[key] = nodes[id].value;
      records.set('flux_config', JSON.stringify(config));
    }
  };
  const controller = onboarding.create(win); controller.start();
  return { win, doc, nodes, panels, layouts, records, controller, applications: () => themeApplications,
    palette: id => nodes['onboarding-themes'].children.find(button => button.dataset.onboardingTheme === id),
    releaseLoader() { loaderVisible = false; win.loaderChanged(); } };
}

test('first visit waits for the loader, remembers dismissal, and can be reopened from Settings', () => {
  const ui = fixture({ loaderVisible: true });
  assert.equal(ui.nodes['flux-onboarding'].open, false);
  ui.releaseLoader(); assert.equal(ui.nodes['flux-onboarding'].open, true);
  ui.nodes['onboarding-skip'].dispatch('click');
  assert.equal(onboarding.isComplete(ui.win.localStorage), true);
  const returning = fixture({ saved: { [onboarding.storageKey]: JSON.parse(ui.records.get(onboarding.storageKey)) } });
  assert.equal(returning.nodes['flux-onboarding'].open, false);
  returning.nodes['open-onboarding'].dispatch('click');
  assert.equal(returning.nodes['flux-onboarding'].open, true);
});

test('guest completion applies selected colors and layout while leaving authentication unchanged', () => {
  const ui = fixture({ saved: { flux_config: { uiScale: '110', panic: 'Escape' } } });
  ui.palette('ocean').dispatch('click');
  ui.nodes['onboarding-next'].dispatch('click');
  ui.layouts[1].dispatch('click');
  ui.nodes['onboarding-next'].dispatch('click');
  assert.equal(ui.panels[2].hidden, false);
  ui.nodes['onboarding-guest'].dispatch('click');
  assert.equal(ui.applications(), 1);
  const config = JSON.parse(ui.records.get('flux_config'));
  assert.equal(config.accent, '#38bdf8'); assert.equal(config.uiScale, '110'); assert.equal(config.panic, 'Escape');
  assert.equal(ui.win.fluxLayout.getPreferences().navigation, 'horizontal');
  assert.equal(ui.win.fluxAuthState.status, 'signed-out'); assert.equal(ui.win.page, 'dashboard');
  assert.equal(JSON.parse(ui.records.get(onboarding.storageKey)).mode, 'guest');
  assert.equal(ui.nodes['flux-onboarding'].open, false);
});

test('sign-in choice opens the existing account page and focuses its email field', () => {
  const ui = fixture();
  ui.nodes['onboarding-next'].dispatch('click'); ui.nodes['onboarding-next'].dispatch('click');
  ui.nodes['onboarding-signin'].dispatch('click');
  assert.equal(ui.win.page, 'account');
  assert.equal(ui.doc.activeElement, ui.nodes['flux-auth-email']);
  assert.equal(JSON.parse(ui.records.get(onboarding.storageKey)).mode, 'account');
  assert.equal(ui.win.fluxAuthState.status, 'signed-out');
});

test('going back retains choices, and Escape discards staged changes', () => {
  const initial = { accent: '#22c55e', bg: '#070709' };
  const ui = fixture({ saved: { flux_config: initial } });
  ui.palette('rose').dispatch('click');
  ui.nodes['onboarding-next'].dispatch('click'); ui.nodes['onboarding-back'].dispatch('click');
  assert.equal(ui.nodes['onboarding-accent'].value, '#fb7185');
  let prevented = false;
  ui.nodes['flux-onboarding'].dispatch('cancel', { preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(ui.applications(), 0);
  assert.deepEqual(JSON.parse(ui.records.get('flux_config')), initial);
  assert.equal(ui.nodes['flux-onboarding'].open, false);
});

test('an existing account stays connected and gets the signed-in finish screen', () => {
  const ui = fixture({ signedIn: true });
  ui.nodes['onboarding-next'].dispatch('click'); ui.nodes['onboarding-next'].dispatch('click');
  assert.equal(ui.nodes['onboarding-account-options'].hidden, true);
  assert.equal(ui.nodes['onboarding-signed-in'].hidden, false);
  ui.nodes['onboarding-finish'].dispatch('click');
  assert.equal(ui.win.fluxAuthState.uid, 'existing-user');
  assert.equal(JSON.parse(ui.records.get(onboarding.storageKey)).mode, 'signed-in');
});

test('custom colors accept valid hex values and reject malformed saved colors', () => {
  assert.equal(onboarding.normalizeTheme({ accent: 'url(https://example.com)' }).accent, '#22c55e');
  assert.equal(onboarding.normalizeTheme({ accent: '#ABC123' }).accent, '#abc123');
  const ui = fixture();
  assert.equal(ui.nodes['flux-onboarding'].style.properties['--onboarding-on-accent'], '#000000');
  ui.nodes['onboarding-accent'].dispatch('input', { target: { value: '#123abc' } });
  assert.equal(ui.nodes['flux-onboarding'].style.properties['--onboarding-on-accent'], '#ffffff');
  ui.nodes['onboarding-next'].dispatch('click'); ui.nodes['onboarding-next'].dispatch('click');
  ui.nodes['onboarding-guest'].dispatch('click');
  assert.equal(JSON.parse(ui.records.get('flux_config')).accent, '#123abc');
});
