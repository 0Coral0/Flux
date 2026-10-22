const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { listUnusedGameAssets, normalizePath, unusedPaths } = require('../admin-library-files');

test('asset matching normalizes Windows-style paths and excludes used entries', () => {
  const games = [{ file: 'Games/Used.HTML', thumb: 'Game Images/Used.PNG' }];
  assert.equal(normalizePath('.\\Games\\Used.HTML'), 'games/used.html');
  assert.deepEqual(unusedPaths(['Games/Used.html', 'Games/Fresh.html'], games, 'file'), ['Games/Fresh.html']);
  assert.deepEqual(unusedPaths(['Game Images/used.png', 'Game Images/fresh.webp'], games, 'thumb'), ['Game Images/fresh.webp']);
});

test('the Flux library scanner returns only unused HTML games and image files', () => {
  const assets = listUnusedGameAssets(path.join(__dirname, '..'));
  assert.ok(assets.totals.gameFiles >= assets.gameFiles.length);
  assert.ok(assets.totals.multifileGameFiles >= assets.multifileGameFiles.length);
  assert.ok(assets.totals.images >= assets.images.length);
  assert.ok(assets.gameFiles.every(file => /^Games\/.+\.html?$/i.test(file)));
  assert.ok(assets.multifileGameFiles.every(file => /^MultiFile Games\/.+\.html?$/i.test(file)));
  assert.ok(assets.images.every(file => /^Game Images\/.+\.(png|jpe?g|webp|gif|svg|avif|bmp|ico|tiff?)$/i.test(file)));
});

test('admin game form uses controlled dropdowns backed by the desktop file scanner', () => {
  const html = require('node:fs').readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
  assert.match(html, /<select id="game-file" disabled>/);
  assert.match(html, /<select id="game-thumb" disabled>/);
  assert.match(html, /refreshGameAssetDropdowns/);
  assert.match(html, /btn-refresh-game-assets/);
  assert.match(html, /id="game-multifile"/);
  assert.match(html, /multifileGameFiles/);
});

test('admin uses Firebase Auth with a remembered Electron session instead of embedded credentials', () => {
  const html = require('node:fs').readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
  assert.match(html, /id="admin-auth-form"/);
  assert.match(html, /firebase-auth\.js/);
  assert.match(html, /signInWithEmailAndPassword/);
  assert.match(html, /onAuthStateChanged/);
  assert.match(html, /Electron remembers the session on later launches/);
});
