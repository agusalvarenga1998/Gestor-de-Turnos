import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../services/api';
import Icon from './Icon';
import styles from './OperationalSummary.module.css';

const metrics = [
  ['awaiting_confirmation', 'Solicitudes por confirmar', '/appointments?tab=pending', 'clock', 'amber'],
  ['scheduled_today', 'Turnos confirmados hoy', '/appointments', 'calendar', 'blue'],
  ['awaiting_closure', 'Atenciones por cerrar', '/appointments', 'clock', 'amber'],
  ['waiting_now', 'Personas en la fila', '/queue', 'users', 'teal'],
  ['awaiting_payment', 'Pagos pendientes', '/operations?tab=payments', 'reports', 'amber'],
  ['failed', 'Avisos fallidos o vencidos', '/operations?tab=notifications', 'refresh', 'rose'],
  ['waiting', 'Pacientes en lista de espera', '/operations?tab=waitlist', 'users', 'blue'],
];

export default function OperationalSummary() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setData((await apiClient.get('/api/operations/summary')).data.summary); setError(''); }
    catch { setError('No pudimos actualizar los pendientes.'); }
  }, []);
  useEffect(() => { load(); const timer = setInterval(load, 30000); return () => clearInterval(timer); }, [load]);
  return <section className={styles.summary} aria-label="Hoy y pendientes">
    <header className={styles.header}><div><span className={styles.eyebrow}>TU CONSULTORIO, DE UN VISTAZO</span><h2>Hoy y pendientes</h2><p>Accedé a cada sección para ver el detalle.</p></div><span className={styles.live}>Actualización cada 30 s</span></header>
    {error && <p className={styles.error} role="alert">{error} <button onClick={load}>Reintentar</button></p>}
    {data ? <>
      <div className={styles.grid}>
        {metrics.map(([key, label, to, icon, tone]) => <Link key={key} to={to} className={`${styles.metric} ${styles[tone]}`}>
          <span className={styles.metricTop}><span className={styles.icon} aria-hidden="true"><Icon name={icon} size={19} /></span><span className={styles.arrow} aria-hidden="true">↗</span></span>
          <strong className={styles.value}>{data[key] || 0}</strong><span className={styles.label}>{label}</span>
        </Link>)}
        <Link to="/operations?tab=payments" className={styles.balance}><span className={styles.balanceLabel}>Saldo pendiente total</span><strong>{Number(data.outstanding || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong><span className={styles.balanceAction}>Revisar pagos <span aria-hidden="true">→</span></span></Link>
      </div>
      {data.nextAppointments?.length > 0 && <div className={styles.upcoming}><h3>Próximos turnos confirmados</h3><ul>{data.nextAppointments.map(appointment => <li key={appointment.id}><span className={styles.time}>{appointment.appointment_time.slice(0, 5)}</span><strong>{appointment.patient_name}</strong><span className={styles.date}>{String(appointment.appointment_date).split('T')[0].split('-').reverse().join('/')}</span></li>)}</ul></div>}
    </> : !error && <p className={styles.loading} role="status">Cargando pendientes…</p>}
  </section>;
}
