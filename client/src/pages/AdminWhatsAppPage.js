import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AdminLayout from '../components/AdminLayout';
import { useAdminAuth } from '../hooks/useAdminAuth';

const api=process.env.REACT_APP_API_BASE_URL || '';
export default function AdminWhatsAppPage(){
  const {token}=useAdminAuth();
  const [status,setStatus]=useState(null),[error,setError]=useState(''),[accepted,setAccepted]=useState(false),[busy,setBusy]=useState(false);
  useEffect(()=>{
    axios.get(api+'/api/whatsapp-connection/status',{headers:{Authorization:'Bearer '+token}}).then(r=>setStatus(r.data)).catch(()=>setError('No pudimos consultar la conexión. Volvé a intentarlo más tarde.'));
  },[token]);
  const connect=async()=>{
    setBusy(true);setError('');
    try {
      const r=await axios.post(api+'/api/whatsapp-connection/start',{acknowledgeCoexistence:accepted},{headers:{Authorization:'Bearer '+token},withCredentials:true});
      const target=new URL(r.data.url);
      if(target.origin!=='https://www.facebook.com') throw new Error('Invalid destination');
      window.location.assign(target.href);
    }catch(e){setError(e.response?.data?.error || 'No pudimos abrir la conexión con Meta.');setBusy(false);}
  };
  const result=new URLSearchParams(window.location.search).get('connection');
  return <AdminLayout><section style={{maxWidth:760,margin:'24px auto',padding:24}}>
    <h1>WhatsApp de TurnoHub</h1><p>Conectá el número oficial +54 9 376 540-9032 para atender las consultas de tus profesionales.</p>
    {error && <p role="alert">{error}</p>}
    {result==='cancelled' && <p role="status">Se canceló la autorización en Meta.</p>}
    {result==='failed' && <p role="alert">No se pudo verificar y guardar la conexión. El agente no se activó.</p>}
    {!status && !error && <p role="status">Consultando conexión…</p>}
    {status && <>
      <p><strong>{status.connected?'Número vinculado':'Número pendiente de vinculación'}</strong></p>
      <p>El agente automático permanece desactivado. Esta vinculación no envía mensajes ni importa el historial de chats.</p>
      {!status.configured && <p role="status">Falta completar la configuración privada de Meta en el servidor.</p>}
      <p>En Meta, elegí el negocio <strong>Turno Hub</strong>, su cuenta existente y la opción de seguir usando WhatsApp Business. No crees otra cuenta ni elimines la actual.</p>
      <p>Meta puede desvincular dispositivos adicionales y cambiar funciones como listas de difusión o mensajes temporales. Revisá sus avisos antes de confirmar. No compartas el historial de chats durante este paso.</p>
      <label style={{display:'block',margin:'20px 0'}}><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/> Entiendo los cambios de coexistencia y quiero abrir la autorización de Meta.</label>
      <button type="button" disabled={!status.configured || !accepted || busy} onClick={connect} style={{padding:'14px 20px',cursor:'pointer'}}>{busy?'Abriendo Meta…':status.connected?'Volver a vincular con Meta':'Conectar con Meta'}</button>
    </>}
  </section></AdminLayout>;
}
