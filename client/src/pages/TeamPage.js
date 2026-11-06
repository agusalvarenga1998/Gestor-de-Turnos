import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../services/api';
import DoctorLayout from '../components/DoctorLayout';
import styles from './ReceptionPage.module.css';

export default function TeamPage() {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [reset, setReset] = useState({ id: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    try { setAccounts((await apiClient.get('/api/reception/accounts')).data.accounts); }
    catch (err) { setError(err.response?.data?.message || 'No pudimos cargar el equipo.'); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const save = async event => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await apiClient.post('/api/reception/accounts', form); setForm({ name: '', email: '', password: '' });
      setNotice('Cuenta creada. Compartí las credenciales de forma privada con la persona responsable.'); await load();
    } catch (err) { setError(err.response?.data?.message || 'No pudimos crear la cuenta.'); }
    finally { setBusy(false); }
  };
  const update = async (id, data) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await apiClient.patch(`/api/reception/accounts/${id}`, data); setReset({ id: '', password: '' });
      setNotice('Acceso actualizado. Las sesiones anteriores de esta cuenta quedaron revocadas.'); await load();
    } catch (err) { setError(err.response?.data?.message || 'No pudimos actualizar el acceso.'); }
    finally { setBusy(false); }
  };
  return <DoctorLayout><main className={styles.page}>
    <h1>Equipo y recepción</h1><p>Creá cuentas propias para consultar la agenda, reservar turnos y registrar saldos recibidos. No acceden a historias clínicas, seguridad ni suscripciones.</p>
    <Link to="/reception">Abrir acceso de recepción</Link>
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status">{notice}</p>}
    <form onSubmit={save} className={styles.card}><h2>Nueva cuenta</h2>
      <label>Nombre<input required maxLength={100} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
      <label>Email de recepción<input type="email" required value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} autoComplete="off" /></label>
      <label>Contraseña para esta cuenta<input type="password" required minLength={10} maxLength={72} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} autoComplete="new-password" /></label>
      <button disabled={busy}>Crear cuenta</button>
    </form>
    <section className={styles.card}><h2>Accesos del consultorio</h2>{accounts.length === 0 && <p>Todavía no creaste cuentas de recepción.</p>}
      {accounts.map(account => <article key={account.id}><strong>{account.name}</strong><p>{account.email} · {account.is_active ? 'Activo' : 'Desactivado'}</p><div className={styles.toolbar}>
        <button disabled={busy} onClick={() => update(account.id, { is_active: !account.is_active })}>{account.is_active ? 'Desactivar acceso' : 'Reactivar acceso'}</button>
        <button disabled={busy} onClick={() => setReset({ id: account.id, password: '' })}>Restablecer contraseña</button>
      </div>{reset.id === account.id && <form onSubmit={event => { event.preventDefault(); update(account.id, { password: reset.password }); }}><label>Nueva contraseña<input type="password" required minLength={10} maxLength={72} autoComplete="new-password" value={reset.password} onChange={event => setReset({ ...reset, password: event.target.value })} /></label><button disabled={busy}>Guardar contraseña</button></form>}</article>)}
    </section>
  </main></DoctorLayout>;
}
