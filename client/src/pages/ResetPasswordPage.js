import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Icon from '../components/Icon';
import styles from './ResetPasswordPage.module.css';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      setError('Falta el token de recuperación en la URL.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002'}/api/auth/reset-password`,
        { token, newPassword: password }
      );
      if (response.data.success) {
        setMessage(response.data.message);
      }
    } catch (err) {
      console.error('Error resetting password:', err);
      setError(err.response?.data?.message || 'Error al restablecer la contraseña.');
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

        <h2 className={styles.title}>Nueva Contraseña</h2>
        <p className={styles.description}>
          Crea una contraseña segura para tu cuenta. Se cerrarán todas las demás sesiones activas.
        </p>

        {!token ? (
          <div className={styles.errorBox}>
            El enlace de recuperación es inválido o no contiene un token válido.
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <Link to="/login" className={styles.backLink}>Volver al Inicio</Link>
            </div>
          </div>
        ) : message ? (
          <div className={styles.successBox}>
            <div className={styles.successIcon}>✓</div>
            <p className={styles.successMessage}>{message}</p>
            <Link to="/login" className={styles.backToLoginBtn}>Iniciar Sesión</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {error && <div className={styles.errorBox}>{error}</div>}

            <div className={styles.formGroup}>
              <label htmlFor="password">Nueva Contraseña</label>
              <div className={styles.inputWrapper}>
                <span className={`material-symbols-outlined ${styles.inputIcon}`}>lock</span>
                <input
                  type="password"
                  id="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword">Confirmar Nueva Contraseña</label>
              <div className={styles.inputWrapper}>
                <span className={`material-symbols-outlined ${styles.inputIcon}`}>lock_reset</span>
                <input
                  type="password"
                  id="confirmPassword"
                  placeholder="Repite la contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'RESTABLECIENDO...' : 'CAMBIAR CONTRASEÑA'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
