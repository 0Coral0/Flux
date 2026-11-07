const test = require('node:test');
const assert = require('node:assert/strict');
const {create,hostMode,liveConfig} = require('../js/flux-ad-previews.js');

test('placement previews are limited to local, Render, and Netlify addresses',()=>{
  for(const host of ['localhost','127.0.0.1','[::1]','flux.onrender.com','flux.netlify.app','deploy-preview-1--flux.netlify.app','FLUX.NETLIFY.APP.']) assert.equal(hostMode(host),'preview',host);
  for(const host of ['flux-prtl.vercel.app','branch--flux.vercel.app','vercel.app','flux.example','netlify.app','flux.netlify.app.example.com','flux.onrender.com.evil.test','https://flux.netlify.app','']) assert.equal(hostMode(host),'ad-free',host);
});

function fixture(host='127.0.0.1',saved,denied=false){
  const slots=[{hidden:true},{hidden:true}],events={},records=new Map(saved?[['flux_ad_preferences_v1',saved]]:[]);let writes=0;
  const control={checked:false,disabled:false,addEventListener:(event,fn)=>events.toggle=fn},note={textContent:''},classes=new Set();
  const win={location:{hostname:host},document:{readyState:'complete',documentElement:{classList:{toggle(name,on){on?classes.add(name):classes.delete(name);}}},querySelectorAll:()=>slots,getElementById:id=>id==='set-ad-previews'?control:note},localStorage:{getItem:key=>{if(denied)throw Error();return records.get(key);},setItem:(key,value)=>{if(denied)throw Error();writes++;records.set(key,value);}},addEventListener:(key,fn)=>events[key]=fn};
  const app=create(win);app.start();return {app,slots,control,note,classes,records,events,writes:()=>writes};
}

test('visitors can disable both preview spaces, persist the choice, and restore it on reload',()=>{
  const ui=fixture();assert.equal(ui.slots[0].hidden,false);ui.control.checked=false;ui.events.toggle({target:ui.control});
  assert.ok(ui.slots.every(slot=>slot.hidden));assert.equal(ui.classes.has('flux-ad-previews'),false);
  const restored=fixture('flux.netlify.app',ui.records.get('flux_ad_preferences_v1'));assert.equal(restored.app.isEnabled(),false);
  restored.app.setEnabled(true);assert.ok(restored.slots.every(slot=>!slot.hidden));
});

test('a saved on preference cannot enable previews on Vercel or unknown domains',()=>{
  for(const host of ['flux-prtl.vercel.app','flux.example']){
    const ui=fixture(host,'{"enabled":true}');ui.app.setEnabled(true);
    assert.ok(ui.slots.every(slot=>slot.hidden));assert.equal(ui.control.disabled,true);assert.equal(ui.control.checked,false);assert.match(ui.note.textContent,/ad-free/);
  }
});

test('other tabs sync without write loops and unavailable storage does not break the toggle',()=>{
  const ui=fixture();ui.events.storage({key:'flux_ad_preferences_v1',newValue:'{"enabled":false}'});assert.equal(ui.app.isEnabled(),false);assert.equal(ui.writes(),0);
  ui.events.storage({key:'flux_config',newValue:'{}'});assert.equal(ui.app.isEnabled(),false);
  ui.events.storage({key:null});assert.equal(ui.app.isEnabled(),true);
  const denied=fixture('127.0.0.1',null,true);assert.doesNotThrow(()=>denied.app.setEnabled(false));assert.ok(denied.slots.every(slot=>slot.hidden));
});

const readyConfig = () => ({enabled:true,publisherId:'ca-pub-1234567890123456',hosts:['flux.netlify.app'],slots:{home:'1234567890',games:'9876543210'}});
function liveFixture({host='flux.netlify.app',protocol='https:',config=readyConfig(),saved,search='',denyWrites=false}={}) {
  const records=new Map(saved?[['flux_ad_preferences_v1',saved]]:[]),events={},scripts=[],classes=new Set();
  let reloads=0,replaced='';
  const element=()=>({style:{},attributes:{},children:[],events:{},setAttribute(key,value){this.attributes[key]=String(value);},addEventListener(key,fn){this.events[key]=fn;},append(item){this.children.push(item);}});
  const slot=(name,shown)=>Object.assign(element(),{hidden:false,dataset:{adPlacement:name},shown,getBoundingClientRect(){return this.shown?{width:728,height:114,top:100,bottom:214}:{width:0,height:0,top:0,bottom:0};}});
  const slots=[slot('home',true),slot('games',false)],control=element(),note={};
  const win={FLUX_ADSENSE:config,innerHeight:800,location:{hostname:host,protocol,href:protocol+'//'+host+'/'+search,search,reload(){reloads++;},replace(address){replaced=address;}},document:{readyState:'complete',hidden:false,head:{append(script){scripts.push(script);}},documentElement:{classList:{toggle(name,on){on?classes.add(name):classes.delete(name);}}},querySelectorAll:()=>slots,getElementById:id=>id==='set-ad-previews'?control:note,createElement:element,addEventListener(key,fn){events['document:'+key]=fn;}},localStorage:{getItem:key=>records.get(key),setItem(key,value){if(denyWrites)throw Error();records.set(key,value);}},addEventListener(key,fn){events[key]=fn;}};
  const app=create(win);app.start();return {app,win,slots,control,note,records,events,scripts,classes,reloads:()=>reloads,replaced:()=>replaced};
}

test('live ads require an explicit production host, HTTPS, and complete enabled account configuration',()=>{
  assert.ok(liveConfig(readyConfig(),'flux.netlify.app','https:'));
  assert.ok(liveConfig({...readyConfig(),hosts:['flux-o8vp.onrender.com']},'flux-o8vp.onrender.com','https:'));
  assert.equal(liveConfig(readyConfig(),'flux.netlify.app','http:'),null);
  for(const host of ['localhost','127.0.0.1','flux.vercel.app','deploy-preview-7--flux.netlify.app','flux.netlify.app.example.org']) {
    const config=readyConfig();config.hosts.push(host);
    const ui=liveFixture({host,config});assert.equal(ui.scripts.length,0,host);
  }
  for(const config of [undefined,{...readyConfig(),enabled:false},{...readyConfig(),publisherId:''},{...readyConfig(),slots:{home:'123'}},{...readyConfig(),hosts:[]},{...readyConfig(),publisherId:'ca-pub-<script>'}]) {
    assert.equal(liveConfig(config,'flux.netlify.app','https:'),null);
  }
});

test('only visible placements initialize and navigation reuses each ad without refreshing it',()=>{
  const ui=liveFixture();assert.equal(ui.scripts.length,1);assert.equal(ui.win.adsbygoogle.length,1);
  assert.equal(ui.slots[0].children[0].attributes['data-ad-slot'],'1234567890');assert.equal(ui.slots[1].children.length,0);
  assert.match(ui.scripts[0].src,/^https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-\d{16}$/);
  ui.slots[0].shown=false;ui.slots[1].shown=true;ui.events['flux-page-changed']();
  assert.equal(ui.scripts.length,1);assert.equal(ui.win.adsbygoogle.length,2);
  ui.slots[0].shown=true;ui.events.resize();ui.events['flux-page-changed']();
  assert.equal(ui.win.adsbygoogle.length,2);assert.equal(ui.slots[0].children.length,1);
});

test('an off preference prevents the ad script and opting out of a loaded ad reloads before changing its display',()=>{
  const ui=liveFixture({saved:'{"enabled":false}'});assert.equal(ui.scripts.length,0);assert.ok(ui.slots.every(slot=>slot.hidden));
  ui.app.setEnabled(true);assert.equal(ui.scripts.length,1);assert.equal(ui.slots[0].hidden,false);
  ui.app.setEnabled(false);assert.equal(ui.records.get('flux_ad_preferences_v1'),'{"enabled":false}');
  assert.equal(ui.reloads(),1);assert.equal(ui.slots[0].hidden,false);assert.equal(ui.classes.has('flux-ad-previews'),true);
  const next=liveFixture({saved:ui.records.get('flux_ad_preferences_v1')});assert.equal(next.scripts.length,0);
});

test('live opt-out falls back to the URL if storage writes fail and can be reversed',()=>{
  const ui=liveFixture({denyWrites:true});ui.app.setEnabled(false);assert.equal(new URL(ui.replaced()).searchParams.get('flux-ads'),'off');
  const next=liveFixture({denyWrites:true,search:'?flux-ads=off'});assert.equal(next.scripts.length,0);assert.equal(next.app.isEnabled(),false);
  next.app.setEnabled(true);assert.equal(new URL(next.replaced()).searchParams.has('flux-ads'),false);assert.equal(next.scripts.length,0);
});

test('a provider load failure stops retries and leaves site events functional',()=>{
  const ui=liveFixture();assert.doesNotThrow(()=>ui.scripts[0].events.error());assert.equal(ui.slots[0].hidden,true);
  ui.slots[1].shown=true;ui.events['flux-page-changed']();assert.equal(ui.scripts.length,1);assert.equal(ui.slots[1].children.length,0);
});
