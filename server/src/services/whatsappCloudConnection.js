import axios from 'axios';
import { createCipheriv, randomBytes } from 'node:crypto';

export const turnohubWhatsApp = Object.freeze({appId:'1000507209466486',configId:'2169602726971150',wabaId:'1386563540070943',phoneId:'1209142092286742',phone:'5493765409032'});

export function encryptWhatsAppCredential(token, hexKey) {
  if (!/^[a-f0-9]{64}$/i.test(hexKey || '')) throw new Error('Missing encryption key');
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',Buffer.from(hexKey,'hex'),iv);
  const encrypted=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
  return JSON.stringify({version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')});
}

export async function exchangeWhatsAppCode({code,appSecret,redirectUri,request=axios}) {
  if (typeof code!=='string' || code.length<10 || code.length>4096 || /[\r\n]/.test(code)) throw new Error('Invalid code');
  const graph='https://graph.facebook.com/v27.0';
  const response=await request.get(`${graph}/oauth/access_token`,{params:{client_id:turnohubWhatsApp.appId,client_secret:appSecret,redirect_uri:redirectUri,code},timeout:12_000});
  const token=response.data?.access_token;
  if (typeof token!=='string' || !token) throw new Error('Missing token');
  const options={headers:{Authorization:`Bearer ${token}`},timeout:12_000};
  const phones=await request.get(`${graph}/${turnohubWhatsApp.wabaId}/phone_numbers`,{...options,params:{fields:'id,display_phone_number',limit:100}});
  const phone=phones.data?.data?.find(p=>p.id===turnohubWhatsApp.phoneId);
  if (!phone || String(phone.display_phone_number).replace(/\D/g,'')!==turnohubWhatsApp.phone) throw new Error('Unexpected phone');
  const platform=await request.get(`${graph}/${turnohubWhatsApp.phoneId}`,{...options,params:{fields:'is_on_biz_app,platform_type'}});
  if (platform.data?.is_on_biz_app!==true || platform.data?.platform_type!=='CLOUD_API') throw new Error('Coexistence not confirmed');
  return {token,expiresIn:Number(response.data.expires_in)>0?Number(response.data.expires_in):null};
}
