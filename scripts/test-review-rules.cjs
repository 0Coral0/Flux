// Run against the official local Firestore emulator with docs/firebase/game-reviews.rules
// appended inside the current database match. Never targets the live project.
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:3039/v1/projects/demo-flux-reviews/databases/(default)/documents';
const documentName = path => 'projects/demo-flux-reviews/databases/(default)/documents/' + path;
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = uid => b64({alg:'none',typ:'JWT'})+'.'+b64({sub:uid,user_id:uid,email:uid+'@example.test',aud:'demo-flux-reviews',iss:'https://securetoken.google.com/demo-flux-reviews',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,firebase:{sign_in_provider:'custom'}})+'.';
const field = value => typeof value === 'number' ? {integerValue:String(value)} : {stringValue:value};
const fields = value => Object.fromEntries(Object.entries(value).map(([key,value])=>[key,field(value)]));
let checks=0;
async function call(method, path, body, uid, expected=200) {
  const response = await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(uid?{Authorization:'Bearer '+(uid==='owner'?'owner':token(uid))}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();
  assert.equal(response.status,expected,method+' '+path+': '+JSON.stringify(data)); checks++; return data;
}
async function write(path, data, uid, {expected=200,createdAt}={}) {
  const value=fields(data); if(createdAt)value.createdAt=createdAt;
  return call('POST',':commit',{writes:[{update:{name:documentName(path),fields:value},updateTransforms:[...(!createdAt?[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}]:[]),{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}]}]},uid,expected);
}
(async()=>{
  await call('PATCH','/chat_users/alice',{fields:fields({username:'Alice'})},'owner');
  await call('PATCH','/chat_users/bob',{fields:fields({username:'Bob'})},'owner');
  const path='/game_reviews/bad-time-simulator/reviews/alice';
  const value={uid:'alice',gameId:'bad-time-simulator',gameName:'Bad Time Simulator',authorName:'Alice',rating:4,text:'Fun challenge.'};
  await write(path.slice(1),value,null,{expected:403});
  await write(path.slice(1),value,'bob',{expected:403});
  await write(path.slice(1),{...value,authorName:'Bob'},'alice',{expected:403});
  await write(path.slice(1),{...value,rating:6},'alice',{expected:403});
  await write(path.slice(1),{...value,gameName:'Invented'},'alice',{expected:403});
  await write(path.slice(1),{...value,text:'x'.repeat(1201)},'alice',{expected:403});
  await write(path.slice(1),{...value,admin:'true'},'alice',{expected:403});
  await write(path.slice(1),value,'alice');
  const saved=await call('GET',path,null,null); assert.equal(saved.fields.rating.integerValue,'4');
  await write(path.slice(1),{...value,rating:5,text:'Updated review.'},'alice',{createdAt:saved.fields.createdAt});
  await write(path.slice(1),{...value,uid:'bob'},'bob',{expected:403,createdAt:saved.fields.createdAt});
  await call('DELETE',path,null,'bob',403);
  const reportPath='/game_review_reports/bad-time-simulator_alice_bob';
  const report={gameId:'bad-time-simulator',authorUid:'alice',reporterUid:'bob',reason:'Please check this review.'};
  const reportBody={writes:[{update:{name:documentName(reportPath.slice(1)),fields:fields(report)},updateTransforms:[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}]}]};
  await call('POST',':commit',reportBody,null,403);
  await call('POST',':commit',reportBody,'alice',403);
  await call('POST',':commit',reportBody,'bob');
  await call('GET',reportPath,null,'bob',403); await call('GET',reportPath,null,null,403);
  await call('PATCH','/flux_bans/alice',{fields:{expiresAt:{nullValue:null}}},'owner');
  await write(path.slice(1),value,'alice',{expected:403,createdAt:saved.fields.createdAt});
  await call('DELETE',path,null,'alice');
  await call('GET',path,null,null,404);
  // An account without a chat profile can publish using the verified fallback name.
  await write('game_reviews/bad-time-simulator/reviews/guestmember',{...value,uid:'guestmember',authorName:'Flux member'},'guestmember');
  await call('DELETE','/game_reviews/bad-time-simulator/reviews/guestmember',null,'guestmember');
  console.log(checks+' review rules checks passed in the local emulator.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
