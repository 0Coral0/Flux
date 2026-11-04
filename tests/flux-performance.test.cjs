const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../js/flux-performance.js');

function fixture(config = {}, { loading = false, denied = false } = {}) {
  const records = new Map([['flux_config', JSON.stringify(config)]]), events = {}, docEvents = {}, classes = new Set(), calls = [];
  let writes = 0;
  const control = () => ({ checked: false, disabled: false, listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; } });
  const nodes = { 'set-lite-mode': control(), 'set-particles': control(), 'particle-settings-note': { textContent: '' } };
  const doc = { readyState: loading ? 'loading' : 'complete',
    documentElement: { classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); } } },
    getElementById: id => loading ? null : nodes[id], addEventListener: (name, fn) => { docEvents[name] = fn; } };
  const win = { document: doc,
    localStorage: { getItem(key) { if (denied) throw Error('Unavailable'); return records.get(key); },
      setItem(key, value) { if (denied) throw Error('Unavailable'); writes++; records.set(key, value); } },
    fluxParticles: { setLiteMode: value => calls.push(['lite', value]), setEnabled: value => calls.push(['particles', value]) },
    addEventListener: (name, fn) => { events[name] = fn; },
    dispatchEvent: event => calls.push(['event', event.detail.liteMode]),
    CustomEvent: class { constructor(name, value) { this.type = name; this.detail = value.detail; } }
  };
  const controller = create(win); controller.start();
  return { win, nodes, records, classes, calls, controller, writes: () => writes,
    ready() { loading = false; doc.readyState = 'complete'; docEvents.DOMContentLoaded(); },
    toggle(value) { nodes['set-lite-mode'].checked = value; nodes['set-lite-mode'].listeners.change(); },
    storage(value) { const text = typeof value === 'string' ? value : JSON.stringify(value); records.set('flux_config', text); events.storage({ key: 'flux_config', newValue: text }); }
  };
}

test('a saved Lite Mode preference applies before the page controls exist', () => {
  const ui = fixture({ liteMode: true, particlesEnabled: true }, { loading: true });
  assert.equal(ui.classes.has('flux-lite-mode'), true);
  assert.equal(ui.controller.allowsParticles(), false);
  ui.ready();
  assert.equal(ui.nodes['set-lite-mode'].checked, true);
  assert.equal(ui.nodes['set-particles'].disabled, true);
  assert.equal(ui.writes(), 0);
});

test('toggling Lite Mode preserves colors and the normal enabled particle preference', () => {
  const saved = { liteMode: false, particlesEnabled: true, accent: '#fb7185', bg: '#10090d', loaderStyle: 'skeleton', uiScale: '110' };
  const ui = fixture(saved); ui.toggle(true);
  assert.deepEqual(JSON.parse(ui.records.get('flux_config')), { ...saved, liteMode: true });
  assert.equal(ui.nodes['set-particles'].checked, true);
  assert.equal(ui.nodes['set-particles'].disabled, true);
  assert.equal(ui.controller.allowsParticles(), false);
  ui.toggle(false);
  assert.equal(ui.nodes['set-particles'].disabled, false);
  assert.equal(ui.controller.allowsParticles(), true);
  assert.deepEqual(JSON.parse(ui.records.get('flux_config')), saved);
  assert.deepEqual(ui.calls.filter(call => call[0] === 'lite').slice(-2), [['lite', true], ['lite', false]]);
});

test('turning Lite Mode off does not re-enable particles the user had disabled', () => {
  const ui = fixture({ particlesEnabled: false }); ui.toggle(true); ui.toggle(false);
  assert.equal(ui.nodes['set-particles'].checked, false);
  assert.equal(ui.nodes['set-particles'].disabled, false);
  assert.equal(ui.controller.allowsParticles(), false);
  assert.equal(JSON.parse(ui.records.get('flux_config')).particlesEnabled, false);
  assert.ok(ui.calls.filter(call => call[0] === 'particles').every(call => call[1] === false));
});

test('other tabs update the preference and controls without creating a storage write loop', () => {
  const ui = fixture({ particlesEnabled: true });
  ui.storage({ liteMode: true, particlesEnabled: false });
  assert.equal(ui.nodes['set-lite-mode'].checked, true);
  assert.equal(ui.nodes['set-particles'].checked, false);
  assert.equal(ui.nodes['set-particles'].disabled, true);
  ui.storage({ liteMode: false, particlesEnabled: true });
  assert.equal(ui.nodes['set-lite-mode'].checked, false);
  assert.equal(ui.nodes['set-particles'].disabled, false);
  assert.equal(ui.writes(), 0);
  assert.doesNotThrow(() => ui.storage('{bad json'));
});

test('Lite Mode still works for the current page when browser storage is unavailable', () => {
  const ui = fixture({}, { denied: true });
  assert.doesNotThrow(() => ui.toggle(true));
  assert.equal(ui.controller.isEnabled(), true);
  assert.equal(ui.classes.has('flux-lite-mode'), true);
  assert.equal(ui.nodes['set-particles'].disabled, true);
});
