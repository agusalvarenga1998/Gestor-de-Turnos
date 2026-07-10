import React, { useState } from 'react';
import styles from './OnboardingTourModal.module.css';

export default function OnboardingTourModal({ isOpen, onClose }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  if (!isOpen) return null;

  const slides = [
    {
      icon: 'rocket_launch',
      title: '¡Te damos la bienvenida a TurnoHub!',
      description: 'La plataforma moderna diseñada para simplificar la gestión de tus turnos, automatizar las reservas de tus pacientes y optimizar la sala de espera de tu consultorio en tiempo real.',
      color: '#2563eb', // Blue
    },
    {
      icon: 'dashboard',
      title: 'Tu Panel de Control Diario',
      description: 'En el Dashboard tienes acceso instantáneo a las estadísticas de hoy: turnos pendientes, pacientes totales, próximas alertas y cumpleaños. Recibirás avisos sonoros e inmediatos cuando un paciente agende online.',
      color: '#10b981', // Green
    },
    {
      icon: 'schedule',
      title: 'Disponibilidad y Servicios',
      description: 'Configura tus días y horarios de atención preferidos, y agrega tus prácticas o especialidades en la sección "Mis Servicios". Esto le permitirá al sistema calcular con precisión los turnos disponibles.',
      color: '#f59e0b', // Amber
    },
    {
      icon: 'groups',
      title: 'Pacientes y Convenios Médicos',
      description: 'Lleva un registro organizado de tus clientes, guarda notas clínicas e historial de turnos. Si tu plan lo habilita, configura las Obras Sociales y Convenios que aceptas en tu consultorio.',
      color: '#06b6d4', // Cyan
    },
    {
      icon: 'share',
      title: '¡Comparte tu Enlace de Reserva!',
      description: 'Copia tu link personalizado del Portal de Reservas y compártelo en tu WhatsApp, redes sociales o consultorio. Tus pacientes podrán agendar sus propios turnos de manera rápida, cómoda y sin intermediarios.',
      color: '#8b5cf6', // Purple
    },
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('turnohub_tour_seen', 'true');
    onClose();
  };

  const currentData = slides[currentSlide];

  return (
    <div className={styles.overlay} onClick={handleComplete}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Botón cerrar */}
        <button className={styles.closeBtn} onClick={handleComplete} title="Cerrar y saltar tutorial">
          <span className="material-symbols-outlined">close</span>
        </button>

        {/* Contenido Carrusel */}
        <div className={styles.carouselContent}>
          {/* Ilustración / Icono Animado */}
          <div 
            className={styles.visualContainer} 
            style={{ '--accent-color': currentData.color }}
          >
            <div className={styles.iconCircle}>
              <span className={`material-symbols-outlined ${styles.mainIcon}`}>
                {currentData.icon}
              </span>
            </div>
            {/* Elementos decorativos animados en background */}
            <div className={styles.decoCircle1}></div>
            <div className={styles.decoCircle2}></div>
          </div>

          {/* Textos */}
          <div className={styles.textContainer}>
            <h2 className={styles.title}>{currentData.title}</h2>
            <p className={styles.description}>{currentData.description}</p>
          </div>
        </div>

        {/* Barra de Navegación del Modal */}
        <div className={styles.footer}>
          {/* Indicadores de diapositiva (Puntos) */}
          <div className={styles.dotsContainer}>
            {slides.map((_, index) => (
              <button
                key={index}
                className={`${styles.dot} ${index === currentSlide ? styles.activeDot : ''}`}
                onClick={() => setCurrentSlide(index)}
                title={`Ir a diapositiva ${index + 1}`}
              ></button>
            ))}
          </div>

          {/* Botones de acción */}
          <div className={styles.actions}>
            {currentSlide > 0 ? (
              <button className={styles.btnSec} onClick={handlePrev}>
                Atrás
              </button>
            ) : (
              <button className={styles.btnSec} onClick={handleComplete}>
                Saltar
              </button>
            )}

            <button 
              className={styles.btnPri} 
              onClick={handleNext}
              style={{ backgroundColor: currentData.color }}
            >
              {currentSlide === slides.length - 1 ? 'Comenzar' : 'Siguiente'}
              <span className="material-symbols-outlined">
                {currentSlide === slides.length - 1 ? 'done' : 'chevron_right'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
