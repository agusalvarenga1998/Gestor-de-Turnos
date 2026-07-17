import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DoctorLayout from '../components/DoctorLayout';
import { useAuth } from '../hooks/useAuth';
import { useWebSocketContext } from '../hooks/useWebSocketContext';
import { doctorAPI, appointmentAPI, patientAPI } from '../services/api';
import Icon from '../components/Icon';
import Loading from '../components/Loading';
import styles from './DashboardNewPage.module.css';

const formatDateString = (dateStr) => {
  if (!dateStr) return '';
  const dateOnly = String(dateStr).split('T')[0];
  const parts = dateOnly.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

export default function DashboardNewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isConnected } = useWebSocketContext();
  const [loading, setLoading] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    setIsStandalone(standalone);
  }, []);
  const [stats, setStats] = useState({
    appointmentsToday: 0,
    totalPatients: 0,
    completedThisMonth: 0,
    pendingAppointments: 0
  });
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [delayModal, setDelayModal] = useState({ show: false, appointmentId: null });
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState([]);
  const [delayMinutes, setDelayMinutes] = useState(15);
  const [copied, setCopied] = useState(false);
  const [patientDetails, setPatientDetails] = useState(null);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [saveNotesSuccess, setSaveNotesSuccess] = useState(false);
  const { on, off } = useWebSocketContext();
  
  const isProfileIncomplete = !user?.rubro || !user?.specialization || (!user?.address && !user?.clinic_address);
  const isChecklistDismissed = localStorage.getItem('turnohub_checklist_dismissed') === 'true';
  const showOnboardingBanner = isProfileIncomplete || !isChecklistDismissed;

  useEffect(() => {
    const handleNewAppointment = (data) => {
      console.log('🔔 Nueva cita recibida via WS:', data);
      
      // Mostrar alerta/toast
      alert(`🔔 NUEVO TURNO: ${data.patientName} ha solicitado un turno para el ${formatDateString(data.appointmentDate)} a las ${data.appointmentTime}`);
      
      // Recargar datos
      window.location.reload(); // Forma más simple de asegurar que todo se refresque
    };

    if (isConnected) {
      on('new_appointment', handleNewAppointment);
    }

    return () => {
      off('new_appointment', handleNewAppointment);
    };
  }, [isConnected, on, off]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Obtener hoy en zona horaria local (no UTC)
        const now = new Date();
        const today = now.getFullYear() + '-' +
                     String(now.getMonth() + 1).padStart(2, '0') + '-' +
                     String(now.getDate()).padStart(2, '0');

        console.log('Dashboard - Buscando citas para:', today);

        const dashboardRes = await doctorAPI.getDashboard(today);
        if (dashboardRes.success && dashboardRes.dashboard) {
          setStats(dashboardRes.dashboard);
          setUpcomingBirthdays(dashboardRes.dashboard.upcomingBirthdays || []);
        }

        const appointmentsRes = await appointmentAPI.getAppointments();
        if (appointmentsRes.success) {

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

        
      } catch (err) {
        console.error('Error cargando dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleComplete = async (appointmentId) => {
    if (!window.confirm('¿Deseas marcar este turno como completado?')) return;

    try {
      const response = await appointmentAPI.updateAppointment(appointmentId, {
        status: 'completed'
      });

      if (response.success) {
        setTodayAppointments(prev =>
          prev.map(a => a.id === appointmentId
            ? { ...a, status: 'completed' }
            : a)
        );
        setSelectedAppointment(null);
        alert('✓ Turno marcado como completado');
      }
    } catch (err) {
      console.error('Error al completar turno:', err);
      alert('Error al marcar como completado');
    }
  };

  const handleMarkAsPaid = async (appointmentId) => {
    if (!window.confirm('¿Deseas marcar este turno como pagado?')) return;

    try {
      const response = await appointmentAPI.updateAppointment(appointmentId, {
        payment_status: 'paid'
      });

      if (response.success) {
        setTodayAppointments(prev =>
          prev.map(a => a.id === appointmentId
            ? { ...a, payment_status: 'paid' }
            : a)
        );
        setSelectedAppointment(prev => prev && prev.id === appointmentId ? { ...prev, payment_status: 'paid' } : prev);
        alert('✓ Turno marcado como pagado');
      }
    } catch (err) {
      console.error('Error al marcar turno como pagado:', err);
      alert('Error al marcar como pagado');
    }
  };

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

  const handleCopyLink = () => {
    const link = `${window.location.origin}/patient?doctor=${user?.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    const fetchPatientData = async () => {
      if (!selectedAppointment || !selectedAppointment.patient_id) {
        setPatientDetails(null);
        return;
      }
      try {
        setLoadingPatient(true);
        const response = await patientAPI.getPatient(selectedAppointment.patient_id);
        if (response.success) {
          setPatientDetails(response.patient);
        }
      } catch (err) {
        console.error('Error fetching patient data:', err);
      } finally {
        setLoadingPatient(false);
      }
    };

    fetchPatientData();
  }, [selectedAppointment]);

  useEffect(() => {
    if (selectedAppointment) {
      setNotesText(selectedAppointment.notes || '');
      setSaveNotesSuccess(false);
    }
  }, [selectedAppointment]);

  const handleSaveNotes = async () => {
    if (!selectedAppointment) return;
    try {
      setSavingNotes(true);
      const res = await appointmentAPI.updateAppointment(selectedAppointment.id, {
        notes: notesText
      });
      if (res.success) {
        setSaveNotesSuccess(true);
        setSelectedAppointment(prev => ({ ...prev, notes: notesText }));
        setTodayAppointments(prev => prev.map(a => a.id === selectedAppointment.id ? { ...a, notes: notesText } : a));
        setTimeout(() => setSaveNotesSuccess(false), 2000);
      }
    } catch (err) {
      console.error('Error saving notes:', err);
      alert('Error al guardar las notas');
    } finally {
      setSavingNotes(false);
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
      cancelled: { label: 'CANCELADO', class: styles.statusCancelled },
      absent: { label: 'AUSENTE', class: styles.statusAbsent }
    };
    const badge = badges[status] || badges.scheduled;
    return <span className={`${styles.statusBadge} ${badge.class}`}>{badge.label}</span>;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) {
      return 'Buen día';
    } else if (hour >= 12 && hour < 20) {
      return 'Buenas tardes';
    } else {
      return 'Buenas noches';
    }
  };

  const pendingAppointments = todayAppointments.filter(appt => appt.status === 'scheduled');
  const completedAppointments = todayAppointments.filter(appt => appt.status === 'completed');

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
            <h1 className={styles.greeting}>{getGreeting()}, {user?.name}</h1>
            <p className={styles.dateDisplay}>
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          
          <div className={styles.headerActions}>
            {!isStandalone && (
              <button 
                onClick={() => window.open('/install-app', '_blank')}
                className={styles.installAppBtn}
                style={{ marginRight: '1rem' }}
              >
                <Icon name="download" size={16} color="currentColor" />
                <span>Instalar App</span>
              </button>
            )}
            <div className={styles.connectionBadge}>
              <span className={`${styles.dot} ${isConnected ? styles.online : ''}`}></span>
              {isConnected ? 'Sistema en línea' : 'Sin conexión'}
            </div>
          </div>
        </header>

        {/* Banner de Configuración Pendiente (Onboarding) */}
        {stats.incompleteConfig && stats.incompleteConfig.length > 0 && (
          <div className={styles.onboardingBanner}>
            <div className={styles.onboardingBannerLeft}>
              <div className={styles.onboardingBannerIcon}>
                <span className="material-symbols-outlined">rocket_launch</span>
              </div>
              <div className={styles.onboardingBannerText}>
                <h3>Configuración pendiente de tu consultorio</h3>
                <p>
                  Aún quedan tareas pendientes:{' '}
                  {stats.incompleteConfig.map(c => 
                    c === 'profile' ? 'Perfil del Doctor' : 
                    c === 'hours' ? 'Horarios de Atención' : 
                    c === 'services' ? 'Mis Servicios' : c
                  ).join(', ')}. Completa los pasos para comenzar a recibir reservas online.
                </p>
              </div>
            </div>
            <button onClick={() => navigate('/settings')} className={styles.onboardingBannerBtn}>
              <span>Completar Configuración</span>
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        )}



        {/* Fila de Indicadores y Acciones Urgentes */}
        <div className={styles.actionableMetrics}>
          {stats.pendingApprovalCount > 0 && (
            <div className={`${styles.actionCard} ${styles.danger}`} onClick={() => navigate('/appointments?tab=pending')}>
              <div className={styles.actionCardHeader}>
                <span className={styles.actionNumber}>{stats.pendingApprovalCount}</span>
                <Icon name="warning" size={20} />
              </div>
              <p className={styles.actionText}>Por Aprobar</p>
            </div>
          )}
          
          {stats.pendingPaymentCount > 0 && (
            <div className={`${styles.actionCard} ${styles.warning}`} onClick={() => navigate('/appointments?tab=pending-payment')}>
              <div className={styles.actionCardHeader}>
                <span className={styles.actionNumber}>{stats.pendingPaymentCount}</span>
                <Icon name="wallet" size={20} />
              </div>
              <p className={styles.actionText}>Pagos Pendientes</p>
            </div>
          )}

          {stats.indebtedPatientsCount > 0 && (
            <div className={`${styles.actionCard} ${styles.orange}`} onClick={() => navigate('/movements')}>
              <div className={styles.actionCardHeader}>
                <span className={styles.actionNumber}>{stats.indebtedPatientsCount}</span>
                <Icon name="users" size={20} />
              </div>
              <p className={styles.actionText}>Clientes con Deuda</p>
            </div>
          )}

          {stats.recentCancellationsCount > 0 && (
            <div className={`${styles.actionCard} ${styles.info}`} onClick={() => navigate('/appointments?tab=cancelled')}>
              <div className={styles.actionCardHeader}>
                <span className={styles.actionNumber}>{stats.recentCancellationsCount}</span>
                <Icon name="calendar" size={20} />
              </div>
              <p className={styles.actionText}>Cancelados Recientes</p>
            </div>
          )}

          <div className={`${styles.actionCard} ${styles.success}`} onClick={() => navigate('/appointments?tab=day')}>
            <div className={styles.actionCardHeader}>
              <span className={styles.actionNumber}>{stats.availableSlotsCount}</span>
              <Icon name="clock" size={20} />
            </div>
            <p className={styles.actionText}>Horas Libres Hoy</p>
          </div>
        </div>

        {/* Tarjeta de Próximo Turno */}
        {stats.nextAppointment && (
          <div className={styles.nextAppointmentCard}>
            <div className={styles.nextApptHeader}>
              <span className={styles.nextApptBadge}>Siguiente Paciente</span>
              <span className={styles.nextApptTime}>
                <Icon name="clock" size={16} /> {stats.nextAppointment.appointment_time.substring(0, 5)} hs
              </span>
            </div>
            <div className={styles.nextApptBody}>
              <div>
                <h3 className={styles.nextPatientName}>{stats.nextAppointment.patient_name}</h3>
                <p className={styles.nextApptReason}>
                  💼 {stats.nextAppointment.service_name || 'Consulta General'} ({stats.nextAppointment.duration_minutes || 30} min)
                </p>
              </div>
              <button 
                onClick={() => setSelectedAppointment(stats.nextAppointment)} 
                className={styles.viewNextBtn}
              >
                <Icon name="eye" size={16} /> Ver Detalles
              </button>
            </div>
          </div>
        )}

        <div className={styles.dashboardGrid}>
          {/* Main Column: Agenda */}
          <main className={styles.agendaColumn}>
            {/* Turnos Pendientes Section */}
            <div className={styles.agendaSection}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Turnos de Hoy</h2>
                <span className={`${styles.countBadge} ${styles.pendingBadge}`}>{pendingAppointments.length} agendados</span>
              </div>

              <div className={styles.appointmentList}>
                {pendingAppointments.length === 0 ? (
                  <div className={styles.emptyAgendaSmall}>
                    <Icon name="clock" size={20} />
                    <p>No tienes turnos agendados para hoy.</p>
                  </div>
                ) : (
                  pendingAppointments.map((appt) => (
                    <div key={appt.id} className={styles.apptCard}>
                      <div className={styles.apptTime}>
                        <span className={styles.timeValue}>{appt.appointment_time}</span>
                        <span className={styles.duration}>{appt.duration_minutes || 30}m</span>
                      </div>
                      <div className={styles.apptDetails}>
                        <h3 className={styles.patientName}>{appt.patient_name}</h3>
                        <p className={styles.apptReason}>{appt.reason_for_visit || 'Consulta general'}</p>
                      </div>
                      <div className={styles.apptStatus}>
                        {getStatusBadge(appt.status)}
                      </div>
                      <div className={styles.apptAction}>
                        <button 
                          className={styles.viewBtn}
                          onClick={() => setSelectedAppointment(appt)}
                        >
                          Ver
                        </button>
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
            </div>

            {/* Turnos Realizados Section */}
            <div className={styles.agendaSection} style={{ marginTop: '2rem' }}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Turnos Realizados Hoy</h2>
                <span className={`${styles.countBadge} ${styles.completedBadge}`}>{completedAppointments.length} realizados</span>
              </div>

              <div className={styles.appointmentList}>
                {completedAppointments.length === 0 ? (
                  <div className={styles.emptyAgendaSmall}>
                    <Icon name="check" size={20} />
                    <p>Aún no has completado ningún turno hoy.</p>
                  </div>
                ) : (
                  completedAppointments.map((appt) => (
                    <div key={appt.id} className={`${styles.apptCard} ${styles.completedCard}`}>
                      <div className={styles.apptTime}>
                        <span className={`${styles.timeValue} ${styles.completedTime}`}>{appt.appointment_time}</span>
                        <span className={styles.duration}>{appt.duration_minutes || 30}m</span>
                      </div>
                      <div className={styles.apptDetails}>
                        <h3 className={`${styles.patientName} ${styles.completedPatient}`}>{appt.patient_name}</h3>
                        <p className={styles.apptReason}>{appt.reason_for_visit || 'Consulta general'}</p>
                      </div>
                      <div className={styles.apptStatus}>
                        {getStatusBadge(appt.status)}
                      </div>
                      <div className={styles.apptAction}>
                        <button 
                          className={styles.viewBtn}
                          onClick={() => setSelectedAppointment(appt)}
                        >
                          Ver
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </main>

          {/* Sidebar Column: Birthdays & Info */}
          <aside className={styles.statsColumn}>
            {upcomingBirthdays.length > 0 ? (
              <div className={styles.birthdaysCard}>
                <div className={styles.cardHeaderSmall}>
                  <Icon name="users" size={18} color="#e11d48" />
                  <h3>Cumpleaños de la semana</h3>
                </div>
                <div className={styles.birthdayList}>
                  {upcomingBirthdays.map(p => (
                    <div key={p.id} className={styles.birthdayItem}>
                      <span className={styles.birthdayName}>{p.name}</span>
                      <span className={styles.birthdayDate}>
                        {new Date(p.date_of_birth).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className={styles.quickGuideCard}>
                <h3>Dashboard Accionable</h3>
                <p>Este panel principal te muestra únicamente lo que requiere atención inmediata para que organices tu día eficientemente.</p>
              </div>
            )}
          </aside>
        </div>

        {user?.plan?.allow_patient_booking !== false && (
          <div className={styles.shareCard} style={{ marginTop: '2.5rem', marginBottom: 0 }}>
            <div className={styles.shareCardHeader}>
              <div className={styles.shareCardIcon}>
                <span className="material-symbols-outlined">share</span>
              </div>
              <div className={styles.shareCardText}>
                <h3>Portal de Reservas Online</h3>
                <p>Comparte este enlace con tus pacientes para que puedan reservar turnos de manera autónoma.</p>
              </div>
            </div>
            <div className={styles.shareInputGroup}>
              <div className={styles.shareInputWrapper}>
                <span className={`material-symbols-outlined ${styles.linkInputIcon}`}>link</span>
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/patient?doctor=${user?.id}`}
                  className={styles.shareInput}
                  onClick={(e) => e.target.select()}
                />
              </div>
              <div className={styles.shareActions}>
                <button
                  className={`${styles.copyLinkBtn} ${copied ? styles.copied : ''}`}
                  onClick={handleCopyLink}
                >
                  <Icon name={copied ? 'check' : 'copy'} size={16} />
                  {copied ? '¡Copiado!' : 'Copiar Enlace'}
                </button>
                <a
                  href={`${window.location.origin}/patient?doctor=${user?.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.viewPortalBtn}
                >
                  <Icon name="eye" size={16} />
                  Ver Portal
                </a>
              </div>
            </div>
          </div>
        )}

        {!isStandalone && (
          <div className={styles.downloadAppBanner} style={{ marginTop: '1.5rem', marginBottom: 0 }}>
            <div className={styles.downloadAppBannerLeft}>
              <div className={styles.downloadAppBannerIcon}>
                <span className="material-symbols-outlined">install_mobile</span>
              </div>
              <div className={styles.downloadAppBannerText}>
                <h3>Lleva TurnoHub en tu celular 📱</h3>
                <p>Instala la aplicación para acceder en un toque y recibir alertas al instante.</p>
              </div>
            </div>
            <button 
              onClick={() => window.open('/install-app', '_blank')} 
              className={styles.downloadAppBannerBtn}
            >
              <Icon name="download" size={16} color="currentColor" />
              <span>Ver Cómo Instalar</span>
            </button>
          </div>
        )}
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
      {/* Appointment Detail Modal */}
      {selectedAppointment && (
        <div className={styles.modal}>
          <div className={styles.modalContentLarge}>
            <div className={styles.modalHeader}>
              <h2>Detalles del Turno</h2>
              <button
                onClick={() => setSelectedAppointment(null)}
                className={styles.closeBtn}
              >
                ✕
              </button>
            </div>

            <div className={styles.appointmentDetailBody}>
              <div className={styles.detailSection}>
                <div className={styles.patientProfile}>
                  <div className={styles.avatarLarge}>
                    {selectedAppointment.patient_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className={styles.patientInfo}>
                    <h3>{selectedAppointment.patient_name}</h3>
                    <p className={styles.patientMeta}>
                      <Icon name="phone" size={14} /> {selectedAppointment.patient_phone || 'Sin teléfono'}
                    </p>
                    <p className={styles.patientMeta}>
                      <Icon name="mail" size={14} /> {selectedAppointment.patient_email || 'Sin email'}
                    </p>
                  </div>
                </div>
              </div>

              <div className={styles.detailGrid}>
                <div className={styles.detailCard}>
                  <label>📅 Fecha y Hora</label>
                  <p>{formatDateString(selectedAppointment.appointment_date)} - {selectedAppointment.appointment_time} hs</p>
                </div>
                <div className={styles.detailCard}>
                  <label>📝 Motivo / Servicio</label>
                  <p>{selectedAppointment.reason_for_visit || 'Consulta General'}</p>
                </div>
                <div className={styles.detailCard}>
                  <label>💳 Estado de Pago</label>
                  <p>{selectedAppointment.payment_status === 'paid' ? 'Pagado' : 'Pendiente'}</p>
                </div>
                <div className={styles.detailCard}>
                  <label>⚡ Estado Turno</label>
                  <p>{selectedAppointment.status?.toUpperCase() || ''}</p>
                </div>
              </div>

              {selectedAppointment.meet_link && (
                <div className={styles.meetSection}>
                  <label>🎥 Videollamada</label>
                  <a href={selectedAppointment.meet_link} target="_blank" rel="noopener noreferrer" className={styles.meetBtnLarge}>
                    <Icon name="video" size={20} />
                    Unirte a la reunión (Google Meet)
                  </a>
                </div>
              )}

              {/* Sección de notas clínicas de la cita */}
              <div className={styles.notesSection}>
                <label className={styles.sectionLabel}>✍️ Notas de la Sesión / Diagnóstico</label>
                <textarea
                  className={styles.notesTextarea}
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="Escribe el diagnóstico, tratamiento o evolución del paciente en esta cita..."
                  disabled={savingNotes}
                />
                <div className={styles.notesActions}>
                  <button
                    onClick={handleSaveNotes}
                    className={`${styles.saveNotesBtn} ${saveNotesSuccess ? styles.saveNotesSuccess : ''}`}
                    disabled={savingNotes}
                  >
                    <Icon name={saveNotesSuccess ? "check" : "save"} size={16} />
                    <span>{savingNotes ? 'Guardando...' : (saveNotesSuccess ? '¡Guardado con éxito!' : 'Guardar Notas')}</span>
                  </button>
                </div>
              </div>

              {/* Sección de historial de citas anteriores */}
              <div className={styles.historySection}>
                <label className={styles.sectionLabel}>📋 Historial de Citas Anteriores</label>
                {loadingPatient ? (
                  <div className={styles.loadingHistory}>Cargando historial del paciente...</div>
                ) : !patientDetails ? (
                  <div className={styles.errorHistory}>No se pudo cargar el historial.</div>
                ) : patientDetails.appointments?.filter(appt => appt.id !== selectedAppointment.id).length === 0 ? (
                  <p className={styles.emptyHistory}>Este es el primer turno del paciente en el consultorio.</p>
                ) : (
                  <div className={styles.pastApptsList}>
                    {patientDetails.appointments?.filter(appt => appt.id !== selectedAppointment.id).map(appt => (
                      <div key={appt.id} className={styles.pastApptCard}>
                        <div className={styles.pastApptHeader}>
                          <span className={styles.pastApptDate}>
                            📅 {formatDateString(appt.appointment_date)} - {appt.appointment_time} hs
                          </span>
                          <span className={`${styles.pastApptStatus} ${appt.status === 'completed' ? styles.pastCompleted : styles.pastOther}`}>
                            {appt.status === 'completed' ? 'Realizado' : (appt.status === 'cancelled' ? 'Cancelado' : 'Programado')}
                          </span>
                        </div>
                        <p className={styles.pastApptReason}>
                          <strong>Servicio/Motivo:</strong> {appt.service_name || appt.reason_for_visit || 'Consulta General'}
                        </p>
                        <div className={styles.pastApptNotes}>
                          <strong>Notas clínicas registradas:</strong>
                          <p>{appt.notes || 'Sin notas registradas en esta sesión.'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.modalActionsDetail}>
                <button 
                  onClick={() => navigate(`/patient-history/${selectedAppointment.patient_id}`)}
                  className={styles.historyBtn}
                >
                  <Icon name="folder-open" size={20} />
                  Ver Historial Médico
                </button>
                
                {selectedAppointment.status !== 'completed' && (
                  <button 
                    onClick={() => handleComplete(selectedAppointment.id)}
                    className={styles.completeBtn}
                  >
                    <Icon name="check-circle" size={20} />
                    Marcar como Completado
                  </button>
                )}

                {selectedAppointment.payment_status !== 'paid' && (
                  <button 
                    onClick={() => handleMarkAsPaid(selectedAppointment.id)}
                    className={styles.payBtn}
                  >
                    <Icon name="wallet" size={20} />
                    Marcar como Pagado
                  </button>
                )}

                <button 
                  onClick={() => setSelectedAppointment(null)}
                  className={styles.closeBtnSecondary}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DoctorLayout>
  );
}
