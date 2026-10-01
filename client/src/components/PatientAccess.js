import React, { useState } from 'react';
import { patientAccessAPI } from '../services/api';
import styles from './PatientAccess.module.css';

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
  return <section aria-label="Recuperar mis datos" className={styles.accessBox}>
    <p className={styles.helpText}>Recuperá tus datos con un código enviado al email de tu ficha. Para reservar sin este paso, elegí “Completar mis datos”.</p>
    <div className={styles.accessGrid}>
      {!challengeId ? (
        <label className={styles.field}>
          <span>Email de tu ficha</span>
          <input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nombre@email.com" />
        </label>
      ) : (
        <label className={styles.field}>
          <span>Código de seis dígitos</span>
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} placeholder="123456" />
        </label>
      )}
      <button className={styles.primaryButton} type="button" onClick={submit} disabled={busy || (!challengeId ? !email || !documentNumber || !doctorId : code.length!==6)}>{busy ? 'Un momento...' : challengeId ? 'Verificar y continuar' : 'Recibir código'}</button>
    </div>
    {challengeId && <button className={styles.secondaryButton} type="button" onClick={()=>{setChallengeId('');setCode('');}}>Cambiar email o solicitar otro código</button>}
    {message && <p className={styles.status} role="status">{message}</p>}
  </section>;
}
