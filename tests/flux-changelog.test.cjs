const test = require('node:test');
const assert = require('node:assert/strict');
const { changelogData } = require('../changelogData.js');
const changelog = require('../js/flux-changelog.js');

test('all historical releases keep their versions and use grouped notes', () => {
  assert.deepEqual(changelogData.map(entry => entry.v), ['3.4.0','3.3.0','3.2.0','3.1.0','3.0.0','2.0.1','2.0.0','1.0.3','1.0.2','1.0.1','1.0.0']);
  for (const entry of changelogData) {
    assert.ok(entry.sections.length > 0, entry.v);
    assert.equal(entry.large, undefined);
    assert.ok(entry.sections.every(section => section.title && section.items.length > 0));
  }
});

test('legacy and editor notes get the same sections without losing change lines', () => {
  assert.deepEqual(changelog.sections({ large: 'New Features\n\n- Added a theme shop\n- Added accounts\n\nFixed Bugs\n\nFixed loading' }), [
    { title: 'New Features', items: ['Added a theme shop', 'Added accounts'] },
    { title: 'Fixed Bugs', items: ['Fixed loading'] }
  ]);
  assert.deepEqual(changelog.parseNotes('Made most of the UI look like frosted glass.'), [
    { title: 'Highlights', items: ['Made most of the UI look like frosted glass.'] }
  ]);
  assert.deepEqual(changelog.parseNotes(''), []);
});

test('structured notes win over legacy text and empty groups fall back safely', () => {
  const entry = { sections: [{ title: 'Games', items: ['Six recommendations', '', null] }], large: 'Outdated notes' };
  assert.deepEqual(changelog.sections(entry), [{ title: 'Games', items: ['Six recommendations'] }]);
  assert.deepEqual(changelog.sections({ sections: [], large: 'Fixed saving.' }), [{ title: 'Highlights', items: ['Fixed saving.'] }]);
});

test('release notes render as text with the same layout for old and new releases', () => {
  const element = tag => ({ tag, children: [], append(...items) { this.children.push(...items); } });
  const doc = { createElement: element, createDocumentFragment: () => element('fragment') };
  const target = { replaceChildren(fragment) { this.children = fragment.children; } };
  changelog.render(doc, target, [
    { v: '2', name: '<script>bad()</script>', mini: '<img>', sections: [{ title: 'New', items: ['<svg onload="bad()">'] }] },
    { v: '1', name: 'Old', mini: 'Earlier', large: 'Added games.' }
  ]);
  assert.equal(target.children.length, 2);
  const [latest, old] = target.children;
  assert.equal(latest.children[0].children[0].children[1].textContent, '<script>bad()</script>');
  assert.equal(latest.children[1].className, old.children[1].className);
  assert.equal(latest.children[1].children[0].children[1].children[0].textContent, '<svg onload="bad()">');
});
