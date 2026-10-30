const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const page = readFileSync(join(root, 'index.html'), 'utf8');
const worker = readFileSync(join(root, 'cloudflare', 'flux-data-api', 'src', 'index.js'), 'utf8');
const social = readFileSync(join(root, 'js', 'flux-chat-social.js'), 'utf8');

test('The released GitHub Global Chat interface is active in the Flux SPA', () => {
  assert.match(page, /lounge-layout-grid global-chat-only/);
  assert.match(page, /id="lounge-messages-feed"/);
  assert.match(page, /id="lounge-message-input"/);
  assert.match(page, /id="lounge-send-button"/);
  assert.doesNotMatch(page, /id="fxc-root"/);
  assert.doesNotMatch(page, /js\/flux-chat-pro\.js/);
});

test('The released chat UI uses Firebase live sync without a Worker connection loop', () => {
  assert.match(page, /Mode: Firebase Live Sync/);
  assert.match(page, /firebase-firestore-compat\.js/);
  assert.match(page, /window\.fluxFirebaseDb\.collection\("messages"\)\.orderBy\("timestamp", "desc"\)\.limit\(200\)/);
  assert.match(page, /window\.fluxFirebaseDb\.collection\("chat_rooms"\)\.doc\(subscribedRoom\)\.collection\("messages"\)/);
  assert.match(page, /window\.fluxFirebaseDb\.collection\("chat_rooms"\)\.doc\(sendingRoom\)\.collection\("messages"\)/);
  assert.doesNotMatch(page, /Mode: Cloudflare/);
  assert.doesNotMatch(page, /cloudflareChatSocket/);
  assert.match(worker, /export class FluxChatRoom/); // Retained only as an offline backup.
});

test('Social chat uses unique usernames, friend requests, DMs, and group rooms', () => {
  assert.match(page, /id="chat-social-dialog"/);
  assert.match(page, /id="chat-social-requests"/);
  assert.match(page, /id="profile-banner-input"/);
  assert.match(page, /Saved to your Flux account/);
  assert.match(social, /type: 'dm'/);
  assert.match(social, /type: 'group'/);
  assert.match(social, /friendUser/);
  assert.match(social, /label: 'Accept'/);
  assert.match(social, /method: 'PUT'/);
  assert.match(social, /label: 'Decline'/);
  assert.match(social, /status === 'accepted'/);
  assert.match(social, /status === 'pending'/);
});
