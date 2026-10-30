const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const client = fs.readFileSync(path.join(root, 'js', 'flux-data-client.js'), 'utf8');
const rules = fs.readFileSync(path.join(root, 'docs', 'firebase', 'FIREBASE_FULL_RULES.md'), 'utf8');

test('Flux data uses Firestore directly instead of a separate Worker endpoint', () => {
  assert.match(client, /Firebase compat is deliberately used here/);
  assert.match(client, /fluxFirebase\.firestore\.FieldValue/);
  assert.match(client, /win\.FLUX_DATA_PROVIDER = 'firebase'/);
  assert.doesNotMatch(client, /workers\.dev/);
  assert.doesNotMatch(client, /fetch\(/);
});

test('Firebase adapter covers themes, layouts, profiles, friends, DMs, and groups', () => {
  assert.match(client, /'themes'/);
  assert.match(client, /collection\('users'\)\.doc\(account\(\)\.uid\)\.collection\('settings'\)\.doc\('main'\)/);
  assert.match(client, /'chat_users'/);
  assert.match(client, /'chat_usernames'/);
  assert.match(client, /'friend_requests'/);
  assert.match(client, /'chat_rooms'/);
  assert.match(client, /type === 'group'/);
});

test('Firebase rules protect claimed usernames and private chat data', () => {
  assert.match(rules, /match \/chat_usernames\/\{username\}/);
  assert.match(rules, /hasMyUsernameClaim/);
  assert.match(rules, /match \/chat_rooms\/\{roomId\}/);
  assert.match(rules, /match \/friend_requests\/\{requestId\}/);
});
