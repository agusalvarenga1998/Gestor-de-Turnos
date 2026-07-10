import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { doctorAPI, serviceAPI, patientAPI, appointmentAPI, insuranceAPI } from '../services/api';
import styles from './OnboardingChecklist.module.css';

export default function OnboardingChecklist() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('turnohub_checklist_collapsed') === 'true';
  });
  const [isHidden, setIsHidden] = useState(() => {
    return localStorage.getItem('turnohub_checklist_dismissed') === 'true';
  });

  const [stepsStatus, setStepsStatus] = useState({
    profile: false,
    hours: false,
    services: false,
    insurance: false,
    patients: false,
    appointments: false,
  });

  const isInsuranceAllowed = user?.plan?.allow_insurance !== false;

  useEffect(() => {
    if (isHidden) {
      setLoading(false);
      return;
    }

    const checkAllSteps = async () => {
      try {
        setLoading(true);
        
        // 1. Perfil completo
        const hasProfile = !!(user?.rubro && user?.specialization && (user?.address || user?.clinic_address));

        // Consultar el resto de APIs
        const [hoursRes, servicesRes, patientsRes, appointmentsRes, insuranceRes] = await Promise.allSettled([
          doctorAPI.getWorkingHours(),
          serviceAPI.getMyServices(),
          patientAPI.getPatients(),
          appointmentAPI.getAppointments(),
          isInsuranceAllowed ? insuranceAPI.getInsurances() : Promise.resolve({ success: true, insurances: [] })
        ]);

        const hasHours = hoursRes.status === 'fulfilled' && 
                         hoursRes.value?.success && 
                         Array.isArray(hoursRes.value?.availability) && 
                         hoursRes.value.availability.some(h => h.is_available);

        const hasServices = servicesRes.status === 'fulfilled' && 
                            servicesRes.value?.success && 
                            Array.isArray(servicesRes.value?.services) && 
                            servicesRes.value.services.length > 0;

        const hasPatients = patientsRes.status === 'fulfilled' && 
                            patientsRes.value?.success && 
                            Array.isArray(patientsRes.value?.patients) && 
                            patientsRes.value.patients.length > 0;

        const hasAppointments = appointmentsRes.status === 'fulfilled' && 
                                appointmentsRes.value?.success && 
                                Array.isArray(appointmentsRes.value?.appointments) && 
                                appointmentsRes.value.appointments.length > 0;

        const hasInsurance = !isInsuranceAllowed || (
          insuranceRes.status === 'fulfilled' && 
          insuranceRes.value?.success && 
          Array.isArray(insuranceRes.value?.insurances) && 
          insuranceRes.value.insurances.length > 0
        );

        setStepsStatus({
          profile: hasProfile,
          hours: hasHours,
          services: hasServices,
          insurance: hasInsurance,
          patients: hasPatients,
          appointments: hasAppointments,
        });

      } catch (err) {
        console.error('Error verificando checklist de inicio:', err);
      } finally {
        setLoading(false);
      }
    };

    checkAllSteps();
  }, [user, isHidden, isInsuranceAllowed]);

  // Lista de pasos con su respectiva información
  const stepsList = [
    {
      key: 'profile',
      title: 'Datos de tu consultorio',
      description: 'Completa tu especialidad, rubro y dirección de atención.',
      path: '/settings',
      isCompleted: stepsStatus.profile,
      icon: 'contact_page',
    },
    {
      key: 'hours',
      title: 'Horarios de trabajo',
      description: 'Define qué días y horas estás disponible para recibir citas.',
      path: '/working-hours',
      isCompleted: stepsStatus.hours,
      icon: 'schedule',
    },
    {
      key: 'services',
      title: 'Servicios ofrecidos',
      description: 'Carga las prácticas que realizas y su duración promedio.',
      path: '/services',
      isCompleted: stepsStatus.services,
      icon: 'medical_services',
    },
    ...(isInsuranceAllowed ? [{
      key: 'insurance',
      title: 'Convenios y Obras Sociales',
      description: 'Agrega las mutuales y coberturas que aceptas en tu consultorio.',
      path: '/insurance',
      isCompleted: stepsStatus.insurance,
      icon: 'shield',
    }] : []),
    {
      key: 'patients',
      title: 'Tu primer cliente/paciente',
      description: 'Registra una persona para iniciar tu base de datos.',
      path: '/patients',
      isCompleted: stepsStatus.patients,
      icon: 'person_add',
    },
    {
      key: 'appointments',
      title: 'Agenda tu primer turno',
      description: 'Crea una cita para probar el flujo de atención y cola de espera.',
      path: '/appointments',
      isCompleted: stepsStatus.appointments,
      icon: 'event_available',
    },
  ];

  // Calcular progreso
  const completedCount = stepsList.filter(s => s.isCompleted).length;
  const totalCount = stepsList.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const toggleCollapse = () => {
    const newVal = !isCollapsed;
    setIsCollapsed(newVal);
    localStorage.setItem('turnohub_checklist_collapsed', String(newVal));
  };

  const handleDismiss = () => {
    if (window.confirm('¿Deseas ocultar esta guía? Podrás volver a habilitarla desde el menú de soporte o ayuda.')) {
      setIsHidden(true);
      localStorage.setItem('turnohub_checklist_dismissed', 'true');
    }
  };

  const handleRestore = () => {
    setIsHidden(false);
    localStorage.removeItem('turnohub_checklist_dismissed');
  };

  if (isHidden) {
    return (
      <div className={styles.restorerCard}>
        <span className="material-symbols-outlined">info</span>
        <span>¿Quieres ver la guía de inicio y configuración nuevamente?</span>
        <button className={styles.restoreBtn} onClick={handleRestore}>
          Mostrar Guía
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <span>Cargando guía de inicio...</span>
      </div>
    );
  }

  // Si ya completó el 100%, no es necesario mostrar el checklist extendido por defecto, a menos que el usuario lo abra.
  const isAllCompleted = progressPercent === 100;

  return (
    <div className={`${styles.card} ${isCollapsed ? styles.collapsedCard : ''} ${isAllCompleted ? styles.completedCard : ''}`}>
      {/* Cabecera */}
      <div className={styles.header} onClick={toggleCollapse}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIconWrapper}>
            <span className="material-symbols-outlined">rocket_launch</span>
          </div>
          <div>
            <h3 className={styles.title}>
              {isAllCompleted ? '¡Todo listo! Consultorio configurado' : 'Asistente de Configuración Inicial'}
            </h3>
            <p className={styles.subtitle}>
              {isAllCompleted 
                ? 'Has completado los pasos esenciales para comenzar a operar con TurnoHub.' 
                : 'Completa estos pasos sencillos para habilitar tu portal de turnos al 100%.'}
            </p>
          </div>
        </div>

        <div className={styles.headerRight} onClick={(e) => e.stopPropagation()}>
          <div className={styles.progressSection}>
            <span className={styles.progressText}>{completedCount} de {totalCount} pasos</span>
            <div className={styles.progressBarBg}>
              <div 
                className={styles.progressBarFill} 
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <span className={styles.progressPercent}>{progressPercent}%</span>
          </div>

          <button 
            className={styles.iconBtn} 
            onClick={toggleCollapse} 
            title={isCollapsed ? 'Expandir' : 'Colapsar'}
          >
            <span className="material-symbols-outlined">
              {isCollapsed ? 'expand_more' : 'expand_less'}
            </span>
          </button>

          {!isAllCompleted && (
            <button 
              className={styles.iconBtn} 
              onClick={handleDismiss} 
              title="Ocultar guía permanentemente"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Lista de pasos */}
      {!isCollapsed && (
        <div className={styles.stepsGrid}>
          {stepsList.map((step) => (
            <div 
              key={step.key} 
              className={`${styles.stepCard} ${step.isCompleted ? styles.stepCompleted : ''}`}
              onClick={() => navigate(step.path)}
            >
              <div className={styles.stepHeader}>
                <div className={styles.stepIconBox}>
                  <span className="material-symbols-outlined">{step.icon}</span>
                </div>
                <div className={styles.checkboxWrapper}>
                  {step.isCompleted ? (
                    <span className={`material-symbols-outlined ${styles.checkIcon}`}>check_circle</span>
                  ) : (
                    <span className={`material-symbols-outlined ${styles.pendingIcon}`}>radio_button_unchecked</span>
                  )}
                </div>
              </div>
              
              <div className={styles.stepBody}>
                <h4 className={styles.stepTitle}>{step.title}</h4>
                <p className={styles.stepDesc}>{step.description}</p>
              </div>

              <div className={styles.stepFooter}>
                <span className={styles.actionLink}>
                  {step.isCompleted ? 'Revisar' : 'Configurar'}
                  <span className="material-symbols-outlined">arrow_forward</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
