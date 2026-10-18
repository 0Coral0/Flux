const { test } = require('node:test');
const assert = require('node:assert/strict');
const { toDiscord, toFlux } = require('./format');
test('only global human messages leave Flux; mentions are disabled', () => {
  assert.equal(toDiscord({room:'dm_alice',text:'private'}), null);
  assert.equal(toDiscord({room:'global_general',source:'discord',text:'echo'}), null);
  const payload = toDiscord({room:'global_general',username:'Alice',text:'@everyone ' + 'x'.repeat(2100)});
  assert.equal(payload.content.length,2000);
  assert.deepEqual(payload.allowedMentions,{parse:[]});
});
test('Discord bot and webhook messages cannot loop', () => {
  assert.equal(toFlux({author:{bot:true}}),null);
  assert.equal(toFlux({author:{bot:false},webhookId:'123'}),null);
});
test('Discord messages preserve sender and attachment URLs in Flux schema', () => {
  const result = toFlux({id:'123',author:{bot:false,username:'Alice'},member:{displayName:'Alice A'},cleanContent:'hello',attachments:new Map([['1',{url:'https://cdn.discordapp.com/a.png'}]]),createdTimestamp:0});
  assert.equal(result.room,'global_general');
  assert.equal(result.source,'discord');
  assert.equal(result.username,'[Discord] Alice A');
  assert.equal(result.text,'hello\nhttps://cdn.discordapp.com/a.png');
  assert.equal(result.avatar,'');
});
