const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const themes = require('../js/flux-theme-core.js');
const shop = require('../js/flux-theme-shop.js');
const source = fs.readFileSync(path.join(__dirname, '../js/flux-data-client.js'), 'utf8');
const ocean = themes.normalizeTheme(themes.presets[1]);
const snapshot = (id, data) => ({ id, exists: data !== undefined, data: () => data });

function adapter({ signedIn = true, saved = {} } = {}) {
  const records = new Map(Object.entries(saved)); let clock = 100, writes = 0;
  const store = {
    collection(collection) {
      assert.equal(collection, 'themes');
      return {
        doc(id) { return { id, get: async () => snapshot(id, records.get(id)) }; },
        orderBy(field, direction) {
          assert.equal(field, 'publishedAt'); assert.equal(direction, 'desc');
          let size = 18, after = null;
          const query = {
            limit(value) { size = value; return query; }, startAfter(value) { after = value; return query; },
            async get() {
              let docs = [...records].filter(([, value]) => value.publishedAt).sort((a, b) => b[1].publishedAt.toMillis() - a[1].publishedAt.toMillis()).map(([id, value]) => snapshot(id, value));
              if (after) docs = docs.slice(docs.findIndex(record => record.id === after.id) + 1);
              return { docs: docs.slice(0, size) };
            }
          }; return query;
        }
      };
    },
    async runTransaction(callback) {
      const pending = [];
      await callback({ get: async ref => snapshot(ref.id, records.get(ref.id)), set: (ref, value) => pending.push([ref.id, value]) });
      for (const [id, value] of pending) { records.set(id, value); writes++; }
    }
  };
  const win = {
    FluxThemes: themes, fluxFirebaseDb: store,
    fluxFirebase: { firestore: { FieldValue: { serverTimestamp() { const value = ++clock; return { toMillis: () => value }; } } } },
    fluxAuthState: signedIn ? { status: 'signed-in', uid: 'alice', name: 'Alice', email: 'private@example.test' } : { status: 'signed-out' },
    getProfileData: () => ({ name: 'Alice' })
  };
  vm.runInNewContext(source, { window: win });
  return { win, records, writes: () => writes };
}

test('theme colors validate CSS values and upgrade legacy two-color codes', () => {
  assert.equal(themes.normalizeTheme({ accent: 'url(https://example.test)', bg: '#000000' }), null);
  assert.equal(themes.normalizeTheme({ ...ocean, cardBg: '<script>' }), null);
  const legacy = themes.normalizeTheme({ accent: '#ABC123', bg: '#000000' });
  assert.equal(legacy.accent, '#abc123'); assert.equal(legacy.cardBg, '#14141c');
  assert.throws(() => themes.normalizeCode('../other'), /letters/);
  assert.throws(() => themes.normalizeName(' '), /2–48/);
  assert.equal(themes.normalizeCode(' Night-Sky '), 'night-sky');
});

test('publishing a code stores all colors and public attribution without account email', async () => {
  const api = adapter();
  const result = await api.win.fluxData.publishTheme(' Night-Sky ', 'Night Sky', ocean);
  const stored = api.records.get('night-sky');
  assert.equal(stored.ownerUid, 'alice'); assert.equal(stored.shopName, 'Night Sky');
  assert.deepEqual(stored.theme, ocean); assert.equal(stored.sharedBy, 'Alice');
  assert.equal(result.code, 'night-sky'); assert.equal(result.name, 'Night Sky');
  assert.doesNotMatch(JSON.stringify(stored), /private@example|email|password/);
  assert.ok(stored.publishedAt.toMillis()); assert.equal(api.writes(), 1);
});

test('another account cannot overwrite or rename an owned code', async () => {
  const api = adapter({ saved: { owned: { ownerUid: 'bob', theme: ocean } } });
  await assert.rejects(api.win.fluxData.publishTheme('owned', 'A new name', ocean), /another creator/);
  await assert.rejects(api.win.fluxData.saveTheme('owned', ocean), /another creator/);
  assert.equal(api.writes(), 0); assert.equal(api.records.get('owned').ownerUid, 'bob');
});

test('legacy codes can be published, and later color saves retain publication metadata', async () => {
  const api = adapter({ saved: { legacy: { accent: '#00aa88', bg: '#080808' } } });
  await api.win.fluxData.publishTheme('legacy', 'Old favorite');
  const published = api.records.get('legacy');
  assert.equal(published.ownerUid, 'alice'); assert.equal(published.theme.cardBg, '#14141c');
  await api.win.fluxData.saveTheme('legacy', ocean);
  const edited = api.records.get('legacy');
  assert.equal(edited.shopName, 'Old favorite'); assert.equal(edited.publishedAt, published.publishedAt);
  assert.deepEqual(edited.theme, ocean);
});

test('unsigned visitors can read codes and catalog pages but cannot publish', async () => {
  const api = adapter({ signedIn: false, saved: { one: { ownerUid: 'bob', theme: ocean, shopName: 'One', sharedBy: 'Bob', publishedAt: { toMillis: () => 1 } } } });
  assert.equal((await api.win.fluxData.loadTheme('flux-ocean')).theme.accent, '#38bdf8');
  assert.equal((await api.win.fluxData.listPublishedThemes()).themes.length, 1);
  await assert.rejects(api.win.fluxData.publishTheme('mine', 'My theme', ocean), /Sign in/);
  assert.equal(api.writes(), 0);
});

test('catalog pagination excludes unpublished and malformed records without repeating entries', async () => {
  const api = adapter({ saved: {
    hidden: { theme: ocean },
    first: { theme: ocean, ownerUid: 'bob', shopName: 'First', sharedBy: 'Bob', publishedAt: { toMillis: () => 3 } },
    bad: { theme: { accent: 'red' }, ownerUid: 'bob', shopName: 'Bad', publishedAt: { toMillis: () => 2 } },
    last: { theme: ocean, ownerUid: 'bob', shopName: 'Last', sharedBy: 'Bob', publishedAt: { toMillis: () => 1 } }
  } });
  const first = await api.win.fluxData.listPublishedThemes({ limit: 2 });
  assert.deepEqual(Array.from(first.themes, theme => theme.code), ['first']); assert.equal(first.hasMore, true);
  const last = await api.win.fluxData.listPublishedThemes({ limit: 2, after: first.cursor });
  assert.deepEqual(Array.from(last.themes, theme => theme.code), ['last']); assert.equal(last.hasMore, false);
});

test('reserved originals and malformed colors cannot be written', async () => {
  const api = adapter();
  await assert.rejects(api.win.fluxData.saveTheme('flux-ocean', ocean), /reserved/);
  await assert.rejects(api.win.fluxData.publishTheme('unsafe', 'Unsafe', { accent: 'red', bg: '#000000' }), /valid theme/);
  assert.equal(api.writes(), 0);
});

function uiFixture({ signedIn = true, service = {}, background = { kind: 'none' } } = {}) {
  const nodes = {}, storage = new Map(), events = {}; let applied;
  const doc = { activeElement: null };
  function node() {
    const handlers = {};
    return { children: [], dataset: {}, style: { setProperty() {} }, value: '', textContent: '', hidden: false, disabled: false, open: false,
      attributes: {}, setAttribute(key, value) { this.attributes[key] = value; },
      append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; },
      addEventListener(key, fn) { handlers[key] = fn; }, dispatch(key, event = { preventDefault() {} }) { return handlers[key]?.(event); },
      showModal() { this.open = true; }, close() { this.open = false; }, focus() { doc.activeElement = this; },
      reset() { nodes['theme-publish-code'].value = ''; nodes['theme-publish-name'].value = ''; }, querySelector() { return nodes.codeSubmit; }
    };
  }
  for (const id of ['theme-publish-dialog','theme-shop-status','theme-publish-status','theme-community-grid','theme-shop-more','theme-shop-refresh','theme-shop-search','theme-originals-grid','theme-publish-identity','theme-publish-submit','theme-publish-code','theme-publish-name','theme-publish-preview','theme-publish-current','theme-publish-swatch','theme-publish-form','theme-shop-share','theme-shop-create','theme-publish-close','theme-shop-code-form','theme-shop-code','flux-auth-email','codeSubmit','theme-publish-background','theme-publish-homepage','theme-publish-background-note','theme-publish-media-notice']) nodes[id] = node();
  doc.getElementById = id => nodes[id]; doc.createElement = node;
  const win = { document: doc, navigator: {}, setTimeout, clearTimeout,
    fluxAuthState: signedIn ? { status: 'signed-in', uid: 'alice', name: 'Alice' } : { status: 'signed-out' },
    getProfileData: () => ({ name: 'Alice' }), getCurrentTheme: () => ocean,
    fluxBackgrounds: { getPreferences: () => background, exportForTheme: async () => background },
    fluxHomeEditor: { getPreferences: () => ({order:['recent','welcome','stats','hot'],hidden:['stats'],columns:'4',hero:'compact'}) },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    addEventListener: (key, fn) => { events[key] = fn; }, showPage: page => { win.page = page; },
    applySavedTheme: theme => { applied = theme; return true; },
    fluxData: { loadTheme: async () => ({ theme: ocean }), listPublishedThemes: async () => ({ themes: [], cursor: null, hasMore: false }), publishTheme: async (code, name, theme) => ({ code, name, theme, ownerUid: 'alice', sharedBy: 'Alice' }), ...service }
  };
  const controller = shop.create(win); controller.start();
  return { win, doc, nodes, storage, controller, applied: () => applied };
}

test('the code form lets a guest apply a built-in theme without requesting an account', async () => {
  const ui = uiFixture({ signedIn: false }); ui.nodes['theme-shop-code'].value = 'flux-violet';
  await ui.nodes['theme-shop-code-form'].dispatch('submit');
  assert.equal(ui.applied().accent, '#a78bfa'); assert.equal(ui.win.fluxAuthState.status, 'signed-out');
  assert.equal(ui.win.page, undefined);
});

test('guest publishing opens Profile and never calls the publishing service', async () => {
  let published = false;
  const ui = uiFixture({ signedIn: false, service: { publishTheme: async () => { published = true; } } });
  ui.controller.open(); await ui.nodes['theme-publish-form'].dispatch('submit');
  assert.equal(published, false); assert.equal(ui.win.page, 'account'); assert.equal(ui.doc.activeElement, ui.nodes['flux-auth-email']);
});

test('publishing a previewed code confirms the named listing only after saving succeeds', async () => {
  let sent;
  const ui = uiFixture({ service: { publishTheme: async (code, name, theme) => { sent = { code, name, theme }; return { code, name, theme, sharedBy: 'Alice' }; } } });
  ui.controller.open(); ui.nodes['theme-publish-code'].value = 'my-ocean'; ui.nodes['theme-publish-name'].value = 'My Ocean';
  await ui.nodes['theme-publish-preview'].dispatch('click'); await ui.nodes['theme-publish-form'].dispatch('submit');
  assert.equal(sent.code, 'my-ocean'); assert.equal(sent.name, 'My Ocean'); assert.deepEqual(sent.theme, ocean);
  assert.equal(ui.nodes['theme-publish-dialog'].open, false); assert.match(ui.nodes['theme-shop-status'].textContent, /is shared/);
});

test('changing a code while its preview loads cannot attach the old colors to the new code', async () => {
  let resolve;
  const ui = uiFixture({ service: { loadTheme: () => new Promise(done => { resolve = done; }) } });
  ui.controller.open(); ui.nodes['theme-publish-code'].value = 'first';
  const lookup = ui.nodes['theme-publish-preview'].dispatch('click');
  ui.nodes['theme-publish-code'].value = 'second'; ui.nodes['theme-publish-code'].dispatch('input');
  resolve({ theme: ocean }); await lookup;
  assert.equal(ui.nodes['theme-publish-swatch'].hidden, true);
});

test('offline lookup can use a valid local saved code and failed publishing keeps the dialog open', async () => {
  const ui = uiFixture({ service: { loadTheme: async () => { throw Error('offline'); }, publishTheme: async () => { throw Error('Unable to publish'); } } });
  ui.storage.set('flux_saved_themes', JSON.stringify({ cached: ocean }));
  ui.controller.open(); ui.nodes['theme-publish-code'].value = 'cached'; ui.nodes['theme-publish-name'].value = 'Cached theme';
  await ui.nodes['theme-publish-form'].dispatch('submit');
  assert.equal(ui.nodes['theme-publish-dialog'].open, true); assert.match(ui.nodes['theme-publish-status'].textContent, /Unable to publish/);
  assert.equal(ui.nodes['theme-publish-submit'].disabled, false); assert.doesNotMatch(ui.nodes['theme-shop-status'].textContent, /is shared/);
});

test('the catalog can retry after its data service becomes available', async () => {
  const ui = uiFixture(); ui.win.fluxData = null;
  await ui.controller.load();
  ui.win.fluxData = { listPublishedThemes: async () => ({ themes: [{ code: 'back-online', name: 'Back Online', theme: ocean, sharedBy: 'Alice' }], cursor: null, hasMore: false }) };
  await ui.controller.load(true);
  assert.equal(ui.nodes['theme-community-grid'].children[0].className, 'theme-shop-card');
});

test('publishing a current look includes the chosen background controls and an optional homepage', async () => {
  let sent;
  const background={kind:'url',url:'https://images.example/animated.gif',tint:35,blur:2,fit:'contain'};
  const ui=uiFixture({background,service:{publishTheme:async(code,name,theme)=>{sent=theme;return {code,name,theme,sharedBy:'Alice'};}}});
  ui.controller.open(true);ui.nodes['theme-publish-name'].value='My full look';ui.nodes['theme-publish-homepage'].checked=true;
  assert.equal(ui.nodes['theme-publish-background'].checked,true);
  await ui.nodes['theme-publish-form'].dispatch('submit');
  assert.deepEqual(sent.background,background);assert.equal(sent.homepage.columns,'4');assert.equal(sent.homepage.updatedAt,undefined);
});

test('the creator can explicitly leave background and homepage out of a shared code', async () => {
  let sent;
  const ui=uiFixture({background:{kind:'url',url:'https://images.example/a.gif',tint:50,blur:0,fit:'cover'},service:{publishTheme:async(code,name,theme)=>{sent=theme;return {code,name,theme,sharedBy:'Alice'};}}});
  ui.controller.open(true);ui.nodes['theme-publish-name'].value='Colors only';ui.nodes['theme-publish-background'].checked=false;
  await ui.nodes['theme-publish-form'].dispatch('submit');assert.deepEqual(sent,ocean);
});

test('saving updated colors preserves an already published background and layout', async () => {
  const background={kind:'url',url:'https://images.example/a.gif',tint:50,blur:0,fit:'cover'};
  const api=adapter({saved:{owned:{ownerUid:'alice',theme:{...ocean,background}}}});
  await api.win.fluxData.saveTheme('owned',themes.normalizeTheme(themes.presets[0]));
  assert.deepEqual(api.records.get('owned').theme.background,background);
});

test('a background apply failure is shown and does not falsely confirm the theme', async () => {
  const ui=uiFixture();ui.win.applySavedTheme=async()=>{throw Error('Shared background is unavailable');};
  ui.nodes['theme-shop-code'].value='flux-ocean';await ui.nodes['theme-shop-code-form'].dispatch('submit');
  assert.match(ui.nodes['theme-shop-status'].textContent,/unavailable/);assert.equal(ui.nodes['theme-shop-status'].dataset.error,'true');
});

test('a saved color code can include the current background without replacing its colors', async () => {
  let sent;
  const background={kind:'url',url:'https://images.example/a.gif',tint:45,blur:1,fit:'cover'};
  const ui=uiFixture({background,service:{publishTheme:async(code,name,theme)=>{sent=theme;return {code,name,theme,sharedBy:'Alice'};}}});
  ui.controller.open();ui.nodes['theme-publish-code'].value='saved-colors';ui.nodes['theme-publish-name'].value='Saved look';
  await ui.nodes['theme-publish-preview'].dispatch('click');assert.equal(ui.nodes['theme-publish-background'].checked,true);
  await ui.nodes['theme-publish-form'].dispatch('submit');assert.deepEqual(sent,{...ocean,background});
});

test('code ownership is checked before uploading a background', async () => {
  let uploads=0;
  const ui=uiFixture({background:{kind:'upload'},service:{assertThemeWritable:async()=>{throw Error('That code belongs to another creator');}}});
  ui.win.fluxBackgrounds.exportForTheme=async()=>{uploads++;};ui.controller.open(true);ui.nodes['theme-publish-name'].value='My look';
  await ui.nodes['theme-publish-form'].dispatch('submit');assert.equal(uploads,0);assert.match(ui.nodes['theme-publish-status'].textContent,/another creator/);
});
