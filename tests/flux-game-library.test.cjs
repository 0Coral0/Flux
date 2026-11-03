const test = require('node:test');
const assert = require('node:assert/strict');
const games = require('../js/flux-game-library.js');

test('alphabetical display order is case-insensitive and leaves catalog chronology intact', () => {
  const catalog = ['Zebra', 'Alpha 10', 'beta', 'Alpha 2', 'alpha'].map((name, index) => ({ name, file: 'g' + index }));
  const originalOrder = catalog.map(game => game.name);
  assert.deepEqual(games.alphabetical(catalog).map(game => game.name), ['alpha', 'Alpha 2', 'Alpha 10', 'beta', 'Zebra']);
  assert.deepEqual(catalog.map(game => game.name), originalOrder);
});

test('recommendations contain six distinct playable games and exclude the current game', () => {
  const catalog = Array.from({ length: 12 }, (_, index) => ({ name: 'Game ' + index, file: 'Games/g' + index + '.html' }));
  catalog.push({ name: 'Duplicate path', file: 'Games\\g2.html' }, { name: 'Missing URL' }, null);
  const picks = games.recommendations(catalog, { url: 'Games/g0.html', name: 'Game 1' }, 6, () => 0);
  assert.equal(picks.length, 6);
  assert.equal(new Set(picks.map(game => game.file.replaceAll('\\', '/'))).size, 6);
  assert.ok(picks.every(game => game.name !== 'Game 1' && game.file !== 'Games/g0.html'));
  assert.equal(catalog[0].name, 'Game 0');
});

test('fresh random draws change the picks without sorting the original catalog', () => {
  const catalog = Array.from({ length: 12 }, (_, index) => ({ name: 'Game ' + index, file: 'g' + index }));
  const first = games.recommendations(catalog, { name: 'Game 0' }, 6, () => 0);
  const second = games.recommendations(catalog, { name: 'Game 0' }, 6, () => .99999);
  assert.notDeepEqual(first.map(game => game.name), second.map(game => game.name));
  assert.deepEqual(catalog.map(game => game.file), Array.from({ length: 12 }, (_, index) => 'g' + index));
  assert.equal(games.recommendations(catalog.slice(0, 3), { name: 'Game 0' }).length, 2);
});

test('the recommendation renderer creates six keyboard-accessible cards that open their selected game', () => {
  let opened;
  const grid = { children: [], replaceChildren(...children) { this.children = children; } };
  const document = { getElementById: () => grid, createElement(tag) {
    return { tag, children: [], dataset: {}, attributes: {}, handlers: {},
      setAttribute(key, value) { this.attributes[key] = value; }, append(...children) { this.children.push(...children); },
      addEventListener(key, handler) { this.handlers[key] = handler; } };
  } };
  const catalog = Array.from({ length: 10 }, (_, index) => ({ name: 'Game ' + index, file: 'g' + index, description: 'Description ' + index }));
  games.renderRecommendations(document, catalog, { name: 'Game 0' }, (...args) => { opened = args; });
  assert.equal(grid.children.length, 6);
  assert.ok(grid.children.every(card => card.tag === 'button' && card.attributes['aria-label'].startsWith('Play ')));
  const card = grid.children[0], selected = catalog.find(game => game.name === card.dataset.game);
  card.handlers.click();
  assert.deepEqual(opened, [selected.file, selected.name, selected.description]);
});
