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

function setup(createDb) {
  const storage = new Map();
  const state = { rendered: [], loads: 0, discord: [], imports: 0 };
  const input = { value: 'hello' };
  const status = {};
  const notice = { classList: { toggle() {} } };
  const context = {
    window: {
      fluxFirebaseDb: createDb(),
      fluxFirebase: { firestore: { FieldValue: { serverTimestamp: () => 1 } } },
      fluxAuthState: { uid: 'test-user' },
      fluxDiscord: { stop() {}, start: mode => state.discord.push(mode) }
    },
    document: { getElementById: id => id === 'lounge-message-input' ? input : id === 'backend-status-indicator' ? status : id === 'chat-moderation-notice' ? notice : {} },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    loadLocalChatMessages: () => state.loads++,
    renderChatMessages: messages => state.rendered.push(messages),
    console: { warn() {} },
    getProfileData: () => ({}),
  };
  const source = `${lifecycleSource}\n${sendSource}`;
  const api = vm.runInNewContext(`
    let activeChatRoom = 'global_general', unsubscribeFirestore = null, chatSubscriptionGeneration = 0, localChatFallback = false;
    ${source}
    ({ setupChatSubscription, stopChatSubscription, sendChatMessage, safeChatAvatar, compactLocalChatMessage, setRoom: value => activeChatRoom = value });
  `, context);
  return { api, input, notice, status, state, storage };
}

test('a stale Firebase callback cannot redraw chat after leaving Global Chat', async () => {
  let listener;
  const h = setup(() => ({ collection: () => ({ orderBy: () => ({ limit: () => ({ onSnapshot: callback => { listener = callback; return () => {}; } }) }) }) }));
  await h.api.setupChatSubscription();
  h.api.stopChatSubscription();
  listener({ forEach: callback => callback({ data: () => ({ text: 'stale' }) }) });
  assert.equal(h.state.rendered.length, 0);
});

test('Global Chat reads a bounded recent history and ignores callbacks after leaving', async () => {
  let listener, order, limit, unsubscribed = false;
  const h = setup(() => ({ collection: () => ({ orderBy: (...args) => { order = args; return { limit: value => { limit = value; return { onSnapshot: callback => { listener = callback; return () => { unsubscribed = true; }; } }; } }; } }) }));
  await h.api.setupChatSubscription();
  assert.deepEqual(order, ['timestamp', 'desc']);
  assert.equal(limit, 200);
  const snapshot = { forEach: callback => callback({ data: () => ({ text: 'hello' }) }) };
  listener(snapshot);
  assert.equal(h.state.rendered.length, 1);
  h.api.stopChatSubscription();
  listener(snapshot);
  assert.equal(unsubscribed, true);
  assert.equal(h.state.rendered.length, 1);
});

test('Firebase listener failure reaches the local fallback', async () => {
  const h = setup(() => ({ collection: () => ({ orderBy: () => ({ limit: () => ({ onSnapshot: (_, onError) => onError(Error('offline')) }) }) }) }));
  await h.api.setupChatSubscription();
  assert.equal(h.state.loads, 1);
  assert.equal(h.status.innerText, 'Mode: Local Storage');
});

test('the visible chat is Global Chat only', () => {
  assert.doesNotMatch(html, /Discord Chat|Discord Direct Message|dm-list-container|createNewDM\(/);
  assert.match(html, /class="lounge-layout-grid global-chat-only"/);
});

test('failed Firebase sends retain the draft instead of silently switching to local storage', async () => {
  const delivery = deferred();
  const h = setup(() => ({ collection: () => ({ orderBy: () => ({ limit: () => ({ onSnapshot() {} }) }), add: () => delivery.promise }) }));
  const sending = h.api.sendChatMessage();
  await new Promise(resolve => setImmediate(resolve));
  delivery.reject(Error('offline'));
  await sending;
  assert.equal(h.input.value, 'hello');
  assert.equal(h.storage.has('flux_chat_db'), false);
  assert.equal(h.state.loads, 0);
  assert.match(h.notice.textContent, /Firebase could not send/);
});

test('chat strips oversized data-image avatars before a message is stored or sent', () => {
  const h = setup(() => ({}));
  const enormousAvatar = `data:image/png;base64,${'a'.repeat(40001)}`;
  assert.equal(h.api.safeChatAvatar(enormousAvatar), '');
  const compacted = h.api.compactLocalChatMessage({ avatar: enormousAvatar, text: 'hello' }, 'global_general');
  assert.equal(compacted.avatar, '');
  assert.equal(compacted.text, 'hello');
});

test('chat includes a browser-side image compression path for oversized avatar uploads', () => {
  assert.match(html, /async function compressChatAvatar\(value\)/);
  assert.match(html, /canvas\.toDataURL\('image\/jpeg', quality\)/);
  assert.match(html, /const chatAvatar = await compressChatAvatar\(profile\.avatar\)/);
});
