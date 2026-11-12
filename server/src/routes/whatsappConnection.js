import express from 'express';
import rateLimit from 'express-rate-limit';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { turnohubWhatsApp, encryptWhatsAppCredential, exchangeWhatsAppCode } from '../services/whatsappCloudConnection.js';

export function createWhatsAppConnectionRouter({verifyAdmin,repository,config,request}) {
  const router=express.Router();
  const pending=new Map();
  const frontend='https://turnohub.com.ar';
  const callback='https://api.turnohub.com.ar/api/whatsapp-connection/callback';
  const cookieName='__Host-turnohub_whatsapp_oauth';
  let busy=false;
  const ready=()=>!!config.appSecret && /^[a-f0-9]{64}$/i.test(config.encryptionKey || '');
  const cookieOptions={httpOnly:true,secure:true,sameSite:'lax',path:'/'};
  router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
  router.use(rateLimit({windowMs:60_000,limit:20,standardHeaders:'draft-7',legacyHeaders:false}));
  router.get('/status',verifyAdmin,async (_req,res)=>{
    try {const saved=await repository.status();res.json({configured:ready(),connected:!!saved,phone:'+54 9 376 540-9032',agentEnabled:false,connectedAt:saved?.connected_at || null,expiresAt:saved?.expires_at || null});}
    catch {res.status(503).json({error:'No se pudo consultar la conexión de WhatsApp.'});}
  });
  router.post('/start',verifyAdmin,(req,res)=>{
    if (req.get('origin')!==frontend || req.body?.acknowledgeCoexistence!==true) return res.sendStatus(403);
    if (!ready()) return res.status(503).json({error:'Falta configurar las credenciales de Meta en el servidor.'});
    if (busy) return res.status(409).json({error:'Hay una conexión en proceso.'});
    pending.clear();
    const state=randomBytes(32).toString('hex');
    pending.set(state,Date.now()+10*60_000);
    res.cookie(cookieName,state,{...cookieOptions,maxAge:10*60_000});
    const url=new URL('https://www.facebook.com/v27.0/dialog/oauth');
    url.search=new URLSearchParams({client_id:turnohubWhatsApp.appId,config_id:turnohubWhatsApp.configId,response_type:'code',override_default_response_type:'true',redirect_uri:callback,state,
      extras:JSON.stringify({setup:{},featureType:'whatsapp_business_app_onboarding',sessionInfoVersion:'3'})}).toString();
    res.json({url:url.href});
  });
  router.get('/callback',async (req,res)=>{
    const state=req.query.state;
    const cookie=(req.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1);
    const expiry=typeof state==='string'?pending.get(state):null;
    if (!expiry || expiry<Date.now() || typeof cookie!=='string' || Buffer.byteLength(cookie)!==Buffer.byteLength(state) || !timingSafeEqual(Buffer.from(cookie),Buffer.from(state))) return res.sendStatus(403);
    pending.delete(state);
    res.clearCookie(cookieName,cookieOptions);
    const redirect=result=>res.redirect(303,frontend+'/admin/whatsapp?connection='+result);
    if (req.query.error) return redirect('cancelled');
    if (!ready() || busy) return redirect('failed');
    busy=true;
    try {
      const value=await exchangeWhatsAppCode({code:req.query.code,appSecret:config.appSecret,redirectUri:callback,request});
      await repository.save({encryptedToken:encryptWhatsAppCredential(value.token,config.encryptionKey),phoneId:turnohubWhatsApp.phoneId,wabaId:turnohubWhatsApp.wabaId,expiresIn:value.expiresIn});
      return redirect('connected');
    } catch {
      // Do not log axios errors: they can contain the app secret and token.
      return redirect('failed');
    } finally {busy=false;}
  });
  return router;
}
