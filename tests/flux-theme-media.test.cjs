const test = require('node:test');
const assert = require('node:assert/strict');
const {webcrypto} = require('node:crypto');
const themes = require('../js/flux-theme-core.js');
const media = require('../js/flux-theme-media.js');
const backgrounds = require('../js/flux-backgrounds.js');
const palette = themes.normalizeTheme(themes.presets[1]);
const layout = {order:['recent','welcome','hot','stats'],hidden:['stats'],columns:'4',hero:'compact'};
const assetId='a'.repeat(32);

test('theme bundles preserve backgrounds and layouts while rejecting unsafe or malformed settings',()=>{
  const background={kind:'url',url:'https://images.example/animated.gif',tint:45,blur:2,fit:'cover'};
  assert.deepEqual(themes.normalizeTheme({...palette,background,homepage:layout}),{...palette,background,homepage:layout});
  assert.deepEqual(themes.normalizeTheme(palette),palette);
  for(const invalid of ['javascript:alert(1)','data:image/svg+xml,x','http://images.example/a','https://name:password@example.com/a'])assert.equal(themes.normalizeTheme({...palette,background:{...background,url:invalid}}),null);
  assert.equal(themes.normalizeBackground({...background,kind:'asset',assetId:'../other'}),null);
  assert.equal(themes.normalizeHomepage({...layout,order:['recent','recent','hot','stats']}),null);
  assert.equal(themes.normalizeHomepage({...layout,hidden:['stats','stats']}),null);
  assert.equal(themes.normalizeBackground({...background,preview:'data:image/svg+xml,<script>'}),null);
  assert.deepEqual(themes.normalizeHomepage({...layout,updatedAt:10,privateAccount:'secret'}),layout);
});

function fixture() {
  const records=new Map(),writes=[];let sequence=0,failAt=-1;
  const snapshot=path=>({exists:records.has(path),data:()=>records.get(path)});
  const ref=path=>({path,collection:name=>ref(path+'/'+name),doc:name=>ref(path+'/'+name),get:async()=>snapshot(path),set:async value=>{records.set(path,value);writes.push(path);},update:async value=>records.set(path,{...records.get(path),...value})});
  const db={collection:ref,batch(){const pending=[];return {set:(doc,value)=>pending.push(()=>{records.set(doc.path,value);writes.push(doc.path);}),delete:doc=>pending.push(()=>records.delete(doc.path)),commit:async()=>{if(++sequence===failAt)throw Error('Connection interrupted');pending.forEach(fn=>fn());}};}};
  const win={fluxFirebaseDb:db,fluxAuthState:{uid:'alice'},fluxFirebase:{firestore:{Blob:{fromUint8Array:bytes=>({toUint8Array:()=>bytes})},FieldValue:{serverTimestamp:()=>123}}},crypto:{subtle:webcrypto.subtle,randomUUID:()=>assetId},Blob};
  return {win,records,writes,api:media.create(win),failBatch:at=>failAt=at};
}
function gif(size=90){const bytes=new Uint8Array(size);bytes.set(Buffer.from('GIF89a'));for(let i=6;i<size;i++)bytes[i]=i%251;return new Blob([bytes],{type:'image/gif'});}

test('uploaded animation bytes are split below document limits and reconstructed exactly for another visitor',async()=>{
  const ui=fixture(),original=gif(media.chunkSize*4+123),progress=[];
  const shared=await ui.api.upload(original,percent=>progress.push(percent));
  const parent=ui.records.get('theme_backgrounds/'+assetId);
  assert.equal(parent.ready,true);assert.equal(parent.chunkCount,5);assert.equal(parent.contentType,'image/gif');
  assert.deepEqual(progress,[80,100]);assert.ok(ui.writes.filter(path=>path.includes('/chunks/')).every(path=>ui.records.get(path).bytes.toUint8Array().length<=media.chunkSize));
  ui.win.fluxAuthState={};const loaded=await media.create(ui.win).load(shared.assetId);
  assert.deepEqual(Buffer.from(await loaded.arrayBuffer()),Buffer.from(await original.arrayBuffer()));
  assert.equal(loaded.type,'image/gif');
});

test('a corrupt or incomplete background never becomes an applied image',async()=>{
  const ui=fixture();await ui.api.upload(gif());
  ui.records.get('theme_backgrounds/'+assetId+'/chunks/00').bytes={toUint8Array:()=>new Uint8Array(90)};
  await assert.rejects(media.create(ui.win).load(assetId),/verified/);
  ui.records.delete('theme_backgrounds/'+assetId+'/chunks/00');
  await assert.rejects(media.create(ui.win).load(assetId),/incomplete/);
});

test('failed uploads clean up their unpublished chunks and cannot be mistaken for ready assets',async()=>{
  const ui=fixture();ui.failBatch(2);
  await assert.rejects(ui.api.upload(gif(media.chunkSize*4+123)),/interrupted/);
  assert.equal(ui.records.size,0);
});

test('unsigned publishing, disguised images, oversized files, and invalid manifests fail early',async()=>{
  const ui=fixture();ui.win.fluxAuthState={};await assert.rejects(ui.api.upload(gif()),/Sign in/);
  ui.win.fluxAuthState={uid:'alice'};await assert.rejects(ui.api.upload(new Blob(['not an image'],{type:'image/gif'})),/Choose a/);
  await assert.rejects(ui.api.upload(new Blob([new Uint8Array(media.maxBytes+1)])),/10 MB/);
  assert.equal(ui.records.size,0);
  assert.equal(media.manifest({ready:true,size:20,chunkCount:20,contentType:'image/gif',sha256:'a'.repeat(64)}),null);
});

test('shared image application stores the original blob and retains Lite Mode without starting animation',async()=>{
  const saved=new Map(),blobs=new Map(),nodes=Object.fromEntries(['site-background','site-background-image','background-status'].map(id=>[id,{hidden:true,style:{setProperty(){}},removeAttribute(){}}]));
  let loads=0,downloads=0;
  const win={FluxThemes:themes,document:{getElementById:id=>nodes[id]},location:{href:'https://flux.example/'},localStorage:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)},fluxPerformance:{isEnabled:()=>true},crypto:webcrypto,URL:{revokeObjectURL(){}},Image:class{constructor(){loads++;}},File,addEventListener(){},fluxThemeMedia:{load:async()=>{downloads++;return gif();}}};
  const controller=backgrounds.create(win,{media:{get:async key=>blobs.get(key),put:async(key,value)=>blobs.set(key,value),remove:async key=>blobs.delete(key)}});controller.start();
  await controller.applyShared({kind:'asset',assetId,tint:40,blur:3,fit:'contain'});
  assert.equal(controller.getPreferences().kind,'upload');assert.equal(controller.getPreferences().sharedAssetId,assetId);assert.equal(controller.getPreferences().tint,40);
  assert.equal(loads,0);assert.equal(downloads,1);assert.equal(nodes['site-background'].hidden,true);
  const exported=await controller.exportForTheme();assert.equal(exported.assetId,assetId);
  await controller.applyShared({...exported,tint:65});assert.equal(downloads,1);assert.equal(controller.getPreferences().kind,'upload');assert.equal(controller.getPreferences().tint,65);
});
