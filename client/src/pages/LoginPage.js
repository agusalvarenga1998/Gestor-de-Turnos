import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Icon from '../components/Icon';
import SplashLoader from '../components/SplashLoader';
import styles from './LoginPage.module.css';

// Componente para animar los números que suben
const AnimatedNumber = ({ value, duration = 2000, suffix = '' }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    // Extraer el número base si hay letras (ej: 10 de "10K")
    const numericValue = parseFloat(value);
    
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      const current = progress * numericValue;
      // Si el valor original tiene decimales, mantenerlos
      setDisplayValue(value.toString().includes('.') ? current.toFixed(1) : Math.floor(current));
      
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    
    window.requestAnimationFrame(step);
  }, [value, duration]);

  return <>{displayValue}{suffix}</>;
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loading, error, setError, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }

    // Mostrar error de Google si viene en query params
    const googleError = searchParams.get('error');
    if (googleError) {
      setLocalError(`Error de Google: ${googleError}`);
    }
  }, [isAuthenticated, navigate, searchParams]);

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
      // Redirigir a pantalla de cuenta pendiente
      if (result.pending) {
        navigate('/account-pending', { replace: true });
        return;
      }

      // Redirigir a pantalla de suscripción expirada
      if (result.subscriptionExpired) {
        navigate('/subscription-expired', { replace: true });
        return;
      }

      // Redirigir a pantalla de cuenta suspendida
      if (result.suspended) {
        navigate('/account-suspended', { replace: true });
        return;
      }

      // Mostrar error genérico
      setLocalError(result.error);
    }
  };

  return (
    <>
      {showSplash && <SplashLoader onComplete={() => setShowSplash(false)} />}
      <div className={styles.pageWrapper}>
      {/* Navbar Superior con Link Admin */}
      <nav className={styles.navbar}>
        <div className={styles.navContent}>
          <div className={styles.navLogo}>
            <img src="/logo_turnohub.png" alt="T" className={styles.smallLogo} />
            <span>TurnoHub</span>
          </div>
          <div className={styles.navLinks}>
            <Link to="/why-turnohub">¿Por qué TurnoHub?</Link>
            <Link to="/support">Soporte</Link>
            <Link to="/help-center">Centro de ayuda</Link>
            <Link to="/admin/login" className={styles.navAdminLink}>Panel Administrativo</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section con Estadísticas Animadas */}
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>Bienvenido a TurnoHub</h1>
          <p className={styles.heroSubtitle}>
            La plataforma moderna para gestionar tus turnos con eficiencia y seguridad.
          </p>

          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>
                <AnimatedNumber value="500" suffix="+" />
              </div>
              <div className={styles.statLabel}>PROFESIONALES ACTIVOS</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>
                <AnimatedNumber value="10" suffix="K+" />
              </div>
              <div className={styles.statLabel}>TURNOS POR DÍA</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>
                <AnimatedNumber value="99.5" suffix="%" />
              </div>
              <div className={styles.statLabel}>DISPONIBILIDAD</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>
                <AnimatedNumber value="24" suffix="/7" />
              </div>
              <div className={styles.statLabel}>SOPORTE TÉCNICO</div>
            </div>
          </div>
        </div>
      </section>

      {/* Sección de Login en la parte inferior blanca */}
      <main className={styles.loginMain}>
        <div className={styles.loginCard}>
          <h2 className={styles.cardTitle}>Inicia Sesión</h2>
          <p className={styles.cardSubtitle}>Accede a tu panel profesional</p>

          {(localError || error) && (
            <div className={styles.errorMessage}>
              {localError || error}
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.loginForm}>
            <div className={styles.formGroup}>
              <label>CORREO ELECTRÓNICO</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="profesional@example.com"
                disabled={loading}
              />
            </div>

            <div className={styles.formGroup}>
              <label>CONTRASEÑA</label>
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
                <input type="checkbox" /> Recuérdame
              </label>
              <Link to="/help-center" className={styles.forgotPass}>Olvidé contraseña</Link>
            </div>

            <button type="submit" className={styles.ingresarBtn} disabled={loading}>
              {loading ? 'INGRESANDO...' : 'INGRESAR'}
            </button>

            <div className={styles.loginDivider}>
              <span>O CONTINÚA CON</span>
            </div>

            <button
              type="button"
              onClick={() => window.location.href = `${process.env.REACT_APP_API_BASE_URL || ''}/api/auth/google`}
              className={styles.googleAuthBtn}
              disabled={loading}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" />
              Continuar con Google
            </button>
          </form>

          <div className={styles.registerPrompt}>
            ¿No tienes cuenta? <Link to="/register">Regístrate aquí</Link>
          </div>

          <div className={styles.adminAccess}>
            <Icon name="lock" size={14} /> 
            ¿Eres administrador? <Link to="/admin/login">Ingresa aquí</Link>
          </div>

          {/* Info de Demo - Caja inferior estilo imagen */}
          <div className={styles.demoBox}>
            <p className={styles.demoTitle}>DEMO</p>
            <div className={styles.demoCreds}>
              <p>Email: <span>profesional@example.com</span></p>
              <p>Pass: <span>password123</span></p>
            </div>
          </div>
        </div>
      </main>
    </div>
    </>
  );
}
