const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(`${__dirname}/../js/discord-chat.js`, 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const response = data => ({ ok: true, json: async () => data });

class Element {
  constructor() { this.children = []; this.dataset = {}; this.textContent = ''; this.hidden = true; this.value = ''; }
  replaceChildren(...children) { this.children = children; }
  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this[name] = value; }
  focus() {}
}
function setup(fetchImpl, base = 'https://bridge.example', directory) {
  const channel = { id: '100000000000000001', name: 'main-chat', type: 'text', category: 'Chat', readOnly: false };
  directory ||= [channel];
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  const listeners = new Map();
  const window = {
    FLUX_DISCORD_BRIDGE_URL: base,
    fluxGetToken: async () => 'token',
    addEventListener: (event, callback) => listeners.set(event, callback),
  };
  vm.runInNewContext(source, {
    window, AbortSignal,
    document: { getElementById: get, createElement: () => new Element() },
    fetch: (path, options) => path.endsWith('/api/chat/channels') ? Promise.resolve(response({channels:directory})) : Promise.resolve(fetchImpl(path,options)).then(async result => {
      if (path.includes('mode=public') && result.ok) {
        const selected = directory.find(item => item.id === new URL(path).searchParams.get('channel')) || channel;
        const data = await result.json(); return response({channel:selected,...data});
      }
      return result;
    }),
    setInterval: () => 1, clearInterval() {},
  });
  return { get, api: window.fluxDiscord, authChanged: () => listeners.get('flux-auth-changed')() };
}

test('account changes clear visible invitations and reject pending invitation results', async () => {
  const pending = deferred();
  let invites = 0;
  const h = setup(async path => path.includes('/invite')
    ? ++invites === 1 ? response({ code: 'first-secret-code' }) : pending.promise
    : response({ messages: [], contact: null }));
  h.api.start('dm');
  await settle();
  await h.get('discord-pair').onclick();
  assert.match(h.get('discord-connection-note').textContent, /first-secret-code/);
  h.authChanged();
  await settle();
  assert.doesNotMatch(h.get('discord-connection-note').textContent, /first-secret-code/);
  const invite = h.get('discord-pair').onclick();
  await settle();
  h.authChanged();
  pending.resolve(response({ code: 'stale-secret-code' }));
  await invite;
  assert.doesNotMatch(h.get('discord-connection-note').textContent, /stale-secret-code/);
});

test('a stale public poll cannot replace the private room after switching', async () => {
  const oldPoll = deferred();
  const h = setup(async path => path.includes('mode=public') ? oldPoll.promise : response({ messages: [], contact: 'Private contact' }));
  h.api.start('public');
  await settle();
  h.api.start('dm');
  await settle();
  const privateFeed = h.get('lounge-messages-feed').children[0];
  oldPoll.resolve(response({ messages: [{ username: 'Public', text: 'old response' }] }));
  await settle();
  assert.equal(h.get('lounge-messages-feed').children[0], privateFeed);
  assert.match(h.get('discord-connection-note').textContent, /Private contact/);
  assert.equal(h.get('discord-pair').disabled, true);
});

test('failed delivery retains the draft and shows the server error', async () => {
  const h = setup(async (_, options) => options.method === 'POST'
    ? { ok: false, json: async () => ({ error: 'Delivery failed' }) }
    : response({ messages: [] }));
  h.api.start();
  await settle();
  h.get('lounge-message-input').value = 'keep this draft';
  await h.api.send('keep this draft', { name: 'Alice' });
  assert.equal(h.get('lounge-message-input').value, 'keep this draft');
  assert.equal(h.get('backend-status-indicator').textContent, 'Delivery failed');
});

test('unconfigured invitations show setup information without sending a request', async () => {
  let calls = 0;
  const h = setup(async () => calls++, '');
  h.api.start('dm');
  await h.get('discord-pair').onclick();
  assert.equal(calls, 0);
  assert.equal(h.get('lounge-message-input').disabled, true);
  assert.match(h.get('discord-connection-note').textContent, /server connection/);
  h.api.stop();
  assert.equal(h.get('lounge-message-input').disabled, false);
});

test('announcement channels disable composing and cannot send even through a direct UI call', async () => {
  let posted = false;
  const directory = [{id:'100000000000000001',name:'announcements',type:'text',announcement:true,readOnly:true,reason:'Announcements — only Discord staff can post.'}];
  const h = setup(async (_, options) => { if (options.method === 'POST') posted = true; return response({messages:[]}); }, undefined, directory);
  h.api.start(); await settle();
  assert.equal(h.get('current-chat-title').textContent,'announcements');
  assert.equal(h.get('lounge-message-input').disabled,true);
  await h.api.send('bypass',{name:'Alice'});
  assert.equal(posted,false);
  assert.match(h.get('backend-status-indicator').textContent,/only Discord staff/);
});

test('channel switching changes both the displayed destination and the server request', async () => {
  const directory = [
    {id:'100000000000000001',name:'general',type:'text',readOnly:false},
    {id:'100000000000000002',name:'games',type:'text',readOnly:false},
  ];
  const paths = [];
  const h = setup(async path => {paths.push(path);return response({messages:[]});},undefined,directory);
  h.api.start(); await settle();
  h.api.selectChannel(directory[1].id); await settle();
  assert.equal(h.get('current-chat-title').textContent,'games');
  await h.api.send('hello',{name:'Alice'});
  assert.equal(new URL(paths.at(-1)).searchParams.get('channel'),directory[1].id);
  assert.equal(h.get('lounge-message-input').disabled,false);
});

test('forum parents show posts, require a title, and open the created thread', async () => {
  const directory = [
    {id:'100000000000000001',name:'support',type:'forum',readOnly:false,tags:[]},
    {id:'100000000000000002',name:'Existing post',type:'thread',parentId:'100000000000000001',readOnly:false},
  ];
  let sent;
  const h = setup(async (path,options) => {
    if(options.method === 'POST') {sent=JSON.parse(options.body);return response({channelId:directory[1].id});}
    return response({messages:[]});
  },undefined,directory);
  h.api.start(); await settle();
  assert.equal(h.get('discord-post-title').hidden,false);
  assert.equal(h.get('lounge-messages-feed').children[0].children[0].textContent,'Existing post');
  await h.api.send('question',{name:'Alice'}); assert.equal(sent,undefined);
  h.get('discord-post-title').value='My question';
  await h.api.send('question',{name:'Alice'});
  assert.equal(sent.title,'My question');
  assert.equal(h.get('current-chat-title').textContent,'Existing post');
  assert.equal(h.get('discord-post-title').hidden,true);
});
