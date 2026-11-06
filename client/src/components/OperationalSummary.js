import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../services/api';
import styles from '../pages/ReceptionPage.module.css';

export default function OperationalSummary() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setData((await apiClient.get('/api/operations/summary')).data.summary); setError(''); }
    catch { setError('No pudimos actualizar los pendientes.'); }
  }, []);
  useEffect(() => { load(); const timer = setInterval(load, 30000); return () => clearInterval(timer); }, [load]);
  return <section className={styles.card} aria-label="Hoy y pendientes"><h2>Hoy y pendientes</h2>
    {error && <p role="alert">{error} <button onClick={load}>Reintentar</button></p>}
    {data ? <>
      <div className={styles.toolbar}>
        <Link to="/appointments?tab=pending">{data.awaiting_confirmation} solicitudes por confirmar</Link>
        <Link to="/appointments">{data.scheduled_today} turnos confirmados hoy</Link>
        <Link to="/appointments">{data.awaiting_closure} atenciones por cerrar</Link>
        <Link to="/queue">{data.waiting_now || 0} personas en la fila</Link>
        <Link to="/operations?tab=payments">{data.awaiting_payment} pagos pendientes</Link>
        <Link to="/operations?tab=notifications">{data.failed} avisos fallidos o vencidos</Link>
        <Link to="/operations?tab=waitlist">{data.waiting} pacientes en lista de espera</Link>
      </div>
      <p>Saldo pendiente total: {Number(data.outstanding || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
      {data.nextAppointments?.length > 0 && <><h3>Próximos turnos confirmados</h3><ul>{data.nextAppointments.map(appointment => <li key={appointment.id}>{appointment.appointment_date} · {appointment.appointment_time.slice(0, 5)} · {appointment.patient_name}</li>)}</ul></>}
    </> : !error && <p>Cargando pendientes…</p>}
  </section>;
}
