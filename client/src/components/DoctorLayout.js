import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import WebSocketStatus from './WebSocketStatus';
import TrialCounter from './TrialCounter';
import OnboardingTourModal from './OnboardingTourModal';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, NavLink } from 'react-router-dom';
import styles from './DoctorLayout.module.css';

export default function DoctorLayout({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);

  // Cerrar el menú móvil cuando cambia la ruta
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [navigate]);

  // Lanzar el tour si es la primera vez que ingresa
  useEffect(() => {
    const tourSeen = localStorage.getItem('turnohub_tour_seen');
    if (!tourSeen && user) {
      setIsTourOpen(true);
    }
  }, [user]);


  return (
    <div className={`${styles.layout} ${isMobileMenuOpen ? styles.mobileMenuOpen : ''}`}>
      <div className={styles.sidebarOverlay} onClick={() => setIsMobileMenuOpen(false)}></div>
      <Sidebar 
        isMobile={true} 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
        onOpenTour={() => setIsTourOpen(true)}
      />

      <div className={styles.mainContent}>
        <header className={styles.topbar}>
          <div className={styles.topbarContent}>
            <button 
              className={styles.mobileMenuBtn}
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir menú"
            >
              <div className={styles.hamburgerLine}></div>
              <div className={styles.hamburgerLine}></div>
              <div className={styles.hamburgerLine}></div>
            </button>

            {/* Logo centrado en móvil */}
            <div className={styles.mobileLogo}>
              <span className={`material-symbols-outlined ${styles.mobileLogoIcon}`}>hub</span>
              <span className={styles.mobileLogoText}>TurnoHub</span>
            </div>

            <div className={styles.breadcrumb}>
              {/* Breadcrumb irá aquí */}
            </div>

            <div className={styles.topbarRight}>
              {/* Botón de Tutorial */}
              <button 
                onClick={() => setIsTourOpen(true)} 
                className={styles.tourBtn}
                title="Ver Tutorial de TurnoHub"
              >
                <span className="material-symbols-outlined">explore</span>
                <span className={styles.tourBtnText}>Tutorial</span>
              </button>

              <div className={styles.desktopStatus}>
                <WebSocketStatus />
                <TrialCounter />
              </div>

              <div className={styles.userMenu}>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{user?.name}</span>
                  <span className={styles.userRole}>{user?.specialization || 'Profesional'}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className={styles.content}>
          {children}
        </main>

        {/* Barra de navegación inferior fija para móviles */}
        <nav className={styles.bottomNav}>
          <NavLink to="/dashboard" className={({ isActive }) => `${styles.bottomNavItem} ${isActive ? styles.bottomNavActive : ''}`}>
            <span className="material-symbols-outlined">home</span>
            <span className={styles.bottomNavLabel}>Inicio</span>
          </NavLink>
          <NavLink to="/appointments" className={({ isActive }) => `${styles.bottomNavItem} ${isActive ? styles.bottomNavActive : ''}`}>
            <span className="material-symbols-outlined">calendar_today</span>
            <span className={styles.bottomNavLabel}>Turnos</span>
          </NavLink>
          <NavLink to="/patients" className={({ isActive }) => `${styles.bottomNavItem} ${isActive ? styles.bottomNavActive : ''}`}>
            <span className="material-symbols-outlined">group</span>
            <span className={styles.bottomNavLabel}>Clientes</span>
          </NavLink>
          <NavLink to="/services" className={({ isActive }) => `${styles.bottomNavItem} ${isActive ? styles.bottomNavActive : ''}`}>
            <span className="material-symbols-outlined">medical_services</span>
            <span className={styles.bottomNavLabel}>Servicios</span>
          </NavLink>
          <button onClick={() => setIsMobileMenuOpen(true)} className={styles.bottomNavItem} aria-label="Abrir menú de opciones">
            <span className="material-symbols-outlined">menu</span>
            <span className={styles.bottomNavLabel}>Más</span>
          </button>
        </nav>
      </div>

      {/* Modal del Tour de Bienvenida */}
      <OnboardingTourModal 
        isOpen={isTourOpen} 
        onClose={() => setIsTourOpen(false)} 
      />
    </div>
  );
}

