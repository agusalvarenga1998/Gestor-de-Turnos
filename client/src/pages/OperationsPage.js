import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useAdminAuth } from '../hooks/useAdminAuth';
import DoctorLayout from '../components/DoctorLayout';
import AdminLayout from '../components/AdminLayout';
import OperationalSummary from '../components/OperationalSummary';
import styles from './ReceptionPage.module.css';
import { appointmentStatusInfo, appointmentPaymentInfo } from '../utils/appointmentState';

const dateText = value => value ? new Date(value).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : '—';
const outcomes = { applied: 'Pago aplicado', already_applied: 'Ya estaba aplicado', pending: 'Sin acreditación aprobada', needs_review: 'Requiere revisión; sin cambios automáticos', refund_confirmed: 'Devolución total confirmada por Mercado Pago', partial_refund_confirmed: 'Devolución parcial confirmada por Mercado Pago' };
const states = { pending: 'En cola', processing: 'En proceso', sent: 'Aceptado por el servidor de correo', failed: 'Fallido', expired: 'Vencido' };
const categories = { appointment: 'Turno', reminder: 'Recordatorio', waitlist: 'Lista de espera', reschedule: 'Reprogramación', plan_request: 'Activación de plan', general: 'Aviso general' };
const deliveryErrors = { EAUTH: 'Revisar la cuenta de envío', EENVELOPE: 'Destinatario rechazado', ETIMEDOUT: 'El servidor tardó demasiado', ECONNECTION: 'Sin conexión al correo', DELIVERY_FAILED: 'No se pudo entregar' };

export default function OperationsPage({ admin = false }) {
  const doctor = useAuth(); const administrator = useAdminAuth();
  const token = admin ? administrator.token : doctor.token;
  const [params, setParams] = useSearchParams();
  const allowedTabs = admin ? ['notifications', 'payments', 'backups'] : ['overview', 'waitlist', 'notifications', 'payments'];
  const tab = allowedTabs.includes(params.get('tab')) ? params.get('tab') : allowedTabs[0];
  const [data, setData] = useState({});
  const [options, setOptions] = useState({ patients: [], services: [] });
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState({ patientId: '', serviceId: '', dateFrom: '', dateTo: '', consent: false });
  const [slot, setSlot] = useState({ date: '', time: '', serviceId: '' });
  const requestVersion = useRef(0);
  const prefix = `/api/operations${admin ? '/admin' : ''}`;
  const headers = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const load = useCallback(async () => {
    if (tab === 'overview') return;
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const endpoint = tab === 'payments' ? 'reconciliation' : tab;
      const response = await axios.get(`${API_BASE_URL}${prefix}/${endpoint}`, { headers: headers() });
      const choices = tab === 'waitlist' ? (await axios.get(`${API_BASE_URL}${prefix}/waitlist/options`, { headers: headers() })).data : null;
      if (version !== requestVersion.current) return;
      setData(response.data); setError(''); if (choices) setOptions(choices);
    } catch (err) { if (version === requestVersion.current) setError(err.response?.data?.message || 'No pudimos cargar el panel.'); }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, [tab, prefix, headers]);
  useEffect(() => { setData({}); setNotice(''); load(); const timer = setInterval(load, 30000); return () => { clearInterval(timer); requestVersion.current++; }; }, [load]);
  const act = async (method, endpoint, body) => {
    if (busy) return; setBusy(true); setNotice(''); setError('');
    try {
      const response = await axios({ method, url: `${API_BASE_URL}${prefix}/${endpoint}`, data: body, headers: headers() });
      setNotice(response.data.message || (response.data.count != null ? `${response.data.count} avisos guardados para enviar.` : 'Cambio guardado.'));
      await load();
    } catch (err) { setError(err.response?.data?.message || 'No pudimos confirmar la operación. Actualizá antes de reintentar.'); }
    finally { setBusy(false); }
  };
  const Layout = admin ? AdminLayout : DoctorLayout;
  return <Layout><main className={styles.page}><h1>Operaciones y seguimiento</h1>
    <nav className={styles.toolbar}>{allowedTabs.map(value => <button key={value} aria-pressed={value === tab} onClick={() => setParams({ tab: value })}>{({ overview: 'Hoy y pendientes', waitlist: 'Lista de espera', notifications: 'Seguimiento de correos', payments: 'Conciliar pagos', backups: 'Respaldos' })[value]}</button>)}</nav>
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status">{notice}</p>}
    {tab !== 'overview' && <button disabled={busy || loading} onClick={load}>Actualizar</button>}
    {loading && <p role="status">Actualizando datos…</p>}
    {tab === 'overview' && <OperationalSummary />}
    {tab === 'waitlist' && <>
      <form className={styles.card} onSubmit={event => { event.preventDefault(); act('post', 'waitlist', wait); }}><h2>Anotar paciente interesado</h2>
        <p>Esta lista es para cubrir horarios liberados; no reserva un turno ni reemplaza la fila presencial.</p>
        <label>Paciente con email<select required value={wait.patientId} onChange={event => setWait({ ...wait, patientId: event.target.value })}><option value="">Seleccionar</option>{options.patients.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Servicio<select value={wait.serviceId} onChange={event => setWait({ ...wait, serviceId: event.target.value })}><option value="">Cualquier consulta disponible</option>{options.services.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Desde<input type="date" required value={wait.dateFrom} onChange={event => setWait({ ...wait, dateFrom: event.target.value })} /></label><label>Hasta<input type="date" required min={wait.dateFrom} value={wait.dateTo} onChange={event => setWait({ ...wait, dateTo: event.target.value })} /></label>
        <label><input type="checkbox" required checked={wait.consent} onChange={event => setWait({ ...wait, consent: event.target.checked })} />El paciente pidió recibir avisos por email cuando se libere un horario.</label><button disabled={busy || loading}>Agregar a la lista</button>
      </form>
      <form className={styles.card} onSubmit={event => { event.preventDefault(); act('post', 'waitlist/notify-slot', slot); }}><h2>Avisar de un horario libre</h2><p>Las cancelaciones y reprogramaciones también generan avisos automáticamente. Cada interesado recibe un solo aviso por horario.</p><label>Fecha<input type="date" required value={slot.date} onChange={event => setSlot({ ...slot, date: event.target.value })} /></label><label>Hora<input type="time" required value={slot.time} onChange={event => setSlot({ ...slot, time: event.target.value })} /></label><label>Servicio<select value={slot.serviceId} onChange={event => setSlot({ ...slot, serviceId: event.target.value })}><option value="">Consulta general</option>{options.services.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button disabled={busy || loading}>Avisar a interesados compatibles</button></form>
      <section className={styles.card}><h2>Pacientes en espera</h2>{!data.entries?.length && <p>No hay registros.</p>}{data.entries?.map(entry => <article key={entry.id}><strong>{entry.patient_name}</strong><p>{entry.service_name || 'Consulta general'} · {entry.date_from} a {entry.date_to} · {({ waiting: 'En espera', booked: 'Ya reservó', cancelled: 'Retirado' })[entry.status]}</p><p>Último aviso: {dateText(entry.last_notified_at)}</p>{entry.status === 'waiting' && <div className={styles.toolbar}><button disabled={busy || loading} onClick={() => act('patch', `waitlist/${entry.id}`, { status: 'booked' })}>Marcar que ya reservó</button><button disabled={busy || loading} onClick={() => act('patch', `waitlist/${entry.id}`, { status: 'cancelled' })}>Retirar de la lista</button></div>}</article>)}</section>
    </>}
    {tab === 'notifications' && <section className={styles.card}><h2>Seguimiento de correos</h2>{data.workerEnabled === false && <p role="alert">El envío automático está desactivado en el servidor. Los avisos quedarán en cola hasta habilitarlo.</p>}<p>“Aceptado por el servidor” confirma la aceptación SMTP, no la lectura ni la llegada a la bandeja del destinatario. Solo se reintentan avisos vigentes con contenido disponible, hasta tres veces manualmente. Los códigos de acceso no se reenvían desde este panel.</p><div className={styles.scroll}><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Destinatario</th><th>Estado</th><th>Intentos</th><th>Acción</th></tr></thead><tbody>{data.jobs?.map(job => <tr key={job.id}><td>{dateText(job.created_at)}</td><td>{categories[job.category] || 'Aviso'}</td><td>{job.recipient_hint || 'Reservado'}</td><td>{states[job.status] || job.status}{job.error_code && <small>{deliveryErrors[job.error_code] || 'No se pudo entregar'}{admin ? ` (${job.error_code})` : ''}</small>}</td><td>{job.attempts}</td><td>{job.can_retry && <button disabled={busy || loading} onClick={() => act('post', `notifications/${job.id}/retry`, {})}>Reintentar</button>}</td></tr>)}</tbody></table></div>{data.jobs?.length === 0 && <p>No hay avisos registrados en este alcance. Los avisos antiguos sin profesional asociado los ve administración.</p>}</section>}
    {tab === 'payments' && <section className={styles.card}><h2>{admin ? 'Conciliar pagos de suscripciones' : 'Conciliar pagos de turnos'}</h2><p>Consultar no cobra ni devuelve dinero. Un “reembolso” en Caja es un movimiento contable; la devolución real se confirma consultando a Mercado Pago. Un pago tardío sobre un turno cancelado requiere revisión y no reactiva el turno.</p><div className={styles.scroll}><table><thead><tr><th>{admin ? 'Profesional y solicitud' : 'Paciente y turno'}</th><th>Estado</th><th>Reembolsos en Caja</th><th>Última consulta a Mercado Pago</th><th>Acción</th></tr></thead><tbody>{data.items?.map(item => <tr key={item.id}><td>{item.patient_name}<small>{admin ? dateText(item.created_at) : `${item.appointment_date} ${item.appointment_time.slice(0, 5)}`}</small></td><td>{admin ? ({ pending: 'Solicitud pendiente', approved: 'Solicitud aprobada', rejected: 'Solicitud rechazada' })[item.status] || 'En revisión' : <>{appointmentStatusInfo(item).label}<small>{appointmentPaymentInfo(item).label}</small></>}</td><td>{item.recorded_refunds} registros; no prueban devolución bancaria</td><td>{outcomes[item.outcome] || 'Sin consultar'}{item.provider_status && <small>Estado del proveedor: {item.provider_status}</small>}<small>{dateText(item.checked_at)}</small>{Number(item.refunded_amount) > 0 && <small>Devuelto por proveedor: {Number(item.refunded_amount).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</small>}</td><td><button disabled={busy || loading} onClick={() => act('post', `reconciliation/${item.id}/check`, {})}>Consultar y conciliar</button></td></tr>)}</tbody></table></div>{data.items?.length === 0 && <p>No hay pagos online para revisar.</p>}</section>}
    {tab === 'backups' && data.status && <section className={styles.card}><h2>Respaldo y restauración</h2>{!data.status.configured ? <p>{data.status.message}</p> : <><p>Última copia: {dateText(data.status.createdAt)}{data.status.stale && ' · ATENCIÓN: copia ausente o con más de 36 horas'}</p><p>Restauración en base aislada: {data.status.databaseRestoreVerified ? 'Verificada' : 'Sin verificar'}</p><p>Adjuntos restaurados: {data.status.attachmentsVerified ? 'Verificados' : 'Sin verificar'}</p><p>Fecha de verificación: {dateText(data.status.verifiedAt)}</p>{data.status.lastAttemptFailed && <p role="alert">El último intento de respaldo o verificación falló.</p>}</>}<p>La copia y la prueba se ejecutan con las herramientas de servidor documentadas en MEJORAS_OPERATIVAS.md. Este panel no restaura ni sobrescribe producción.</p></section>}
  </main></Layout>;
}
