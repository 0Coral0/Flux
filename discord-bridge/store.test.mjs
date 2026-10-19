import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from './store.mjs';
function memoryDb() {
  const data = new Map();
  const snapshot = key => ({exists:data.has(key),data:()=>data.get(key)});
  const doc = key => ({key,get:async()=>snapshot(key),set:async (v,options)=>{
    const next=options?.merge ? {...data.get(key)} : {};
    for(const [field,value] of Object.entries(v)) next[field]=value?.__increment ? (next[field]||0)+value.__increment : value;
    data.set(key,next);
  },collection:name=>collection(key+'/'+name)});
  const collection = key => ({doc:name=>doc(key+'/'+name),orderBy:()=>({limit:n=>({get:async()=>({docs:[...data.entries()].filter(([name])=>name.startsWith(key+'/')&&!name.slice(key.length+1).includes('/')).map(([,value])=>value).sort((a,b)=>b.plays-a.plays).slice(0,n).map(value=>({data:()=>value}))})})})});
  return {data,collection,getAll:async(...refs)=>refs.map(ref=>snapshot(ref.key)),runTransaction:async work=>{
    const writes=[];
    const result=await work({get:async ref=>snapshot(ref.key),set:(ref,v)=>writes.push(()=>data.set(ref.key,v)),delete:ref=>writes.push(()=>data.delete(ref.key))});
    writes.forEach(write=>write());return result;
  }};
}

test('game popularity is an aggregate without storing user identity',async()=>{
  const db=memoryDb(),store=createStore(db,{increment:value=>({__increment:value})});
  await store.recordPlay('Games/a.html');await store.recordPlay('Games/b.html');await store.recordPlay('Games/a.html');
  assert.deepEqual(await store.hotGames(),[{id:'Games/a.html',plays:2},{id:'Games/b.html',plays:1}]);
  assert.deepEqual([...db.data.values()].map(item=>Object.keys(item).sort()),[['id','plays'],['id','plays']]);
});

test('message profiles are returned only with the matching channel history',async()=>{
  const store=createStore(memoryDb());
  await store.saveMessageProfile('channel-a','message-a',{bio:'Shared bio'});
  assert.deepEqual(await store.messageProfiles('channel-a',[{id:'message-a'},{id:'native'}]),[{id:'message-a',profile:{bio:'Shared bio'}},{id:'native'}]);
  assert.deepEqual(await store.messageProfiles('channel-b',[{id:'message-a'}]),[{id:'message-a'}]);
  assert.deepEqual(await store.messageProfiles('channel-a',[]),[]);
});
test('a DM invitation is single-use and cannot steal existing contacts',async()=>{
  const store=createStore(memoryDb());
  await store.invite('alice','code-a');await store.accept('code-a','discord-a','Contact A');
  assert.equal((await store.contact('alice')).discordId,'discord-a');
  await assert.rejects(store.accept('code-a','discord-b','Other'),/invalid or expired/);
  await store.invite('bob','code-b');
  await assert.rejects(store.accept('code-b','discord-a','Contact A'),/already connected/);
  assert.equal(await store.contact('bob'),null);
});
test('new invites invalidate old codes; disconnect clears both identity mappings',async()=>{
  const store=createStore(memoryDb());
  await store.invite('alice','old');await store.invite('alice','new');
  await assert.rejects(store.accept('old','discord-a','A'),/invalid or expired/);
  await store.accept('new','discord-a','A');const first=await store.contact('alice');
  await store.unlink('alice');assert.equal(await store.contact('alice'),null);assert.equal(await store.recipient('discord-a'),null);
  await store.invite('alice','next');await store.accept('next','discord-b','B');
  assert.notEqual((await store.contact('alice')).thread,first.thread);
});
test('expired invitations are rejected',async()=>{
  const db=memoryDb(),store=createStore(db);
  await store.invite('alice','expired');
  for(const value of db.data.values()) if(value.expires) value.expires=1;
  await assert.rejects(store.accept('expired','discord-a','A'),/invalid or expired/);
});
