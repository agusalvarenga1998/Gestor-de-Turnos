import React, { useState } from 'react';
import { patientAccessAPI } from '../services/api';

export default function PatientAccess({ doctorId, documentNumber, onVerified }) {
  const [email, setEmail] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async () => {
    setBusy(true);
    try {
      if (!challengeId) {
        const data = await patientAccessAPI.request({ doctorId, documentNumber, email });
        setChallengeId(data.challengeId); setMessage(data.message);
      } else {
        const data = await patientAccessAPI.verify({ challengeId, code });
        await onVerified(data.accessToken);
      }
    } catch (error) { setMessage(error.response?.data?.message || 'No se pudo verificar. Intenta nuevamente.'); }
    finally { setBusy(false); }
  };
  return <section aria-label="Recuperar mis datos" style={{display:'grid',gap:12,margin:'16px 0'}}>
    <p>Recupera tus datos con un código enviado al email de tu ficha. Para reservar sin este paso, elige «Completar mis datos».</p>
    {!challengeId ? <label>Email de tu ficha<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} /></label>
      : <label>Código de seis dígitos<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} /></label>}
    <button type="button" onClick={submit} disabled={busy || (!challengeId ? !email || !documentNumber || !doctorId : code.length!==6)}>{busy ? 'Un momento…' : challengeId ? 'Verificar y continuar' : 'Recibir código'}</button>
    {challengeId && <button type="button" onClick={()=>{setChallengeId('');setCode('');}}>Cambiar email o solicitar otro código</button>}
    {message && <p role="status">{message}</p>}
  </section>;
}
