const test = require('node:test');
const assert = require('node:assert/strict');
const themes = require('../js/flux-theme-core.js');

test('a palette controls every shared surface and keeps the five saved colors intact', () => {
  const theme = themes.presets.find(item => item.id === 'rose');
  const tokens = themes.tokens(theme);
  assert.equal(tokens['--accent'], theme.accent);
  assert.equal(tokens['--bg'], theme.bg);
  assert.equal(tokens['--surface-card'], theme.cardBg);
  assert.equal(tokens['--border'], theme.borderColor);
  assert.equal(tokens['--text'], theme.textColor);
  assert.equal(tokens['--accent-rgb'], '251, 113, 133');
  assert.notEqual(tokens['--surface'], themes.tokens(themes.presets[0])['--surface']);
  assert.notEqual(tokens['--text-dim'], themes.tokens(themes.presets[0])['--text-dim']);
});

test('light palettes produce light surfaces and adapt browser controls', () => {
  const tokens = themes.tokens({ accent: '#000080', bg: '#ffffff', cardBg: '#f0f0f0', textColor: '#111111', borderColor: '#cccccc' });
  assert.equal(tokens['color-scheme'], 'light');
  assert.equal(tokens['--on-accent'], '#ffffff');
  assert.match(tokens['--surface'], /^#f[0-9a-f]f[0-9a-f]f[0-9a-f]$/);
});

test('accent labels choose readable text for both bright and dark accents', () => {
  assert.equal(themes.tokens({ accent: '#ffffff' })['--on-accent'], '#000000');
  assert.equal(themes.tokens({ accent: '#000000' })['--on-accent'], '#ffffff');
  for (const preset of themes.presets) assert.equal(themes.tokens(preset)['--on-accent'], '#000000');
});

test('invalid stored colors cannot become CSS and scoped previews do not change the page', () => {
  const properties = {};
  const scope = { style: { setProperty: (name, value) => { properties[name] = value; } } };
  themes.applyTo(scope, { accent: 'url(https://example.invalid)', cardBg: 'red; display:none' });
  assert.equal(properties['--accent'], themes.presets[0].accent);
  assert.equal(properties['--surface-card'], themes.presets[0].cardBg);
  assert.equal(properties['color-scheme'], 'dark');
  assert.match(properties['--surface'], /^#[a-f0-9]{6}$/);
});
