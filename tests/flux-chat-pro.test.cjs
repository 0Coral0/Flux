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

test('The released chat UI keeps the Cloudflare live-chat connection', () => {
  assert.match(page, /Mode: Cloudflare Live Sync/);
  assert.match(page, /cloudflareChatSocket/);
  assert.match(page, /sessionStorage\.removeItem\('flux_chat_transport'\)/);
  assert.match(page, /Mode: Cloudflare reconnecting/);
  assert.match(page, /Mode: Cloudflare connecting/);
  assert.match(page, /avatar: safeChatAvatar\(profile\.avatar\)/);
  assert.match(page, /banner: safeChatAvatar\(profile\.banner\)/);
  assert.match(page, /remote\.avatar \|\| local\.avatar/);
  assert.match(page, /window\.fluxData\.chat\('\/rooms\//);
  assert.match(worker, /\/api\/chat/);
  assert.match(worker, /export class FluxChatRoom/);
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
  assert.match(worker, /username is already taken/);
  assert.match(worker, /\^\[a-z0-9_\]\{3,20\}\$/);
  assert.match(worker, /status: 'accepted'/);
  assert.match(worker, /status: 'pending'/);
});
