import React from 'react';
import { useSellerAuth } from '../context/SellerAuthContext';
import styles from './DemoBanner.module.css';

const DemoBanner = () => {
  const { isDemoMode, demoDoctorName, exitDemoMode } = useSellerAuth();

  if (!isDemoMode) {
    return null;
  }

  return (
    <div className={styles.demoBannerContainer}>
      <div className={styles.demoInfo}>
        <span className={styles.badge}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>preview</span>
          Modo Demo / Vendedor
        </span>
        <span className={styles.doctorText}>
          Presentando pantalla del profesional: <span className={styles.doctorName}>{demoDoctorName || 'Profesional'}</span>
        </span>
      </div>

      <button onClick={exitDemoMode} className={styles.exitButton}>
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
        Volver a Panel Vendedor
      </button>
    </div>
  );
};

export default DemoBanner;
