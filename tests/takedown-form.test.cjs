const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => readFileSync(path.join(root, file), 'utf8');

test('takedown form collects ownership details and sends only through a configured inbox', () => {
  const html = read('takedown.html');
  const config = read('js/takedown-config.js');
  for (const field of ['name', 'email', 'role', 'title', 'flux-url', 'source-url', 'reason', 'signature']) {
    assert.match(html, new RegExp(`id=\\"${field}\\"`));
  }
  assert.match(html, /id=\"authority\" type=\"checkbox\" required/);
  assert.match(html, /id=\"accuracy\" type=\"checkbox\" required/);
  assert.match(html, /FLUX_TAKEDOWN_EMAIL/);
  assert.match(html, /mailto:/);
  assert.match(config, /window\.FLUX_TAKEDOWN_EMAIL\s*=\s*['"][^'"]*['"]/);
  assert.doesNotMatch(html, /addDoc\(|fetch\(/);
});

test('Flux links to the takedown request form', () => {
  const html = read('index.html');
  assert.match(html, /href=\"takedown\.html\"/);
  assert.match(html, /<footer class=\"flux-footer\"/);
  assert.match(html, /Copyright takedown/);
});
