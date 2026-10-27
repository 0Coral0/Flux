const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const social = readFileSync(join(root, 'js', 'flux-social.js'), 'utf8');
const rules = readFileSync(join(root, 'FIREBASE_SOCIAL_RULES.md'), 'utf8');
const admin = readFileSync(join(root, 'admin.html'), 'utf8');

test('Flux Social includes rooms, friends, reports, replies, reactions, staff deletion, and game chat', () => {
  for (const name of ['flux_social_rooms', 'flux_friend_requests', 'flux_chat_reports', 'replyTo', 'toggleReaction', 'deleteMessage', 'mountGamePopup']) {
    assert.match(social, new RegExp(name));
  }
});

test('Flux Social retains the reader scroll offset instead of jumping to new messages', () => {
  assert.match(social, /const wasAtBottom/);
  assert.match(social, /oldTop \+ delta/);
});

test('staff roles and bounded bans are represented in the admin panel and rules', () => {
  assert.match(admin, /Chat & Moderation/);
  assert.match(admin, /flux_staff/);
  assert.match(rules, /duration\.value\(30, 'd'\)/);
  assert.match(rules, /duration\.value\(1, 'd'\)/);
  assert.match(rules, /isFluxOwner/);
  assert.match(social, /parseBanLength/);
  assert.match(admin, /social-ban-custom-hours/);
});

test('Discord widget integration is optional until IDs are configured', () => {
  const config = readFileSync(join(root, 'js', 'discord-widget-config.js'), 'utf8');
  assert.match(config, /FLUX_DISCORD_WIDGET/);
  assert.match(social, /@widgetbot\/crate@3/);
});
