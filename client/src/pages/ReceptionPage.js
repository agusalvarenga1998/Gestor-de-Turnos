import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../services/api';
import { appointmentStatusInfo, appointmentPaymentInfo } from '../utils/appointmentState';
import styles from './ReceptionPage.module.css';

export default function ReceptionPage() {
  const [token, setToken] = useState(localStorage.getItem('receptionToken') || '');
  const [session, setSession] = useState(null);
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [date, setDate] = useState(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date()));
  const [appointments, setAppointments] = useState([]);
  const [bookingData, setBookingData] = useState({ patients: [], services: [] });
  const [booking, setBooking] = useState({ patientId: '', serviceId: '', appointment_time: '' });
  const [method, setMethod] = useState('efectivo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [agendaLoading, setAgendaLoading] = useState(false);
  const requestVersion = useRef(0);
  const headers = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setAgendaLoading(true);
    try {
      const options = { headers: headers() };
      const [identity, agenda, data] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/reception/session`, options),
        axios.get(`${API_BASE_URL}/api/reception/appointments`, { ...options, params: { date } }),
        axios.get(`${API_BASE_URL}/api/reception/booking-data`, options)
      ]);
      if (version !== requestVersion.current) return;
      setSession(identity.data);
      setAppointments(agenda.data.appointments);
      setBookingData(data.data);
      setError('');
    } catch (err) {
      if (version !== requestVersion.current) return;
      if (err.response?.status === 401) { localStorage.removeItem('receptionToken'); setToken(''); setSession(null); setAppointments([]); setBookingData({ patients: [], services: [] }); }
      setError(err.response?.data?.message || 'No pudimos actualizar la agenda. Reintentá antes de operar.');
    } finally { if (version === requestVersion.current) setAgendaLoading(false); }
  }, [date, headers]);
  useEffect(() => {
    if (!token) return;
    load();
    const timer = setInterval(load, 30000);
    return () => { clearInterval(timer); requestVersion.current++; };
  }, [token, load]);
  const login = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await axios.post(`${API_BASE_URL}/api/reception/login`, credentials);
      localStorage.setItem('receptionToken', response.data.token); setToken(response.data.token); setCredentials({ email: '', password: '' });
    } catch (err) { setError(err.response?.data?.message || 'No pudimos iniciar sesión.'); }
    finally { setBusy(false); }
  };
  const book = async event => {
    event.preventDefault(); setBusy(true); setNotice('');
    try {
      await axios.post(`${API_BASE_URL}/api/reception/appointments`, { ...booking, appointment_date: date }, { headers: headers() });
      setNotice('Turno reservado.'); setBooking({ patientId: '', serviceId: '', appointment_time: '' }); await load();
    } catch (err) { setError(err.response?.data?.message || 'No pudimos guardar. Actualizá la agenda antes de reintentar.'); }
    finally { setBusy(false); }
  };
  const collect = async appointment => {
    const amount = Math.round(Math.max(0, Number(appointment.total_price || 0) - Number(appointment.booking_fee_paid || 0) - Number(appointment.coverage_amount || 0)) * 100) / 100;
    if (!window.confirm(`¿Confirmás que recibiste ${amount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })} de ${appointment.patient_name} por ${method}?`)) return;
    setBusy(true); setNotice('');
    try {
      await axios.post(`${API_BASE_URL}/api/reception/appointments/${appointment.id}/collect`, { method, amount }, { headers: headers() });
      setNotice('Cobro registrado.'); await load();
    } catch (err) { setError(err.response?.data?.message || 'No pudimos confirmar el cobro. Actualizá antes de reintentar.'); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    setBusy(true);
    try {
      await axios.post(`${API_BASE_URL}/api/reception/logout`, {}, { headers: headers() });
    } catch (err) { setError('Sesión cerrada en este navegador. No pudimos revocarla en el servidor.'); }
    finally { requestVersion.current++; localStorage.removeItem('receptionToken'); setToken(''); setSession(null); setAppointments([]); setBookingData({ patients: [], services: [] }); setBusy(false); }
  };
  return <main className={styles.page}>
    <header><h1>Recepción</h1><p>{session ? `${session.name} · ${session.doctorName}` : 'Ingresá con la cuenta que te asignó el profesional.'}</p></header>
    {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!token ? <form onSubmit={login} className={styles.card}>
      <label>Email<input type="email" required value={credentials.email} onChange={event => setCredentials({ ...credentials, email: event.target.value })} autoComplete="username" /></label>
      <label>Contraseña<input type="password" required value={credentials.password} onChange={event => setCredentials({ ...credentials, password: event.target.value })} autoComplete="current-password" /></label>
      <button disabled={busy}>Ingresar</button><p>Si olvidaste tu contraseña, pedile al profesional que la restablezca.</p><Link to="/login">Acceso de profesionales</Link>
    </form> : <>
      <div className={styles.toolbar}><label>Fecha de la agenda<input type="date" required value={date} onChange={event => setDate(event.target.value)} /></label><button onClick={load} disabled={busy}>Actualizar</button><button onClick={logout} disabled={busy}>Cerrar sesión</button></div>
      {session && <>
        <form onSubmit={book} className={styles.card}>
          <h2>Reservar un turno</h2><p>Los pacientes y servicios los administra el profesional. El horario se valida al guardar.</p>
          <label>Paciente<select required value={booking.patientId} onChange={event => setBooking({ ...booking, patientId: event.target.value })}><option value="">Seleccionar paciente</option>{bookingData.patients.map(patient => <option key={patient.id} value={patient.id}>{patient.name}{patient.phone ? ` · ${patient.phone}` : ''}</option>)}</select></label>
          <label>Servicio<select required value={booking.serviceId} onChange={event => setBooking({ ...booking, serviceId: event.target.value })}><option value="">Seleccionar servicio</option>{bookingData.services.map(service => <option key={service.id} value={service.id}>{service.name} · {service.duration_minutes} min</option>)}</select></label>
          <label>Hora (Argentina)<input type="time" required value={booking.appointment_time} onChange={event => setBooking({ ...booking, appointment_time: event.target.value })} /></label>
          <button disabled={busy || agendaLoading || !!error}>Reservar para el {date}</button>
        </form>
        <section className={styles.card}><h2>Agenda y cobros</h2><label>Medio para registrar el saldo<select value={method} onChange={event => setMethod(event.target.value)}><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option></select></label>
          {agendaLoading && <p role="status">Actualizando agenda…</p>}
          <p>Registrá un cobro solo después de recibir el dinero. Cancelar un turno o devolver un pago lo gestiona el profesional.</p>
          <div className={styles.scroll}><table><thead><tr><th>Hora</th><th>Paciente</th><th>Servicio</th><th>Turno</th><th>Pago</th><th>Saldo</th><th>Acción</th></tr></thead><tbody>{appointments.map(appointment => {
            const balance = appointment.payment_status === 'paid' ? 0 : Math.max(0, Number(appointment.total_price || 0) - Number(appointment.booking_fee_paid || 0) - Number(appointment.coverage_amount || 0));
            return <tr key={appointment.id}><td>{appointment.appointment_time.slice(0, 5)}</td><td>{appointment.patient_name}<small>{appointment.patient_phone}</small></td><td>{appointment.service_name || 'Consulta'}</td><td>{appointmentStatusInfo(appointment).label}</td><td>{appointmentPaymentInfo(appointment).label}</td><td>{balance.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td><td>{['scheduled', 'completed'].includes(appointment.status) && appointment.payment_status !== 'paid' && balance > 0 && <button disabled={busy || agendaLoading || !!error} onClick={() => collect(appointment)}>Registrar saldo recibido</button>}</td></tr>;
          })}</tbody></table></div>{appointments.length === 0 && <p>No hay turnos para esta fecha.</p>}
        </section>
      </>}
    </>}
  </main>;
}
