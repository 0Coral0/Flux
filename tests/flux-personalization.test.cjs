const test = require('node:test');
const assert = require('node:assert/strict');
const links = require('../js/flux-game-links.js');
const home = require('../js/flux-home-editor.js');
const backgrounds = require('../js/flux-backgrounds.js');
const reviews = require('../js/flux-review-data.js');
const { gameList } = require('../data.js');

test('every catalog game has a unique share link that resolves to the original game', () => {
  const entries = links.catalog(gameList);
  assert.equal(entries.length, 86); assert.equal(new Set(entries.map(entry => entry.id)).size, 86);
  for (const entry of entries) {
    const url = new URL(links.build('https://flux.example/?old=value#section', gameList, entry.game));
    assert.equal(url.searchParams.size, 1); assert.equal(url.hash, '');
    assert.equal(links.resolve(gameList, url.searchParams.get('game')), entry.game);
  }
  for (const invalid of ['https://evil.example', '../game.html', 'javascript:alert(1)', 'nonexistent', null]) assert.equal(links.resolve(gameList, invalid), null);
});

test('duplicate display names remain stable when the catalog order changes', () => {
  const games = [{name:'Café', file:'a.html'}, {name:'Cafe', file:'b.html'}];
  assert.notEqual(links.catalog(games)[0].id, links.catalog(games)[1].id);
  assert.equal(links.build('https://flux.example', games, games[0]), links.build('https://flux.example', [...games].reverse(), games[0]));
  assert.equal(links.build('https://flux.example', games, {file:'unknown.html'}), null);
});

test('homepage preferences repair duplicates and obsolete sections without mutating saved data', () => {
  const saved = {order:['hot', 'gone', 'hot'], hidden:['stats','stats','gone'], columns:99, hero:'invalid', updatedAt:-1};
  assert.deepEqual(home.normalize(saved), {order:['hot','welcome','stats','recent'], hidden:['stats'], columns:'auto',hero:'full',updatedAt:0});
  assert.equal(saved.order.length,3);
  const original = home.normalize().order;
  assert.deepEqual(home.move(original,'recent',0), ['recent','welcome','stats','hot']);
  assert.deepEqual(original,['welcome','stats','recent','hot']);
  assert.deepEqual(home.move(original,'welcome',-1),original);
});

test('background links accept HTTPS or local images and reject executable or credential-bearing URLs', () => {
  const base='http://127.0.0.1:3031/';
  assert.equal(backgrounds.imageUrl('/images/wallpaper.gif',base),base+'images/wallpaper.gif');
  assert.equal(backgrounds.imageUrl('https://images.example/animated.webp',base),'https://images.example/animated.webp');
  for (const url of ['javascript:alert(1)','data:image/svg+xml,hi','file:///C:/secret','http://external.example/image.png','https://user:password@example.com/a']) assert.throws(()=>backgrounds.imageUrl(url,base));
  assert.equal(backgrounds.normalize({kind:'url',url:'javascript:x',tint:500,blur:-8},base).kind,'none');
  assert.equal(backgrounds.normalize({tint:500,blur:-8},base).tint,90);
});

test('uploads validate image bytes and preserve the original animated file', async () => {
  const file=new File([Buffer.from('GIF89a'),Buffer.alloc(40)],'animated.gif',{type:'image/gif'});
  assert.equal(await backgrounds.validateFile(file),file);
  await assert.rejects(backgrounds.validateFile(new File(['not an image'],'fake.gif',{type:'image/gif'})),/Choose a PNG/);
  await assert.rejects(backgrounds.validateFile(new File([new Uint8Array(backgrounds.maxBytes+1)],'large.gif')),/10 MB/);
  const nodes=Object.fromEntries(['site-background','site-background-image','background-status'].map(id=>[id,{hidden:true,style:{setProperty(){}},removeAttribute(){}}]));
  const records=new Map(),media=new Map(),events={};let imageLoads=0;
  const win={document:{getElementById:id=>nodes[id]},location:{href:'https://flux.example/'},localStorage:{getItem:key=>records.get(key),setItem:(key,value)=>records.set(key,value)},fluxPerformance:{isEnabled:()=>true},crypto:{randomUUID:()=> 'test-upload'},URL:{revokeObjectURL(){}},Image:class{constructor(){imageLoads++;}},addEventListener:(key,fn)=>events[key]=fn};
  const controller=backgrounds.create(win,{media:{get:key=>media.get(key),put:async(key,value)=>media.set(key,value),remove:async key=>media.delete(key)}});
  controller.start(); await controller.upload(file);
  assert.equal(media.get('bg-test-upload').blob,file);
  assert.equal(controller.getPreferences().kind,'upload'); assert.equal(nodes['site-background'].hidden,true);
  assert.equal(imageLoads,0,'Lite Mode must not decode or fetch saved wallpaper');
  assert.match(nodes['background-status'].textContent,/pausing/);
});

test('reviews require a valid star rating and bounded plain text', () => {
  for (const score of [0,6,1.5,NaN,undefined]) assert.throws(()=>reviews.validate(score,'text'),/1 to 5/);
  assert.deepEqual(reviews.validate(4,'  Hello\u0000 world  '),{rating:4,text:'Hello world'});
  assert.throws(()=>reviews.validate(5,'x'.repeat(1201)),/1,200/);
  assert.equal(reviews.review({id:'a',data:()=>({uid:'b',rating:5,text:'forged'})}),null);
});

function reviewStore() {
  const documents=new Map([['chat_users/alice',{username:'Alice'}]]),calls=[];
  const snapshot=path=>({id:path.split('/').at(-1),exists:documents.has(path),data:()=>documents.get(path)});
  function ref(path){return {path,collection:name=>ref(path+'/'+name),doc:name=>ref(path+'/'+name),get:async()=>snapshot(path),delete:async()=>documents.delete(path),set:async value=>documents.set(path,value)};}
  const stamp={toMillis:()=>1000};
  const win={fluxAuthState:{uid:'alice'},fluxFirebase:{firestore:{FieldValue:{serverTimestamp:()=>stamp}}},fluxFirebaseDb:{collection:ref,runTransaction:async fn=>fn({get:async doc=>snapshot(doc.path),set:(doc,value)=>{calls.push(doc.path);documents.set(doc.path,value);}})}};
  return {win,documents,calls,stamp,api:reviews.create(win)};
}

test('saving twice updates the same account-owned review and preserves its creation time', async () => {
  const ui=reviewStore(),game={id:'test-game',game:{name:'Test Game'}};
  await ui.api.save(game,4,'First'); const path='game_reviews/test-game/reviews/alice';
  const original=ui.documents.get(path).createdAt;
  await ui.api.save(game,5,'Edited');
  assert.deepEqual(ui.calls,[path,path]); assert.equal(ui.documents.get(path).createdAt,original);
  assert.equal(ui.documents.get(path).rating,5);assert.equal(ui.documents.get(path).authorName,'Alice');
  assert.equal((await ui.api.mine('test-game')).text,'Edited');
  await ui.api.remove('test-game'); assert.equal(ui.documents.has(path),false);
});

test('guest posting and unsafe game paths fail before a backend write', async () => {
  const ui=reviewStore();ui.win.fluxAuthState={uid:null};
  await assert.rejects(ui.api.save({id:'test',game:{name:'Test'}},5,'Text'),/Sign in/);
  assert.equal(await ui.api.mine('test'),null);
  ui.win.fluxAuthState={uid:'alice'};
  await assert.rejects(ui.api.save({id:'../other',game:{name:'Test'}},5,'Text'),/unavailable/);
  assert.equal(ui.calls.length,0);
});

test('review reports use one document per reporter and target and never expose identity fields from form text', async () => {
  const ui=reviewStore();await ui.api.report('test-game','bob','  Spam  ');
  const report=ui.documents.get('game_review_reports/test-game_bob_alice');
  assert.equal(report.reporterUid,'alice');assert.equal(report.authorUid,'bob');assert.equal(report.reason,'Spam');
  await assert.rejects(ui.api.report('test-game','bob',''),/reason/);
});

test('rating summaries use public aggregate fields without downloading the review collection', async () => {
  const ui=reviewStore();let request;
  ui.win.fluxFirebase.app=()=>({options:{projectId:'demo-flux',apiKey:'public-config-key'}});
  const api=reviews.create(ui.win,{fetch:async(url,options)=>{request={url,options};return {ok:true,json:async()=>[{result:{aggregateFields:{reviewCount:{integerValue:'8'},ratingAverage:{doubleValue:4.25}}}}]};}});
  assert.deepEqual(await api.summary('test-game'),{count:8,average:4.25});
  assert.match(request.url,/game_reviews\/test-game:runAggregationQuery/);
  assert.equal(request.options.headers.Authorization,undefined);
  assert.equal(JSON.parse(request.options.body).structuredAggregationQuery.aggregations.length,2);
});
