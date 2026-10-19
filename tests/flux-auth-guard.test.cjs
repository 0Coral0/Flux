const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/flux-auth-guard.js'), 'utf8');

function fixture(protocol = 'https:') {
  const events = {};
  const listeners = {};
  const status = { textContent: 'Connecting to accounts…' };
  const form = { addEventListener(name, fn) { (listeners[name] ||= []).push(fn); } };
  const controls = { 'flux-auth-form': form, 'flux-auth-status': status };
  const win = {
    document: { getElementById: id => controls[id] || null }, location: { protocol },
    dispatchEvent: event => { events[event.type] = (events[event.type] || 0) + 1; },
    setTimeout: fn => { win.timeout = fn; }
  };
  vm.runInNewContext(source, { window: win, Event: class { constructor(type) { this.type = type; } } });
  const submit = () => {
    const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    for (const listener of listeners.submit || []) listener(event);
    return event;
  };
  return { win, status, form, events, submit };
}

test('failed account initialization cannot reload the page on submit', () => {
  const ui = fixture();
  assert.equal(ui.submit().defaultPrevented, true);
  assert.match(ui.status.textContent, /Accounts could not connect/);
  assert.equal(ui.win.fluxAuthState.status, 'unavailable');
  assert.equal(ui.events['flux-auth-changed'], 1);
});

test('the guard keeps the normal sign-in listener active once Firebase is ready', () => {
  const ui = fixture(); let loggedIn = false;
  ui.win.fluxAuthReady = true;
  ui.form.addEventListener('submit', () => { loggedIn = true; });
  assert.equal(ui.submit().defaultPrevented, true);
  assert.equal(loggedIn, true);
  ui.win.timeout();
  assert.equal(ui.status.textContent, 'Connecting to accounts…');
});

test('direct file opening explains how to reach the local server', () => {
  const ui = fixture('file:');
  assert.match(ui.status.textContent, /http:\/\/127\.0\.0\.1:3031\//);
  assert.equal(ui.win.fluxAuthState.status, 'unavailable');
});

test('the guard loads before the Firebase account module', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.indexOf('js/flux-auth-guard.js') < html.indexOf('js/flux-auth.js'));
});
