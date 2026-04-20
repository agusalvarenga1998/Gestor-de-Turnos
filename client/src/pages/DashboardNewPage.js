import React, { useState, useEffect } from 'react';
import DoctorLayout from '../components/DoctorLayout';
import { useAuth } from '../hooks/useAuth';
import { useWebSocketContext } from '../hooks/useWebSocketContext';
import { doctorAPI, appointmentAPI } from '../services/api';
import Icon from '../components/Icon';
import Loading from '../components/Loading';
import styles from './DashboardNewPage.module.css';

export default function DashboardNewPage() {
  const { user } = useAuth();
  const { isConnected } = useWebSocketContext();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_appointments: 0,
    total_patients: 0,
    appointments_today: 0,
    pending_appointments: 0,
    completed_appointments: 0,
    cancelled_appointments: 0
  });
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        const dashboardRes = await doctorAPI.getDashboard();
        if (dashboardRes.success) {
          setStats(dashboardRes.stats);
        }

        const appointmentsRes = await appointmentAPI.getAppointments();
        if (appointmentsRes.success) {
          // Obtener hoy en zona horaria local (no UTC)
          const now = new Date();
          const today = now.getFullYear() + '-' +
                       String(now.getMonth() + 1).padStart(2, '0') + '-' +
                       String(now.getDate()).padStart(2, '0');

          console.log('Dashboard - Buscando citas para:', today);

          const todayAppts = appointmentsRes.appointments
            .filter(appt => {
              // Extraer solo la fecha sin la hora/timezone
              const apptDate = appt.appointment_date instanceof Date
                ? appt.appointment_date.toISOString().split('T')[0]
                : String(appt.appointment_date).split('T')[0];
              return apptDate === today && appt.status !== 'cancelled';
            })
            .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));

          console.log('Dashboard - Citas encontradas:', todayAppts.length);
          setTodayAppointments(todayAppts);
        }

        setError(null);
      } catch (err) {
        console.error('Error cargando dashboard:', err);
        setError('Error al cargar los datos');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const StatCard = ({ label, value, subtext, color = 'primary' }) => (
    <div className={`${styles.statCard} ${styles[color]}`}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
      {subtext && <div className={styles.statSubtext}>{subtext}</div>}
    </div>
  );

  const getStatusBadge = (status) => {
    const badges = {
      scheduled: { label: 'PROGRAMADO', class: styles.statusScheduled },
      completed: { label: 'COMPLETADO', class: styles.statusCompleted },
      cancelled: { label: 'CANCELADO', class: styles.statusCancelled }
    };
    const badge = badges[status] || badges.scheduled;
    return <span className={`${styles.statusBadge} ${badge.class}`}>{badge.label}</span>;
  };

  if (loading) {
    return (
      <DoctorLayout>
        <Loading />
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.title}>Dashboard</h1>
            <p className={styles.subtitle}>Bienvenido, {user?.name}</p>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.connectionStatus}>
              <div className={`${styles.statusIndicator} ${isConnected ? styles.connected : ''}`}></div>
              <span>{isConnected ? 'Conectado' : 'Desconectado'}</span>
            </div>
          </div>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <StatCard label="Completados" value={stats.completed_appointments} color="success" />
          <StatCard label="En Espera" value={stats.pending_appointments} color="warning" />
          <StatCard label="Total Hoy" value={stats.appointments_today || 0} subtext="Turnos hoy" color="primary" />
          <StatCard label="Clientes" value={stats.total_patients} color="info" />
        </div>

        {/* Appointments Table */}
        <div className={styles.appointmentsSection}>
          <h2 className={styles.sectionTitle}>Turnos de Hoy</h2>

          {todayAppointments.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No hay turnos programados para hoy</p>
            </div>
          ) : (
            <table className={styles.appointmentsTable}>
              <thead>
                <tr>
                  <th>Posición</th>
                  <th>Cliente</th>
                  <th>Hora</th>
                  <th>Estado</th>
                  <th>Duración</th>
                </tr>
              </thead>
              <tbody>
                {todayAppointments.map((appt, index) => (
                  <tr key={appt.id}>
                    <td className={styles.positionCell}>{index + 1}</td>
                    <td className={styles.patientName}>{appt.patient_name}</td>
                    <td className={styles.time}>{appt.appointment_time}</td>
                    <td>{getStatusBadge(appt.status)}</td>
                    <td>30 min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Session Info */}
        <div className={styles.sessionInfo}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Inicio de sesión</span>
            <span className={styles.infoValue}>{new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Estado</span>
            <span className={styles.infoValue}>{isConnected ? 'Activo' : 'Inactivo'}</span>
          </div>
        </div>
      </div>
    </DoctorLayout>
  );
}
