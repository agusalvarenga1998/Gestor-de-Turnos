import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Icon from '../components/Icon';
import styles from './ForgotPasswordPage.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002'}/api/auth/forgot-password`,
        { email }
      );
      if (response.data.success) {
        setMessage(response.data.message);
      }
    } catch (err) {
      console.error('Error in forgot password request:', err);
      setError(err.response?.data?.message || 'Error al procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logoContainer}>
          <span className={`material-symbols-outlined ${styles.logoIcon}`}>hub</span>
          <span className={styles.logoText}>TurnoHub</span>
        </div>

        <h2 className={styles.title}>Recuperar Contraseña</h2>
        <p className={styles.description}>
          Ingresa tu dirección de correo electrónico profesional y te enviaremos un enlace seguro para restablecer tu contraseña.
        </p>

        {message ? (
          <div className={styles.successBox}>
            <div className={styles.successIcon}>✓</div>
            <p className={styles.successMessage}>{message}</p>
            <Link to="/login" className={styles.backToLoginBtn}>Volver a Iniciar Sesión</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {error && <div className={styles.errorBox}>{error}</div>}

            <div className={styles.formGroup}>
              <label htmlFor="email">Correo Electrónico Profesional</label>
              <div className={styles.inputWrapper}>
                <span className={`material-symbols-outlined ${styles.inputIcon}`}>mail</span>
                <input
                  type="email"
                  id="email"
                  placeholder="ejemplo@doctor.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'ENVIANDO...' : 'ENVIAR ENLACE'}
            </button>

            <div className={styles.footerLink}>
              <Link to="/login" className={styles.link}>
                <span className="material-symbols-outlined">arrow_back</span>
                <span>Volver al Inicio de Sesión</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
