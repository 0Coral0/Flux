const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const moderation = require(join(root, 'js', 'flux-chat-moderation.js'));

test('chat moderation allows ordinary conversation', () => {
  assert.deepEqual(moderation.check('Want to play 2048?'), { allowed: true });
});

test('chat moderation blocks built-in phrases regardless of case or punctuation', () => {
  assert.equal(moderation.check('KYS').allowed, false);
  assert.equal(moderation.check('Please go... die').allowed, false);
  assert.equal(moderation.check('KYS is not a normal message').allowed, false);
  assert.equal(moderation.check('White-power is not welcome here.').allowed, false);
  assert.equal(moderation.check('Talking about the Holocaust').allowed, false);
});

test('chat moderation exposes a small default list for matching Firestore rules', () => {
  assert.ok(moderation.defaultBlockedPhrases.includes('kill yourself'));
  assert.ok(moderation.defaultBlockedPhrases.includes('i will hurt you'));
  assert.ok(moderation.defaultBlockedPhrases.includes('white power'));
  assert.ok(moderation.defaultBlockedPhrases.includes('holocaust'));
});

test('owner badges use the authenticated owner flag instead of a display name', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const auth = readFileSync(join(root, 'js', 'flux-auth.js'), 'utf8');
  assert.match(html, /m\.owner === true/);
  assert.match(html, /owner: window\.fluxChatIdentity\?\.owner === true/);
  for (const email of ['z.werner1@lodiusd.org', 'xboxmaster83412@gmail.com', 'coralsemail0@gmail.com']) {
    assert.match(auth, new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
