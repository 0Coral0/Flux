// Isolated rules checks. This endpoint is deliberately fixed to a local demo project.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const base='http://127.0.0.1:3039/v1/projects/demo-flux-reviews/databases/(default)/documents';
const name=path=>'projects/demo-flux-reviews/databases/(default)/documents/'+path;
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const token=uid=>b64({alg:'none',typ:'JWT'})+'.'+b64({sub:uid,user_id:uid,email:uid+'@example.test',aud:'demo-flux-reviews',iss:'https://securetoken.google.com/demo-flux-reviews',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,firebase:{sign_in_provider:'custom'}})+'.';
const field=value=>Buffer.isBuffer(value)?{bytesValue:value.toString('base64')}:typeof value==='string'?{stringValue:value}:typeof value==='number'?{integerValue:String(value)}:typeof value==='boolean'?{booleanValue:value}:Array.isArray(value)?{arrayValue:{values:value.map(field)}}:{mapValue:{fields:fields(value)}};
const fields=value=>Object.fromEntries(Object.entries(value).map(([key,value])=>[key,field(value)]));
let checks=0;
async function call(method,path,body,uid,expected=200){const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(uid?{Authorization:'Bearer '+(uid==='owner'?'owner':token(uid))}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();assert.equal(response.status,expected,method+' '+path+': '+JSON.stringify(data));checks++;return data;}
async function write(path,value,uid,stamps=[],expected=200){return call('POST',':commit',{writes:[{update:{name:name(path),fields:fields(value)},...(stamps.length?{updateTransforms:stamps.map(fieldPath=>({fieldPath,setToServerValue:'REQUEST_TIME'}))}:{})}]},uid,expected);}
(async()=>{
 const assetId=crypto.randomUUID().replaceAll('-',''),assetPath='theme_backgrounds/'+assetId,bytes=Buffer.from('GIF89a'+'x'.repeat(38));
 const asset={ownerUid:'alice',contentType:'image/gif',size:bytes.length,chunkCount:1,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),ready:false};
 await write(assetPath,asset,null,['createdAt'],403);
 await write(assetPath,{...asset,ownerUid:'bob'},'alice',['createdAt'],403);
 await write(assetPath,{...asset,size:10485761},'alice',['createdAt'],403);
 await write(assetPath,asset,'alice',['createdAt']);
 await call('GET','/'+assetPath,null,null,403);await call('GET','/'+assetPath,null,'alice');
 await write(assetPath+'/chunks/00',{index:0,bytes},'bob',[],403);
 await write(assetPath+'/chunks/01',{index:0,bytes},'alice',[],403);
 await write(assetPath+'/chunks/00',{index:0,bytes:bytes.subarray(1)},'alice',[],403);
 await write(assetPath+'/chunks/00',{index:0,bytes},'alice');
 await call('GET','/'+assetPath+'/chunks/00',null,null,403);
 await call('PATCH','/'+assetPath+'?updateMask.fieldPaths=ready',{fields:fields({ready:true})},'bob',403);
 await call('PATCH','/'+assetPath+'?updateMask.fieldPaths=ready',{fields:fields({ready:true})},'alice');
 await call('GET','/'+assetPath,null,null);await call('GET','/'+assetPath+'/chunks/00',null,null);
 await write(assetPath+'/chunks/00',{index:0,bytes},'alice',[],403);
 await call('DELETE','/'+assetPath+'/chunks/00',null,'alice',403);
 await call('DELETE','/'+assetPath,null,'alice',403);
 const theme={accent:'#22c55e',bg:'#070709',cardBg:'#14141c',borderColor:'#22222e',textColor:'#f4f4f5',background:{kind:'asset',assetId,tint:55,blur:2,fit:'cover'},homepage:{order:['recent','welcome','stats','hot'],hidden:['stats'],columns:'4',hero:'compact'}};
 const code='shopcheck-'+assetId.slice(0,16),value={theme,ownerUid:'alice',shopName:'Local rules check',sharedBy:'Alice'};
 await write('themes/'+code,value,null,['publishedAt','updatedAt'],403);
 await write('themes/'+code,value,'alice',['publishedAt','updatedAt']);
 await call('GET','/themes/'+code,null,null);
 await write('themes/'+code,{...value,ownerUid:'bob'},'bob',['publishedAt','updatedAt'],403);
 await write('themes/'+code,{...value,theme:{...theme,homepage:{...theme.homepage,hidden:['stats','stats']}}},'alice',['publishedAt','updatedAt'],403);
 await write('themes/'+code,{...value,theme:{...theme,homepage:{...theme.homepage,order:['welcome','welcome','stats','hot']}}},'alice',['publishedAt','updatedAt'],403);
 await write('themes/'+code,{...value,theme:{...theme,background:{kind:'url',url:'javascript:alert(1)',tint:55,blur:2,fit:'cover'}}},'alice',['publishedAt','updatedAt'],403);
 await write('themes/'+code,{...value,theme:{...theme,background:{kind:'url',url:'https://user:password@example.com/a',tint:55,blur:2,fit:'cover'}}},'alice',['publishedAt','updatedAt'],403);
 await write('themes/'+code,{...value,theme:{...theme,background:{...theme.background,assetId:'b'.repeat(32)}}},'alice',['publishedAt','updatedAt'],403);
 await write('themes/'+code,{...value,theme:{...theme,background:{...theme.background,tint:91}}},'alice',['publishedAt','updatedAt'],403);
 await write('themes/'+code,{...value,theme:{...theme,background:{kind:'url',url:'https://images.example/a@2x.gif',tint:45,blur:0,fit:'contain'}}},'alice',['publishedAt','updatedAt']);
 const colors={...theme};delete colors.background;delete colors.homepage;
 await write('themes/'+code,{...value,theme:colors},'alice',['publishedAt','updatedAt']);
 await write('themes/flux-ocean',{...value,theme:colors},'alice',['publishedAt','updatedAt'],403);
 await call('DELETE','/themes/'+code,null,'bob',403);
 await call('DELETE','/themes/'+code,null,'alice');
 // Another creator can reference a ready, immutable public image.
 await write('themes/'+code+'-copy',{...value,ownerUid:'bob',sharedBy:'Bob'},'bob',['publishedAt','updatedAt']);
 console.log(checks+' theme sharing rules checks passed in the local emulator.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
