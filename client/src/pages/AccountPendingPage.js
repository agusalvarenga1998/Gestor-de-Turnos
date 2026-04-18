import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import styles from './AccountPendingPage.module.css';

export default function AccountPendingPage() {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconWrapper}>
          <div className={styles.icon}>⏳</div>
        </div>

        <h1 className={styles.title}>Cuenta Pendiente de Aprobación</h1>

        <div className={styles.message}>
          <p>
            Tu cuenta ha sido creada correctamente. Ahora debes esperar la aprobación del administrador del sistema para poder acceder a TurnoHub.
          </p>

          <p>
            El administrador revisará tu solicitud pronto y recibirás acceso una vez que sea aprobada.
          </p>
        </div>

        <div className={styles.infoBox}>
          <h3>¿Qué viene ahora?</h3>
          <ul>
            <li>Recibirás un email de confirmación</li>
            <li>El administrador revisará tu solicitud</li>
            <li>Una vez aprobado, podrás iniciar sesión con tus credenciales</li>
          </ul>
        </div>

        <button
          className={styles.backBtn}
          onClick={() => navigate('/login')}
        >
          Volver a Iniciar Sesión
        </button>

        <p className={styles.supportText}>
          ¿Preguntas? Contacta al administrador del sistema
        </p>
      </div>
    </div>
  );
}
