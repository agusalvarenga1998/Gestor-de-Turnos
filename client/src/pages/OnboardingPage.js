import React from 'react';
import DoctorLayout from '../components/DoctorLayout';
import OnboardingChecklist from '../components/OnboardingChecklist';
import styles from './OnboardingPage.module.css';

export default function OnboardingPage() {
  return (
    <DoctorLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Guía de Configuración Inicial</h1>
          <p className={styles.subtitle}>Completa estos sencillos pasos para dejar tu consultorio virtual listo para recibir citas.</p>
        </div>
        <div className={styles.content}>
          <OnboardingChecklist alwaysShow={true} />
        </div>
      </div>
    </DoctorLayout>
  );
}
