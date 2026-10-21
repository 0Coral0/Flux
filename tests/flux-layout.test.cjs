const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const layout = require('../js/flux-layout.js');
const root = path.join(__dirname, '..');

test('layout preferences accept only supported modes and retain every Flux page once', () => {
  const value = layout.normalize({ navigation: 'horizontal', density: 'compact', order: ['movies', 'movies', 'unknown', 'dashboard'] });
  assert.equal(value.navigation, 'horizontal');
  assert.equal(value.density, 'compact');
  assert.equal(new Set(value.order).size, layout.defaults.order.length);
  assert.deepEqual(value.order.slice(0, 2), ['movies', 'dashboard']);
  assert.deepEqual(layout.normalize({ navigation: 'diagonal', density: 'tiny', order: null }), layout.defaults);
});

test('layout controls and saved interface assets are wired into the Flux shell', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'css/flux-layout.css'), 'utf8');
  assert.match(html, /id="set-nav-layout"/);
  assert.match(html, /id="set-content-density"/);
  assert.match(html, /id="layout-page-order"/);
  assert.match(html, /js\/flux-layout\.js/);
  assert.match(html, /css\/flux-layout\.css/);
  assert.match(css, /flux-nav-horizontal/);
  assert.match(css, /flux-density-compact/);
  assert.match(css, /body\.flux-nav-horizontal #flux-sidebar \.nav-list \.nav-item/);
  assert.match(css, /flex-direction: column/);
});
