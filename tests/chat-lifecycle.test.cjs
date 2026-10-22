const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const html = readFileSync(`${__dirname}/../index.html`, 'utf8');
const lifecycleSource = html.slice(html.indexOf('function stopChatSubscription()'), html.indexOf('function loadLocalChatMessages()'));
const sendSource = html.slice(html.indexOf('async function sendChatMessage()'), html.indexOf('function handleChatKey('));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function setup(loadSdk) {
  const storage = new Map();
  const state = { rendered: [], loads: 0, discord: [], imports: 0 };
  const input = { value: 'hello' };
  const status = {};
  const context = {
    window: { fluxFirebaseDb: {}, fluxDiscord: { stop() {}, start: mode => state.discord.push(mode) } },
    document: { getElementById: id => id === 'lounge-message-input' ? input : id === 'backend-status-indicator' ? status : {} },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    loadSdk: () => { state.imports++; return loadSdk(); },
    loadLocalChatMessages: () => state.loads++,
    renderChatMessages: messages => state.rendered.push(messages),
    console: { warn() {} },
    getProfileData: () => ({}),
  };
  const source = `${lifecycleSource}\n${sendSource}`.replaceAll('import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js")', 'loadSdk()');
  const api = vm.runInNewContext(`
    let activeChatRoom = 'global_general', unsubscribeFirestore = null, chatSubscriptionGeneration = 0, localChatFallback = false;
    ${source}
    ({ setupChatSubscription, stopChatSubscription, sendChatMessage, safeChatAvatar, compactLocalChatMessage, setRoom: value => activeChatRoom = value });
  `, context);
  return { api, input, status, state, storage };
}

test('a delayed Firebase import cannot subscribe after leaving Global Chat', async () => {
  const pending = deferred();
  let subscriptions = 0;
  const h = setup(() => pending.promise);
  const first = h.api.setupChatSubscription();
  h.api.stopChatSubscription();
  pending.resolve({ onSnapshot: () => subscriptions++ });
  await first;
  assert.equal(subscriptions, 0);
  assert.equal(h.state.loads, 0);
});

test('Global Chat subscribes to its room and ignores callbacks after leaving', async () => {
  let listener, filter, unsubscribed = false;
  const h = setup(async () => ({
    collection: () => ({}), query: (...args) => args, orderBy: () => ({}),
    where: (...args) => { filter = args; },
    onSnapshot: (_, callback) => { listener = callback; return () => { unsubscribed = true; }; },
  }));
  await h.api.setupChatSubscription();
  assert.deepEqual(filter, ['room', '==', 'global_general']);
  const snapshot = { forEach: callback => callback({ data: () => ({ text: 'hello' }) }) };
  listener(snapshot);
  assert.equal(h.state.rendered.length, 1);
  h.api.stopChatSubscription();
  listener(snapshot);
  assert.equal(unsubscribed, true);
  assert.equal(h.state.rendered.length, 1);
});

test('Firebase import failure reaches the local fallback', async () => {
  const h = setup(async () => { throw Error('offline'); });
  await h.api.setupChatSubscription();
  assert.equal(h.state.loads, 1);
  assert.equal(h.status.innerText, 'Mode: Local Storage');
});

test('the visible chat is Global Chat only', () => {
  assert.doesNotMatch(html, /Discord Chat|Discord Direct Message|dm-list-container|createNewDM\(/);
  assert.match(html, /class="lounge-layout-grid global-chat-only"/);
});

test('failed Global Chat sends fall back to the Global Chat local cache', async () => {
  const delivery = deferred();
  const h = setup(async () => ({ collection: () => ({}), serverTimestamp: () => 1, addDoc: () => delivery.promise }));
  const sending = h.api.sendChatMessage();
  await new Promise(resolve => setImmediate(resolve));
  delivery.reject(Error('offline'));
  await sending;
  const saved = JSON.parse(h.storage.get('flux_chat_db'));
  assert.equal(saved.global_general[0].text, 'hello');
  assert.equal(h.state.loads, 1);
  assert.equal(h.status.innerText, 'Mode: Local Storage');
});

test('chat strips oversized data-image avatars before a message is stored or sent', () => {
  const h = setup(async () => ({}));
  const enormousAvatar = `data:image/png;base64,${'a'.repeat(40001)}`;
  assert.equal(h.api.safeChatAvatar(enormousAvatar), '');
  const compacted = h.api.compactLocalChatMessage({ avatar: enormousAvatar, text: 'hello' }, 'global_general');
  assert.equal(compacted.avatar, '');
  assert.equal(compacted.text, 'hello');
});
