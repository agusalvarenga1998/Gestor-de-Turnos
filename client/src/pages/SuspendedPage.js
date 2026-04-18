import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import styles from './SuspendedPage.module.css';

export default function SuspendedPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconWrapper}>
          <div className={styles.icon}>⛔</div>
        </div>

        <h1 className={styles.title}>Cuenta Suspendida</h1>

        <div className={styles.message}>
          <p>
            Tu cuenta ha sido suspendida y no tienes acceso al sistema en este momento.
          </p>

          <p>
            Por favor, comunícate con el administrador del sistema para más información sobre el estado de tu cuenta y resolver esta situación.
          </p>
        </div>

        {user && (
          <div className={styles.infoBox}>
            <h3>Información de tu Cuenta:</h3>
            <div className={styles.infoItem}>
              <span className={styles.label}>Nombre:</span>
              <span className={styles.value}>{user?.name}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.label}>Email:</span>
              <span className={styles.value}>{user?.email}</span>
            </div>
          </div>
        )}

        <div className={styles.contactBox}>
          <h3>¿Qué hacer ahora?</h3>
          <p>
            Contacta al administrador del sistema usando tu email para solicitar información sobre tu cuenta suspendida y los pasos a seguir.
          </p>
        </div>

        {user ? (
          <button
            className={styles.logoutBtn}
            onClick={handleLogout}
          >
            Cerrar Sesión
          </button>
        ) : (
          <button
            className={styles.logoutBtn}
            onClick={() => navigate('/login')}
          >
            Volver al Login
          </button>
        )}

        <p className={styles.supportText}>
          ¿Tienes preguntas? Contacta al administrador
        </p>
      </div>
    </div>
  );
}
