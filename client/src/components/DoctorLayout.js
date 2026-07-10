import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import WebSocketStatus from './WebSocketStatus';
import TrialCounter from './TrialCounter';
import OnboardingTourModal from './OnboardingTourModal';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
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
      <Sidebar isMobile={true} isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

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

              <WebSocketStatus />
              <TrialCounter />

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
      </div>

      {/* Modal del Tour de Bienvenida */}
      <OnboardingTourModal 
        isOpen={isTourOpen} 
        onClose={() => setIsTourOpen(false)} 
      />
    </div>
  );
}

