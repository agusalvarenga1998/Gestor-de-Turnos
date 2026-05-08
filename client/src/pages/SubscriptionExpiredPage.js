import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import styles from './SubscriptionExpiredPage.module.css';

export default function SubscriptionExpiredPage() {
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
          <div className={styles.icon}>⚠️</div>
        </div>

        <h1 className={styles.title}>Acceso Restringido</h1>
        
        <div className={styles.message}>
          <p className={styles.highlight}>
            Debes pagar para seguir usando la app.
          </p>
          
          <p>
            Tu periodo de acceso ha llegado a su fin. Para continuar utilizando las funcionalidades de TurnoHub, contacta al administrador para habilitar tu cuenta.
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
          <h3>Próximos Pasos:</h3>
          <p>
            Para renovar tu suscripción, comunícate con el administrador del sistema usando la información anterior.
          </p>
        </div>

        <button
          className={styles.logoutBtn}
          onClick={handleLogout}
        >
          Cerrar Sesión
        </button>

        <p className={styles.supportText}>
          ¿Necesitas ayuda? Contacta al administrador
        </p>
      </div>
    </div>
  );
}
