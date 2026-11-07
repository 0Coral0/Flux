const test = require('node:test');
const assert = require('node:assert/strict');
const {create,hostMode} = require('../js/flux-ad-previews.js');

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
