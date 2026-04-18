import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import Icon from '../components/Icon';
import styles from './AdminLoginPage.module.css';

// Componente para animar los números que suben (Clonado para Admin)
const AnimatedNumber = ({ value, duration = 2000, suffix = '' }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    const numericValue = parseFloat(value);

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const current = progress * numericValue;
      setDisplayValue(value.toString().includes('.') ? current.toFixed(1) : Math.floor(current));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [value, duration]);

  return <>{displayValue}{suffix}</>;
};

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { login, loading, error, setError, isAuthenticated } = useAdminAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setLocalError('');
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      setLocalError('Por favor completa todos los campos');
      return;
    }

    const result = await login(formData.email, formData.password);

    if (!result.success) {
      setLocalError(result.error);
    }
  };

  return (
    <div className={styles.pageWrapper}>
      {/* Navbar Superior Admin - Color Violeta */}
      <nav className={styles.navbar}>
        <div className={styles.navContent}>
          <div className={styles.navLogo}>
            <Icon name="lock" size={24} color="white" />
            <span>TurnoHub Admin</span>
          </div>
          <div className={styles.navLinks}>
            <Link to="/why-turnohub">Métricas</Link>
            <Link to="/help-center">Auditoría</Link>
            <Link to="/support">Documentación</Link>
            <Link to="/login" className={styles.navDoctorLink}>Acceso Profesional</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section Admin con Estadísticas Violetas */}
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>Panel de Control Maestro</h1>
          <p className={styles.heroSubtitle}>
            Herramientas avanzadas para la gestión de infraestructura, usuarios y auditoría clínica.
          </p>

          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>
                <AnimatedNumber value="15" suffix="+" />
              </div>
              <div className={styles.statLabel}>SEDES VINCULADAS</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>
                <AnimatedNumber value="2.5" suffix="K+" />
              </div>
              <div className={styles.statLabel}>USUARIOS TOTALES</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>
                <AnimatedNumber value="100" suffix="%" />
              </div>
              <div className={styles.statLabel}>UPTIME SISTEMA</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>
                <AnimatedNumber value="24" suffix="/7" />
              </div>
              <div className={styles.statLabel}>MONITOREO PROACTIVO</div>
            </div>
          </div>
        </div>
      </section>

      {/* Sección de Login Admin */}
      <main className={styles.loginMain}>
        <div className={styles.loginCard}>
          <h2 className={styles.cardTitle}>Gestión Central</h2>
          <p className={styles.cardSubtitle}>Introduce tus credenciales de superusuario</p>

          {(localError || error) && (
            <div className={styles.errorMessage}>
              {localError || error}
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.loginForm}>
            <div className={styles.formGroup}>
              <label>ID DE ADMINISTRADOR</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="admin@example.com"
                disabled={loading}
              />
            </div>

            <div className={styles.formGroup}>
              <label>CONTRASEÑA MAESTRA</label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>
            </div>

            <div className={styles.formOptions}>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" /> Sesión persistente
              </label>
              <Link to="/help-center" className={styles.forgotPass}>¿Olvidaste el acceso?</Link>
            </div>

            <button type="submit" className={styles.ingresarBtn} disabled={loading}>
              {loading ? 'AUTENTICANDO...' : 'INGRESAR AL PANEL'}
            </button>
          </form>

          {/* Info de Demo Admin */}
          <div className={styles.demoBox}>
            <p className={styles.demoTitle}>ADMIN DEMO</p>
            <div className={styles.demoCreds}>
              <p>User: <span>admin@example.com</span></p>
              <p>Key: <span>adminpass123</span></p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
