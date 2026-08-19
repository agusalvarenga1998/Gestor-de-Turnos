import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSellerAuth } from '../context/SellerAuthContext';
import styles from './SellerLoginPage.module.css';

const SellerLoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login, error, setError } = useSellerAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await login(email, password);
      if (res.success) {
        navigate('/seller/dashboard');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div className={styles.brandBadge}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>storefront</span>
          Portal Comercial TurnoHub
        </div>

        <h1 className={styles.title}>Acceso Vendedores</h1>
        <p className={styles.subtitle}>Gestión de demostraciones y control de clientes</p>

        {error && (
          <div className={styles.errorBox}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Correo Electrónico</label>
            <div className={styles.inputWrapper}>
              <span className={`material-symbols-outlined ${styles.inputIcon}`}>mail</span>
              <input
                type="email"
                required
                className={styles.input}
                placeholder="vendedor@turnohub.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Contraseña</label>
            <div className={styles.inputWrapper}>
              <span className={`material-symbols-outlined ${styles.inputIcon}`}>lock</span>
              <input
                type="password"
                required
                className={styles.input}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={styles.submitButton}
          >
            {submitting ? 'Iniciando sesión...' : 'Ingresar al Panel Vendedor'}
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </form>

        <div className={styles.footerText}>
          TurnoHub &copy; 2026 - Módulo de Ventas & Demos
        </div>
      </div>
    </div>
  );
};

export default SellerLoginPage;
