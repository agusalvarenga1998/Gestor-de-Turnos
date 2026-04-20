import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { appointmentAPI } from '../services/api';
import Icon from '../components/Icon';
import styles from './PatientAppointmentViewPage.module.css';
import axios from 'axios';

export default function PatientAppointmentViewPage() {
  const { appointmentCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [hasAttemptedAutoVerify, setHasAttemptedAutoVerify] = useState(false);

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
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';
      const response = await axios.post(`${apiUrl}/appointments/public/verify-payment/${appointment.id}`);
      
      if (response.data.success) {
        if (!paymentId) alert('¡Excelente! Verificamos tu pago con Mercado Pago y tu turno fue confirmado en este instante.');
        fetchAppointment();
      } else {
        if (!paymentId) alert(response.data.message || 'El pago aún registra como pendiente. Intenta nuevamente en unos segundos.');
        fetchAppointment();
      }
    } catch (err) {
      console.error('Error contactando a MP para verificar pago:', err);
      if (!paymentId) alert('Hubo un problema de conexión al verificar; aguarda un instante y presiona el botón nuevamente.');
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
        const apptTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
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

  const getStatusBadge = (status) => {
    const badges = {
      scheduled: { label: 'Confirmado', class: styles.statusScheduled },
      completed: { label: 'Completado', class: styles.statusCompleted },
      cancelled: { label: 'Cancelado', class: styles.statusCancelled }
    };
    const badge = badges[status] || badges.scheduled;
    return <span className={`${styles.statusBadge} ${badge.class}`}>{badge.label}</span>;
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
  const isToday = new Date(appointment.appointment_date).toDateString() === new Date().toDateString();

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
              <img src="/logo_turnohub.png" alt="TurnoHub" className={styles.logo} />
              <div className={styles.statusGroup}>
                <div className={`${styles.badge} ${styles['badge' + appointment.status]}`}>
                  {appointment.status === 'scheduled' ? 'CONFIRMADO' : appointment.status.toUpperCase()}
                </div>
                <div className={styles.shortCode}>
                  Código: <strong>{appointment.appointment_code}</strong>
                </div>
              </div>
            </div>
            
            <div className={styles.statusAnnouncement}>
              {appointment.status === 'scheduled' && <h1>Tu cita está lista</h1>}
              {appointment.status === 'pending_payment' && <h1 style={{ color: '#f59e0b' }}>Pago en Proceso</h1>}
              {appointment.status === 'completed' && <h1>Cita Concluida</h1>}
              {appointment.status === 'cancelled' && <h1>Cita Cancelada</h1>}
              {isToday && appointment.status === 'scheduled' && (
                <div className={styles.todayPill}>ES HOY</div>
              )}
            </div>
          </div>

          <div className={styles.ticketBody}>
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

            {/* Bloque Principal Doctor y Especialidad */}
            <div className={styles.doctorBlock}>
              <div className={styles.avatarCircle}>
                <Icon name="users" size={28} color="#2563eb" />
              </div>
              <div className={styles.doctorText}>
                <label>PROFESIONAL A CARGO</label>
                <h3>Dr. {appointment.doctor_name}</h3>
                <p>{appointment.specialization}</p>
              </div>
            </div>

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
            </div>

            {/* Código QR / Alfanumérico */}
            <div className={styles.codeContainer}>
              <p>MUESTRA ESTE CÓDIGO AL LLEGAR</p>
              <div className={styles.bookingCode}>
                {appointmentCode.substring(0, 10).toUpperCase()}
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
            <button className={styles.btnPrimary} onClick={fetchAppointment}>
              <Icon name="refresh" size={18} /> Actualizar Turno
            </button>
            <div className={styles.btnGroup}>
              <a href="tel:+56912345678" className={styles.btnSecondary}>
                <Icon name="phone" size={16} /> Clínica
              </a>
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
