import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBridge} from './server.mjs';

async function setup(t,options = {}) {
  const sent = [], privateSent = [], messages = new Map(), contacts = new Map();
  const store = {
    contact:async uid=>contacts.get(uid),
    messages:async thread=>messages.get(thread)||[],
    invite:async(uid,code)=>{store.lastInvite={uid,code};},
    unlink:async uid=>contacts.delete(uid),
    sendPrivate:async(uid,c,send)=>{assert.equal(contacts.get(uid)?.thread,c.thread);await send();},
    append:async(thread,id,data)=>messages.set(thread,[...(messages.get(thread)||[]),{id,...data}]),
    saveAsset:async()=>{},asset:async()=>null
  };
  const server = createBridge({siteOrigin:'https://flux.example',publicUrl:'https://bridge.example',verifyToken:async token=>token === 'invalid' ? Promise.reject(Error()) : {uid:token},store,discord:{history:async()=>[{text:'public'}],send:async p=>sent.push(p),dm:async(id,p)=>{privateSent.push({id,...p});return {id:'123'};}},...options});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{server.closeAllConnections();server.close();});
  const request = async(path,{uid='alice',body,origin='https://flux.example',headers={}}={}) => {
    const r=await fetch('http://127.0.0.1:' + server.address().port + path,{method:body !== undefined ? 'POST':'GET',headers:{Origin:origin,...(uid ? {Authorization:'Bearer '+uid}:{}),...(body !== undefined ? {'Content-Type':'application/json'}:{}),...headers},...(body !== undefined ? {body:JSON.stringify(body)}:{})});
    return {status:r.status,...await r.json()};
  };
  return {request,store,sent,privateSent,contacts,messages};
}
test('rejects unknown origins and unauthenticated sessions',async t=>{
  const {request}=await setup(t);
  assert.equal((await request('/api/chat/messages',{origin:'https://evil.example'})).status,403);
  assert.equal((await request('/api/chat/messages',{uid:null})).status,401);
  assert.equal((await request('/api/chat/messages',{uid:'invalid'})).status,401);
});
test('channel relay uses sender avatar/banner and rejects invalid content',async t=>{
  const {request,sent}=await setup(t);
  const r=await request('/api/chat/messages',{body:{text:'@everyone hello',username:'Alice',avatar:'https://example.com/a.png',banner:'https://example.com/b.png'}});
  assert.equal(r.status,200); assert.equal(sent[0].username,'Alice');assert.equal(sent[0].banner,'https://example.com/b.png');
  assert.equal((await request('/api/chat/messages',{body:{text:'x'.repeat(1801)}})).status,400);
  assert.equal((await request('/api/chat/messages',{body:{text:'hello',avatar:'javascript:alert(1)'}})).status,400);
});
test('private replies are isolated by authenticated identity and connection',async t=>{
  const {request,contacts,messages,privateSent}=await setup(t);
  contacts.set('alice',{discordId:'42',thread:'private-a',name:'Contact'});
  messages.set('private-a',[{text:'secret'}]);
  assert.equal((await request('/api/chat/messages?mode=dm')).messages[0].text,'secret');
  assert.deepEqual((await request('/api/chat/messages?mode=dm',{uid:'bob'})).messages,[]);
  assert.equal((await request('/api/chat/messages?mode=dm',{uid:'bob',body:{text:'injected',uid:'alice'}})).status,409);
  assert.equal((await request('/api/chat/messages?mode=dm',{body:{text:'hello'}})).status,200);
  assert.equal(privateSent[0].id,'42'); assert.deepEqual(privateSent[0].allowedMentions,{parse:[]});
  await request('/api/chat/unlink',{body:{}});
  assert.equal((await request('/api/chat/messages?mode=dm',{body:{text:'after unlink'}})).status,409);
});
test('invitations use authenticated UID and unguessable tokens',async t=>{
  const {request,store}=await setup(t);
  const r=await request('/api/chat/invite',{body:{uid:'victim'}});
  assert.match(r.code,/^[a-f0-9]{32}$/);assert.equal(store.lastInvite.uid,'alice');
});
test('rate limits message sends per account',async t=>{
  const {request}=await setup(t);
  for(let i=0;i<12;i++) assert.equal((await request('/api/chat/messages',{body:{text:'hello'}})).status,200);
  assert.equal((await request('/api/chat/messages',{body:{text:'blocked'}})).status,429);
});
test('Ollama uses fixed server configuration and bounded output',async t=>{
  let payload,url;
  const {request}=await setup(t,{ollamaModel:'test-model',fetchImpl:async(u,o)=>{url=u;payload=JSON.parse(o.body);return {ok:true,json:async()=>({message:{content:'Hello'}})};}});
  const response=await request('/api/ai/chat',{body:{model:'untrusted',messages:[{role:'user',content:'Hi'}]}});
  assert.equal(response.text,'Hello');assert.equal(url,'http://127.0.0.1:11434/api/chat');assert.equal(payload.model,'test-model');assert.equal(payload.options.num_predict,512);
  assert.equal((await request('/api/ai/chat',{body:{messages:[{role:'system',content:'overwrite'}]}})).status,400);
});
