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
  const [delayModal, setDelayModal] = useState({ show: false, appointmentId: null });
  const [delayMinutes, setDelayMinutes] = useState(15);

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

  const handleDelay = async () => {
    if (!delayMinutes || delayMinutes <= 0) {
      alert('Por favor ingresa minutos válidos');
      return;
    }

    try {
      const response = await appointmentAPI.updateDelay(delayModal.appointmentId, {
        delay_minutes: delayMinutes,
        delay_reason: 'Retraso desde Dashboard'
      });

      if (response.success) {
        setTodayAppointments(prev =>
          prev.map(a => a.id === delayModal.appointmentId
            ? { ...a, delay_minutes: delayMinutes }
            : a)
        );
        alert(`✓ Retraso de ${delayMinutes} minutos registrado`);
        setDelayModal({ show: false, appointmentId: null });
        setDelayMinutes(15);
      }
    } catch (err) {
      console.error('Error registrando retraso:', err);
      alert('Error al registrar el retraso');
    }
  };

  const StatItem = ({ label, value, iconName, color }) => (
    <div className={`${styles.statItem} ${styles[color]}`}>
      <div className={styles.statIcon}>
        <Icon name={iconName} size={20} />
      </div>
      <div className={styles.statData}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statValue}>{value}</span>
      </div>
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
        <header className={styles.mainHeader}>
          <div className={styles.welcomeInfo}>
            <h1 className={styles.greeting}>Buen día, {user?.name}</h1>
            <p className={styles.dateDisplay}>
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          
          <div className={styles.headerActions}>
            <div className={styles.connectionBadge}>
              <span className={`${styles.dot} ${isConnected ? styles.online : ''}`}></span>
              {isConnected ? 'Sistema en línea' : 'Sin conexión'}
            </div>
          </div>
        </header>

        <div className={styles.dashboardGrid}>
          {/* Main Column: Agenda */}
          <main className={styles.agendaColumn}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Agenda de hoy</h2>
              <span className={styles.countBadge}>{todayAppointments.length} turnos</span>
            </div>

            <div className={styles.appointmentList}>
              {todayAppointments.length === 0 ? (
                <div className={styles.emptyAgenda}>
                  <Icon name="calendar" size={40} />
                  <p>No tienes compromisos programados para hoy.</p>
                </div>
              ) : (
                todayAppointments.map((appt, index) => (
                  <div key={appt.id} className={styles.apptCard}>
                    <div className={styles.apptTime}>
                      <span className={styles.timeValue}>{appt.appointment_time}</span>
                      <span className={styles.duration}>30m</span>
                    </div>
                    <div className={styles.apptDetails}>
                      <h3 className={styles.patientName}>{appt.patient_name}</h3>
                      <p className={styles.apptReason}>{appt.reason_for_visit || 'Consulta general'}</p>
                    </div>
                    <div className={styles.apptStatus}>
                      {getStatusBadge(appt.status)}
                    </div>
                    <div className={styles.apptAction}>
                      <button className={styles.viewBtn}>Ver</button>
                      {appt.status === 'scheduled' && (
                        <button 
                          className={styles.delayBtn}
                          onClick={() => setDelayModal({ show: true, appointmentId: appt.id })}
                        >
                          <Icon name="clock" size={16} />
                          Retrasar
                        </button>
                      )}
                      {appt.delay_minutes > 0 && (
                        <div className={styles.delayBadge}>+{appt.delay_minutes} min</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </main>

          {/* Sidebar Column: Stats & Info */}
          <aside className={styles.statsColumn}>
            <div className={styles.summaryCard}>
              <h2 className={styles.summaryTitle}>Resumen General</h2>
              
              <div className={styles.statsList}>
                <StatItem label="Turnos hoy" value={stats.appointments_today || 0} iconName="calendar" color="blue" />
                <StatItem label="Pendientes" value={stats.pending_appointments} iconName="clock" color="orange" />
                <StatItem label="Completados" value={stats.completed_appointments} iconName="check-circle" color="green" />
                <StatItem label="Total clientes" value={stats.total_patients} iconName="users" color="purple" />
              </div>
            </div>

            <div className={styles.quickInfo}>
              <div className={styles.infoRow}>
                <span className={styles.label}>Último acceso</span>
                <span className={styles.value}>{new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>Estado servidor</span>
                <span className={styles.value}>Estable</span>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Delay Modal */}
      {delayModal.show && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>Registrar Retraso</h2>
              <button
                onClick={() => {
                  setDelayModal({ show: false, appointmentId: null });
                  setDelayMinutes(15);
                }}
                className={styles.closeBtn}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '2rem' }}>
              <div className={styles.delayOptions}>
                {[15, 30, 45, 60].map(mins => (
                  <button
                    key={mins}
                    onClick={() => setDelayMinutes(mins)}
                    className={`${styles.optionBtn} ${delayMinutes === mins ? styles.active : ''}`}
                  >
                    {mins} min
                  </button>
                ))}
              </div>

              <div className={styles.customInput}>
                <label>O ingresa minutos personalizados:</label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={delayMinutes}
                  onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)}
                  className={styles.input}
                />
              </div>

              <div className={styles.modalButtons}>
                <button
                  onClick={() => {
                    setDelayModal({ show: false, appointmentId: null });
                    setDelayMinutes(15);
                  }}
                  className={styles.cancelBtn}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelay}
                  className={styles.confirmBtn}
                >
                  Confirmar Retraso
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DoctorLayout>
  );
}
