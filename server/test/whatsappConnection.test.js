import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { createDecipheriv } from 'node:crypto';
import express from 'express';
import { createWhatsAppConnectionRouter } from '../src/routes/whatsappConnection.js';
import { encryptWhatsAppCredential,turnohubWhatsApp } from '../src/services/whatsappCloudConnection.js';

const key='a'.repeat(64);
function call(url,{method='GET',headers={},body}={}){
  return new Promise((resolve,reject)=>{
    const req=httpRequest(url,{method,headers},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})));});
    req.on('error',reject);req.end(body);
  });
}
async function fixture(t,{wrongPhone=false}={}){
  const saved=[];let apiCalls=0;
  const app=express();app.use(express.json());
  app.use(createWhatsAppConnectionRouter({config:{appSecret:'private-app-secret',encryptionKey:key},
    verifyAdmin:(req,res,next)=>req.get('authorization')==='Bearer admin'?next():res.sendStatus(401),
    repository:{status:async()=>saved.length?{connected_at:'today',encrypted_token:'never-return-this'}:null,save:async v=>saved.push(v)},
    request:{get:async(url,options)=>{
      apiCalls++;
      if(url.endsWith('/oauth/access_token')){assert.equal(options.params.redirect_uri,'https://api.turnohub.com.ar/api/whatsapp-connection/callback');return {data:{access_token:'private-token',expires_in:3600}};}
      if(url.endsWith('/phone_numbers'))return {data:{data:[{id:wrongPhone?'other':turnohubWhatsApp.phoneId,display_phone_number:'+54 9 376 540-9032'}]}};
      return {data:{is_on_biz_app:true,platform_type:'CLOUD_API'}};
    }}
  }));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  return {saved,calls:()=>apiCalls,get:path=>call(base+path),start:(headers={},ack=true)=>call(base+'/start',{method:'POST',headers:{authorization:'Bearer admin',origin:'https://turnohub.com.ar','content-type':'application/json',...headers},body:JSON.stringify({acknowledgeCoexistence:ack})}),
    callback:(state,cookie)=>call(base+'/callback?state='+encodeURIComponent(state)+'&code=valid-code-12345',{headers:{cookie}}),status:()=>call(base+'/status',{headers:{authorization:'Bearer admin'}})};
}

test('credentials are encrypted with authenticated encryption and fresh IVs',()=>{
  const a=encryptWhatsAppCredential('private-token',key),b=encryptWhatsAppCredential('private-token',key);
  assert.notEqual(a,b);assert.doesNotMatch(a,/private-token/);
  const value=JSON.parse(a),decipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),Buffer.from(value.iv,'base64'));
  decipher.setAuthTag(Buffer.from(value.tag,'base64'));
  assert.equal(Buffer.concat([decipher.update(Buffer.from(value.data,'base64')),decipher.final()]).toString(),'private-token');
  assert.throws(()=>encryptWhatsAppCredential('private-token','invalid'));
});

test('only an authenticated admin on the production origin can initiate the flow',async t=>{
  const f=await fixture(t);
  assert.equal((await f.get('/status')).status,401);
  assert.equal((await f.start({authorization:'Bearer doctor'})).status,401);
  assert.equal((await f.start({origin:'https://attacker.example'})).status,403);
  assert.equal((await f.start({},false)).status,403);
  assert.equal(f.calls(),0);
});

test('OAuth callback requires its initiating browser cookie and one-use state',async t=>{
  const f=await fixture(t);
  const start=await f.start();const cookie=start.headers.get('set-cookie').split(';')[0];
  assert.match(start.headers.get('set-cookie'),/HttpOnly/);assert.match(start.headers.get('set-cookie'),/Secure/);
  const url=new URL((await start.json()).url),state=url.searchParams.get('state');
  assert.equal(url.origin,'https://www.facebook.com');assert.equal(url.searchParams.get('config_id'),turnohubWhatsApp.configId);
  assert.equal((await f.callback(state,'')).status,403);
  assert.equal((await f.callback(state,'__Host-turnohub_whatsapp_oauth='+'é'.repeat(64))).status,403);
  const result=await f.callback(state,cookie);
  assert.equal(result.status,303);assert.match(result.headers.get('location'),/connection=connected$/);
  assert.equal(f.saved.length,1);assert.doesNotMatch(f.saved[0].encryptedToken,/private-token/);
  assert.equal((await f.callback(state,cookie)).status,403);
  const status=await f.status();const body=await status.text();assert.doesNotMatch(body,/private-token|encrypted_token|never-return/);assert.match(body,/"agentEnabled":false/);
});

test('unexpected phone cannot be persisted even after OAuth success',async t=>{
  const f=await fixture(t,{wrongPhone:true});const start=await f.start();const cookie=start.headers.get('set-cookie').split(';')[0];
  const state=new URL((await start.json()).url).searchParams.get('state');
  const result=await f.callback(state,cookie);
  assert.match(result.headers.get('location'),/connection=failed$/);assert.equal(f.saved.length,0);
});
