import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { appointmentAPI } from '../services/api';
import Icon from '../components/Icon';
import styles from './PatientAppointmentViewPage.module.css';
import { appointmentStatusInfo, appointmentPaymentInfo } from '../utils/appointmentState';


export default function PatientAppointmentViewPage() {
  const { appointmentCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [hasAttemptedAutoVerify, setHasAttemptedAutoVerify] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');
  const [rescheduleNotice, setRescheduleNotice] = useState('');

  useEffect(() => {
    if (!rescheduleOpen || !newDate) return;
    let active = true;
    setSlotsLoading(true);
    setNewTime('');
    setRescheduleSlots([]);
    setRescheduleError('');
    appointmentAPI.getRescheduleSlots(appointmentCode, newDate).then(response => {
      if (active) setRescheduleSlots(response.slots || []);
    }).catch(err => {
      if (active) setRescheduleError(err.response?.data?.message || 'No pudimos consultar horarios. Elegí otra fecha o volvé a intentar.');
    }).finally(() => { if (active) setSlotsLoading(false); });
    return () => { active = false; };
  }, [appointmentCode, rescheduleOpen, newDate]);

  const handleReschedule = async event => {
    event.preventDefault();
    if (rescheduling || !newTime) return;
    setRescheduling(true);
    setRescheduleError('');
    try {
      const response = await appointmentAPI.reschedulePublic(appointmentCode, newDate, newTime);
      setRescheduleNotice(response.message);
      setRescheduleOpen(false);
      await fetchAppointment();
    } catch (err) {
      setRescheduleError(err.response?.data?.message || 'No pudimos confirmar el cambio por un problema de conexión. Actualizá tu turno antes de volver a intentar.');
      setNewTime('');
    } finally { setRescheduling(false); }
  };

  // Intentar confirmar automáticamente si la cita está en espera (ideal al volver de MP)
  useEffect(() => {
    if (appointment && appointment.status === 'pending_payment' && !hasAttemptedAutoVerify) {
      setHasAttemptedAutoVerify(true);
      verifyPaymentLocally();
    }
  }, [appointment, location, hasAttemptedAutoVerify]);

  const verifyPaymentLocally = async (paymentId = null) => {
    try {
      setLoading(true);
      const response = { data: await appointmentAPI.verifyPublicPayment(appointment.id) };
      
      if (response.data.success) {
        setPaymentMessage(response.data.message || 'Estado del pago actualizado.');
        fetchAppointment();
      } else {
        setPaymentMessage(response.data.message || 'El pago todavía no está acreditado. Podés verificarlo nuevamente en unos segundos.');
        fetchAppointment();
      }
    } catch (err) {
      console.error('Error contactando a MP para verificar pago:', err);
      setPaymentMessage('No pudimos verificar el pago por un problema de conexión. Volvé a intentar.');
      fetchAppointment();
    }
  };

  useEffect(() => {
    fetchAppointment();
  }, [appointmentCode]);

  useEffect(() => {
    if (!appointment) return;

    const interval = setInterval(() => {
      if (appointment.status === 'scheduled') {
        const apptTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}-03:00`);
        const now = new Date();
        const diff = apptTime - now;

        if (diff > 0) {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);

          setTimeLeft({ hours, minutes, seconds });
        } else {
          setTimeLeft(null);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [appointment]);

  const fetchAppointment = async () => {
    try {
      setLoading(true);
      const response = await appointmentAPI.getByToken(appointmentCode);

      if (response.success && response.appointment) {
        setAppointment(response.appointment);
        setError(null);
      } else {
        setError('No se encontró el turno con este código');
      }
    } catch (err) {
      console.error('Error cargando cita:', err);
      setError('Error al cargar tu turno. Verifica el código e intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!window.confirm('¿Estás seguro de que deseas cancelar este turno? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await appointmentAPI.cancelPublic(appointmentCode);
      if (response.success) {
        alert('Turno cancelado exitosamente');
        fetchAppointment(); // Recargar datos
      }
    } catch (err) {
      console.error('Error cancelando:', err);
      alert(err.response?.data?.message || 'Error al cancelar el turno');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Sincronizando con TurnoHub...</p>
        </div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className={styles.container}>
        <div className={styles.errorTicket}>
          <div className={styles.errorIcon}>✕</div>
          <h2>Error de Acceso</h2>
          <p>{error || 'No se encontró el turno solicitado'}</p>
          <button className={styles.actionMain} onClick={() => navigate('/patient')}>
            Volver al Portal
          </button>
        </div>
      </div>
    );
  }

  // Normalizar la fecha (si viene con T00:00:00... de Postgres, tomamos solo la parte de la fecha)
  const cleanDate = appointment.appointment_date.split('T')[0];
  const appointmentDate = new Date(`${cleanDate}T${appointment.appointment_time}`);
  
  // Obtener fecha de hoy en formato local YYYY-MM-DD sin problemas de huso horario
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;
  const isToday = cleanDate === todayStr;

  return (
    <div className={styles.container}>
      <div className={styles.ticketWrapper}>
        <button className={styles.subtleBackBtn} onClick={() => navigate('/patient')}>
          <Icon name="arrowLeft" size={16} /> Volver
        </button>

        <div className={styles.ticket}>
          {/* Header del Ticket - Marca y Estado */}
          <div className={`${styles.ticketHeader} ${styles[appointment.status]}`}>
            <div className={styles.brandRow}>
              <span className={`material-symbols-outlined ${styles.logoIcon}`}>hub</span>
              <div className={styles.statusGroup}>
                <div className={`${styles.badge} ${styles['badge' + appointment.status.toUpperCase()]}`}>
                  {appointmentStatusInfo(appointment, { patient: true }).label}
                </div>
                <div className={styles.shortCode}>
                  Enlace privado de tu turno
                </div>
              </div>
            </div>
            
            <div className={styles.statusAnnouncement}>
              {appointment.status === 'scheduled' && <h1>Tu cita está lista</h1>}
              {appointment.status === 'pending_payment' && <h1 style={{ color: '#f59e0b' }}>Pago pendiente de acreditación</h1>}
              {appointment.status === 'pending' && <h1>Solicitud recibida</h1>}
              {appointment.status === 'completed' && <h1>Cita Concluida</h1>}
              {appointment.status === 'cancelled' && <h1>Cita Cancelada</h1>}
              {appointment.status === 'rejected' && <h1>Solicitud no aceptada</h1>}
              {appointment.status === 'absent' && <h1 style={{ color: '#ea580c' }}>Ausente / No asististe</h1>}
              {appointment.status === 'expired' && <h1 style={{ color: '#64748b' }}>Solicitud Vencida (Sin respuesta)</h1>}
              {isToday && appointment.status === 'scheduled' && (
                <div className={styles.todayPill}>ES HOY</div>
              )}
            </div>
          </div>

          <div className={styles.ticketBody}>
            <section aria-label="Estado del pago" style={{ marginBottom: 20 }}>
              <strong>{appointmentPaymentInfo(appointment).label}</strong>
              {appointment.status === 'pending' && <p>{appointmentPaymentInfo(appointment).received ? 'Recibimos tu pago. El turno todavía necesita la confirmación del profesional.' : 'Tu solicitud fue recibida. Esperá la confirmación del profesional antes de asistir.'}</p>}
              {['cancelled', 'rejected'].includes(appointment.status) && appointmentPaymentInfo(appointment).received && <p>El pago registrado no implica una devolución automática. Contactá al profesional para revisar tu caso.</p>}
              {paymentMessage && <p role="status">{paymentMessage}</p>}
            </section>
            {/* Aviso de Pago Pendiente */}
            {appointment.status === 'pending_payment' && (
              <div className={styles.paymentPendingCard}>
                <Icon name="alert-circle" size={32} color="#f59e0b" />
                <div className={styles.paymentInfo}>
                  <h3>Casi terminas...</h3>
                  <p>Estamos esperando la confirmación de tu pago de Mercado Pago.</p>
                  <button className={styles.confirmBtn} onClick={() => verifyPaymentLocally()}>
                    VERIFICAR PAGO Y AGENDAR
                  </button>
                </div>
              </div>
            )}

            {/* Aviso de Retraso Premium */}
            {appointment.status === 'scheduled' && appointment.delay_minutes > 0 && (
              <div className={styles.delayCard}>
                <div className={styles.delayIcon}><Icon name="clock" size={24} color="#92400e" /></div>
                <div className={styles.delayInfo}>
                  <label>AVISO DE RETRASO</label>
                  <p>El profesional presenta <strong>{appointment.delay_minutes} min</strong> de demora.</p>
                  {appointment.delay_reason && <span className={styles.reason}>"{appointment.delay_reason}"</span>}
                </div>
              </div>
            )}

            {/* Estado de la Fila del Médico (Solo para el día de hoy) */}
            {isToday && (appointment.status === 'scheduled' || appointment.status === 'pending') && typeof appointment.appointments_before !== 'undefined' && (
              <div className={styles.queueCard}>
                <div className={styles.queueIcon}>
                  <Icon name="users" size={24} color="#166534" />
                </div>
                <div className={styles.queueInfo} style={{ width: '100%' }}>
                  <label>ESTADO DE LA FILA</label>
                  {appointment.appointments_before === 0 ? (
                    <p className={styles.status}>¡Eres el próximo turno en ser atendido!</p>
                  ) : (
                    <>
                      <p style={{ marginBottom: '12px' }}>
                        Hay <strong>{appointment.appointments_before}</strong> {appointment.appointments_before === 1 ? 'turno' : 'turnos'} antes que el tuyo:
                      </p>
                      <div className={styles.queueList}>
                        {appointment.queue_before && appointment.queue_before.map((q, idx) => {
                          const qTime = q.appointment_time.substring(0, 5);
                          
                          // Determinar si la hora ya pasó
                          const now = new Date();
                          const todayStrLocal = now.toLocaleDateString('sv');
                          const qDateTime = new Date(`${todayStrLocal}T${q.appointment_time}`);
                          const hasPassed = now > qDateTime;
                          
                          let statusLabel = 'Programado';
                          let statusClass = styles.qScheduled;
                          
                          if (q.status === 'pending' || q.status === 'pending_payment') {
                            statusLabel = 'Pendiente';
                            statusClass = styles.qPending;
                          } else if (hasPassed) {
                            statusLabel = 'En Espera';
                            statusClass = styles.qWaiting;
                          } else {
                            statusLabel = 'Confirmado';
                            statusClass = styles.qConfirmed;
                          }
                          
                          return (
                            <div key={idx} className={styles.queueItem}>
                              <span className={styles.queueTime}>🕒 {qTime} hs</span>
                              <span className={`${styles.queueStatusBadge} ${statusClass}`}>{statusLabel}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Bloque Principal Doctor y Especialidad */}
            <div className={styles.doctorBlock}>
              <div className={styles.avatarCircle}>
                <Icon name="users" size={28} color="#2563eb" />
              </div>
              <div className={styles.doctorText}>
                <label>PROFESIONAL A CARGO</label>
                <h3>{appointment.doctor_name}</h3>
                <p>{appointment.doctor_specialization}</p>
              </div>
            </div>

            {/* Consulta Online Link / Estado */}
            {appointment.is_online && (
              <div className={styles.onlineConsultationCard}>
                <div className={styles.onlineIcon}>
                  <Icon name="video" size={24} color={appointment.meet_link ? "#16a34a" : "#d97706"} />
                </div>
                <div className={styles.onlineInfo}>
                  <label>MODALIDAD ONLINE</label>
                  {appointment.meet_link ? (
                    <>
                      <p>Tu consulta es online. Únete a la videollamada de Google Meet haciendo clic abajo:</p>
                      <a 
                        href={appointment.meet_link} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className={styles.meetBtn}
                      >
                        🎥 Unirme a Google Meet
                      </a>
                    </>
                  ) : (
                    <p className={styles.pendingLinkText}>
                      ⏳ El link de videollamada estará disponible aquí y te llegará por email una vez que el profesional confirme el turno.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Grid de Tiempo */}
            <div className={styles.timeGrid}>
              <div className={styles.timeItem}>
                <Icon name="calendar" size={18} color="#64748b" />
                <div className={styles.timeDetails}>
                  <label>FECHA</label>
                  <p>{appointmentDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                </div>
              </div>
              <div className={styles.timeItem}>
                <Icon name="clock" size={18} color="#2563eb" />
                <div className={styles.timeDetails}>
                  <label>HORA</label>
                  <p className={styles.highlightTime}>{appointment.appointment_time.substring(0, 5)} hs</p>
                </div>
              </div>
            </div>

            {/* Línea de Perforación Estético */}
            <div className={styles.divider}>
              <div className={styles.dividerCircleLeft}></div>
              <div className={styles.dividerLine}></div>
              <div className={styles.dividerCircleRight}></div>
            </div>

            {/* Información del Paciente */}
            <div className={styles.patientDetailedInfo}>
              <div className={styles.dataRow}>
                <span className={styles.dataLabel}>CLIENTE</span>
                <span className={styles.dataValue}>{appointment.patient_name}</span>
              </div>
              <div className={styles.dataRow}>
                <span className={styles.dataLabel}>IDENTIFICACIÓN</span>
                <span className={styles.dataValue}>{appointment.patient_dni || '---'}</span>
              </div>
              {appointment.insurance_name && (
                <div className={styles.dataRow}>
                  <span className={styles.dataLabel}>OBRA SOCIAL</span>
                  <span className={styles.dataValue}>
                    {appointment.insurance_name}
                    {appointment.insurance_plan_name ? ` (${appointment.insurance_plan_name})` : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Código QR / Alfanumérico */}
            <div className={styles.codeContainer}>
              <p>CÓDIGO PRIVADO PARA CONSULTAR TU TURNO</p>
              <div className={styles.bookingCode}>
                {appointmentCode.toUpperCase()}
              </div>
              <button 
                className={styles.copyLink}
                onClick={() => {
                  navigator.clipboard.writeText(appointmentCode);
                  alert('¡Código copiado!');
                }}
              >
                <Icon name="copy" size={14} /> Copiar Código
              </button>
            </div>
          </div>

          <div className={styles.ticketActions}>
            {rescheduleNotice && <p role="status">{rescheduleNotice}</p>}
            {['scheduled', 'pending'].includes(appointment.status) && (
              <button className={styles.btnPrimary} onClick={() => { setRescheduleOpen(open => !open); setRescheduleError(''); }} disabled={rescheduling}>Cambiar fecha y horario</button>
            )}
            {rescheduleOpen && <form onSubmit={handleReschedule} style={{ width: '100%', display: 'grid', gap: 12 }}>
              <h2>Reprogramar mi turno</h2>
              <p>Necesitás al menos 24 horas de anticipación para el turno actual y el nuevo. Se conservan el profesional, servicio, pagos y estado de confirmación. Al confirmar se libera el horario anterior.</p>
              <label htmlFor="reschedule-date">Nueva fecha</label>
              <input id="reschedule-date" type="date" required value={newDate} min={new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(Date.now() + 86400000))} onChange={event => { setNewTime(''); setNewDate(event.target.value); }} disabled={rescheduling} />
              <label htmlFor="reschedule-time">Horario disponible (hora de Argentina)</label>
              <select id="reschedule-time" required value={newTime} onChange={event => setNewTime(event.target.value)} disabled={rescheduling || slotsLoading || !newDate}>
                <option value="">{slotsLoading ? 'Consultando horarios…' : 'Elegí un horario'}</option>
                {rescheduleSlots.map(time => <option key={time} value={time}>{time.slice(0, 5)}</option>)}
              </select>
              {newDate && !slotsLoading && !rescheduleSlots.length && !rescheduleError && <p>No hay horarios disponibles para esa fecha.</p>}
              {rescheduleError && <p role="alert">{rescheduleError}</p>}
              <button type="submit" className={styles.btnPrimary} disabled={rescheduling || slotsLoading || !newTime}>{rescheduling ? 'Guardando cambio…' : 'Confirmar cambio de horario'}</button>
              <button type="button" className={styles.btnSecondary} disabled={rescheduling} onClick={() => setRescheduleOpen(false)}>Mantener mi turno actual</button>
            </form>}
            <button className={styles.btnPrimary} onClick={fetchAppointment}>
              <Icon name="refresh" size={18} /> Actualizar Turno
            </button>
            <div className={styles.btnGroup}>
              {appointment.doctor_phone && <a href={`tel:${appointment.doctor_phone}`} className={styles.btnSecondary}>
                <Icon name="phone" size={16} /> Clínica
              </a>}
              {(appointment.status === 'scheduled' || appointment.status === 'pending') && (
                <button className={styles.btnDanger} onClick={handleCancelAppointment}>
                  <Icon name="close" size={16} /> Cancelar
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={styles.ticketFooter}>
          <p>Por favor, llega 10 minutos antes de tu cita.</p>
        </div>
      </div>
    </div>
  );
}
