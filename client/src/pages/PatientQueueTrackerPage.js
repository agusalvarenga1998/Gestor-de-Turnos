import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { queueAPI } from '../services/api';
import styles from './PatientQueueTrackerPage.module.css';

export default function PatientQueueTrackerPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [isCalledNow, setIsCalledNow] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await queueAPI.getPatientTrackingStatus(token);
      if (res.success) {
        setData(res);
        if (res.status === 'in_progress') {
          setIsCalledNow(true);
          if (navigator.vibrate) {
            try { navigator.vibrate([300, 100, 300, 100, 300]); } catch (e) {}
          }
        }
      }
    } catch (err) {
      console.error('Error al cargar ticket de fila:', err);
      setError('No se pudo encontrar el ticket de fila. Verifique el enlace ingresado.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Polling de respaldo cada 12 segundos para actualizar la posición automáticamente
    const interval = setInterval(() => {
      fetchStatus();
    }, 12000);

    return () => clearInterval(interval);
  }, [token]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Cargando tu puesto en la fila...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.errorContainer}>
        <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#ef4444' }}>error</span>
        <h2>Ticket Inválido o Expirado</h2>
        <p>{error || 'Este enlace no coincide con ningún turno activo del día.'}</p>
      </div>
    );
  }

  const { entry, status, position, aheadCount, estimatedWaitMinutes, message } = data;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Cabecera del Establecimiento / Profesional */}
        <div className={styles.doctorHeader}>
          <div className={styles.logoBadge}>
            <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#2563eb' }}>medical_services</span>
          </div>
          <div>
            <h1 className={styles.doctorName}>{entry.doctor_name}</h1>
            <p className={styles.doctorSub}>{entry.doctor_specialization || 'Atención Profesional'} • {entry.clinic_name || 'Consultorio'}</p>
            {entry.doctor_address && (
              <p className={styles.doctorAddr}>📍 {entry.doctor_address}</p>
            )}
          </div>
        </div>

        {/* Banner Especial de TURNO LLAMADO */}
        {status === 'in_progress' && (
          <div className={styles.calledBanner}>
            <div className={styles.pulseDot}></div>
            <h2>🟢 ¡ES TU TURNO AHORA!</h2>
            <p>Por favor ingresa al consultorio / establecimiento. ¡Te están esperando!</p>
          </div>
        )}

        {/* Tarjeta Principal del Ticket */}
        <div className={styles.ticketCard}>
          <div className={styles.ticketHeader}>
            <span className={styles.ticketLabel}>TU TICKET ASIGNADO</span>
            <div className={styles.ticketNumber}>{entry.ticket_code}</div>
            <span className={styles.patientName}>{entry.patient_name}</span>
            {entry.service_name && <span className={styles.serviceTag}>{entry.service_name}</span>}
          </div>

          <div className={styles.divider}></div>

          <div className={styles.statusSection}>
            {status === 'waiting' && (
              <>
                <div className={styles.positionBox}>
                  <span className={styles.positionSub}>Puesto Actual en la Fila</span>
                  <span className={styles.positionBig}>#{position}</span>
                </div>

                <div className={styles.infoGrid}>
                  <div className={styles.infoCard}>
                    <span className="material-symbols-outlined" style={{ color: '#3b82f6' }}>groups</span>
                    <div>
                      <span className={styles.infoVal}>{aheadCount}</span>
                      <span className={styles.infoLab}>Persona(s) adelante</span>
                    </div>
                  </div>

                  <div className={styles.infoCard}>
                    <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>schedule</span>
                    <div>
                      <span className={styles.infoVal}>~{estimatedWaitMinutes} min</span>
                      <span className={styles.infoLab}>Tiempo estimado</span>
                    </div>
                  </div>
                </div>

                <div className={styles.liveNotice}>
                  <span className={styles.greenPulse}></span>
                  Actualización en tiempo real activa. Puedes aguardar en tu celular.
                </div>
              </>
            )}

            {status === 'in_progress' && (
              <div className={styles.inProgressBox}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#16a34a' }}>door_front</span>
                <h3>¡Pasando al consultorio!</h3>
                <p>Estás siendo atendido en este momento.</p>
              </div>
            )}

            {status === 'completed' && (
              <div className={styles.completedBox}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#2563eb' }}>task_alt</span>
                <h3>Atención Completada</h3>
                <p>¡Muchas gracias por tu visita! Esperamos que hayas tenido una gran atención.</p>
              </div>
            )}

            {(status === 'skipped' || status === 'cancelled') && (
              <div className={styles.skippedBox}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#94a3b8' }}>cancel</span>
                <h3>Turno Cancelado o Postergado</h3>
                <p>Si consideras que fue un error, consulta con la recepción del establecimiento.</p>
              </div>
            )}
          </div>
        </div>

        {/* Pie informativo */}
        <div className={styles.footer}>
          <p>Powered by <strong>TurnoHub</strong> • Sistema de Fila Virtual en Vivo</p>
        </div>
      </div>
    </div>
  );
}
