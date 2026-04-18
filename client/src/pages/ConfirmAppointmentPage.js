import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { appointmentAPI } from '../services/api';
import Icon from '../components/Icon';
import styles from './ConfirmAppointmentPage.module.css';

export default function ConfirmAppointmentPage() {
  const { token } = useParams();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAppointment();
  }, [token]);

  const fetchAppointment = async () => {
    try {
      setLoading(true);
      const response = await appointmentAPI.getByToken(token);

      if (response.success && response.appointment) {
        setAppointment(response.appointment);
        setError(null);
      } else {
        setError('No se encontró la cita');
      }
    } catch (err) {
      console.error('Error cargando cita:', err);
      setError('No se pudo cargar la información de la cita');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Cargando tu cita...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color="#dc2626" />
          <h1>Oops!</h1>
          <p className={styles.errorMessage}>{error}</p>
          <p className={styles.errorSubtext}>
            Si crees que esto es un error, por favor contacta con la clínica.
          </p>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <p>No hay información disponible</p>
        </div>
      </div>
    );
  }

  const appointmentDate = new Date(appointment.appointment_date);
  const formattedDate = appointmentDate.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const statusBadgeClass = {
    scheduled: styles.statusScheduled,
    confirmed: styles.statusConfirmed,
    completed: styles.statusCompleted,
    cancelled: styles.statusCancelled
  }[appointment.status] || styles.statusScheduled;

  const statusLabel = {
    scheduled: 'Programado',
    confirmed: 'Confirmado',
    completed: 'Completado',
    cancelled: 'Cancelado'
  }[appointment.status] || 'Programado';

  // Función para generar URL de Google Calendar
  const generateGoogleCalendarUrl = () => {
    // Parsear fecha y hora
    const [year, month, day] = appointment.appointment_date.split('-');
    const [hours, minutes] = appointment.appointment_time.split(':');

    // Crear fecha de inicio (formato: YYYYMMDDTHHMMSS)
    const startTime = `${year}${month}${day}T${hours}${minutes}00`;
    // Crear fecha de fin (1 hora después)
    const endHour = String(parseInt(hours) + 1).padStart(2, '0');
    const endTime = `${year}${month}${day}T${endHour}${minutes}00`;

    // Crear título y descripción
    const title = `Cita con Dr. ${appointment.doctor_name}`;
    const description = `Paciente: ${appointment.patient_name}\n${
      appointment.doctor_specialization ? `Especialidad: ${appointment.doctor_specialization}\n` : ''
    }${appointment.reason_for_visit ? `Motivo: ${appointment.reason_for_visit}` : ''}`;

    // Construir URL de Google Calendar
    const params = new URLSearchParams({
      text: title,
      dates: `${startTime}/${endTime}`,
      details: description,
      ctz: 'America/Argentina/Buenos_Aires'
    });

    return `https://calendar.google.com/calendar/r/eventedit?${params.toString()}`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Icon name="calendar-check" size={32} color="#2563eb" />
          <h1>Tu Cita Médica</h1>
        </div>

        <div className={styles.content}>
          {/* Información del Doctor */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <Icon name="user-md" size={20} color="#2563eb" /> Doctor
            </h2>
            <div className={styles.infoBlock}>
              <div className={styles.infoPair}>
                <span className={styles.label}>Nombre:</span>
                <span className={styles.value}>{appointment.doctor_name}</span>
              </div>
              {appointment.doctor_specialization && (
                <div className={styles.infoPair}>
                  <span className={styles.label}>Especialidad:</span>
                  <span className={styles.value}>{appointment.doctor_specialization}</span>
                </div>
              )}
            </div>
          </div>

          {/* Información del Paciente */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <Icon name="user" size={20} color="#2563eb" /> Paciente
            </h2>
            <div className={styles.infoBlock}>
              <div className={styles.infoPair}>
                <span className={styles.label}>Nombre:</span>
                <span className={styles.value}>{appointment.patient_name}</span>
              </div>
              {appointment.patient_phone && (
                <div className={styles.infoPair}>
                  <span className={styles.label}>Teléfono:</span>
                  <span className={styles.value}>{appointment.patient_phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Información de la Cita */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <Icon name="calendar" size={20} color="#2563eb" /> Detalles de la Cita
            </h2>
            <div className={styles.infoBlock}>
              <div className={styles.infoPair}>
                <span className={styles.label}>Fecha:</span>
                <span className={styles.value}>{formattedDate}</span>
              </div>
              <div className={styles.infoPair}>
                <span className={styles.label}>Hora:</span>
                <span className={styles.value}>{appointment.appointment_time}</span>
              </div>
              {appointment.reason_for_visit && (
                <div className={styles.infoPair}>
                  <span className={styles.label}>Motivo:</span>
                  <span className={styles.value}>{appointment.reason_for_visit}</span>
                </div>
              )}
              <div className={styles.infoPair}>
                <span className={styles.label}>Estado:</span>
                <span className={`${styles.badge} ${statusBadgeClass}`}>
                  {statusLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className={styles.actionButtons}>
            <a
              href={generateGoogleCalendarUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.addToCalendarBtn}
            >
              <Icon name="calendar" size={18} color="white" />
              Añadir a mi Calendario de Google
            </a>
          </div>

          {/* Mensaje final */}
          <div className={styles.message}>
            <Icon name="info" size={20} color="#2563eb" />
            <p>
              Si necesitas cancelar o reprogramar tu cita, por favor contacta con la clínica.
            </p>
          </div>
        </div>

        <div className={styles.footer}>
          <p className={styles.footerText}>
            Sistema de Gestión de Citas Médicas
          </p>
        </div>
      </div>
    </div>
  );
}
