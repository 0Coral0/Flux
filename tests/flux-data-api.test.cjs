const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'cloudflare', 'flux-data-api', 'src', 'index.js'), 'utf8');
const schema = fs.readFileSync(path.join(root, 'cloudflare', 'flux-data-api', 'schema.sql'), 'utf8');
const config = fs.readFileSync(path.join(root, 'cloudflare', 'flux-data-api', 'wrangler.toml'), 'utf8');

test('Flux data Worker protects writes with Firebase token verification', () => {
  assert.match(source, /requireFirebaseUser\(request, env\)/);
  assert.match(source, /service_accounts\/v1\/jwk\/securetoken@system\.gserviceaccount\.com/);
  assert.match(source, /RSASSA-PKCS1-v1_5/);
  assert.match(source, /FIREBASE_PROJECT_ID/);
});

test('Flux data Worker provides theme and account-settings routes', () => {
  assert.match(source, /themeMatch/);
  assert.match(source, /\/api\/users\/me\/settings/);
  assert.match(source, /THEME_CODE/);
  assert.match(source, /theme_codes/);
  assert.match(source, /user_settings/);
});

test('D1 schema and Worker configuration point at flux-data', () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS theme_codes/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS user_settings/);
  assert.match(config, /name = "flux-data-api"/);
  assert.match(config, /database_name = "flux-data"/);
  assert.match(config, /class_name = "FluxChatRoom"/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS chat_messages/);
  assert.match(source, /export class FluxChatRoom/);
});

test('WebSocket tickets keep profile images out of Durable Object attachments', () => {
  assert.match(source, /const socketIdentity = \{ uid: identity\.uid, username: identity\.username, role: identity\.role, room \}/);
  assert.match(source, /SELECT avatar, profile_json FROM chat_users WHERE uid=\?/);
  assert.doesNotMatch(source, /identity: \{ \.\.\.identity, room \}/);
  assert.match(source, /readJson\(request, 70_000\)/);
});
