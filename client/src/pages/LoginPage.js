import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Icon from '../components/Icon';
import SplashLoader from '../components/SplashLoader';
import styles from './LoginPage.module.css';

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
  const [activeTab, setActiveTab] = useState('login');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }

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
      setLocalError('Por favor completa todos los campos requeridos');
      return;
    }

    const result = await login(formData.email, formData.password);

    if (!result.success) {
      if (result.pending) {
        navigate('/account-pending', { replace: true });
        return;
      }
      if (result.subscriptionExpired) {
        navigate('/subscription-expired', { replace: true });
        return;
      }
      if (result.suspended) {
        navigate('/account-suspended', { replace: true });
        return;
      }
      setLocalError(result.error);
    }
  };

  return (
    <>
      {showSplash && <SplashLoader onComplete={() => setShowSplash(false)} />}
      <div className={styles.pageContainer}>
        
        {/* Left Panel */}
        <div className={styles.leftPanel}>
          <div className={styles.overlay}></div>
          <div className={styles.leftContent}>
            <div className={styles.logoContainer}>
              <img src="/logo_turnohub.png" alt="TurnoHub" className={styles.logoImage} />
              <span className={styles.logoText}>TurnoHub</span>
            </div>
            
            <h1 className={styles.mainTitle}>
              Bienvenido a TurnoHub
            </h1>
            
            <p className={styles.description}>
              La plataforma moderna para gestionar tus turnos con eficiencia y seguridad.
            </p>
            
            <button className={styles.knowMoreBtn}>
              Conoce más <Icon name="chevron-right" size={14} />
            </button>
            
            <div className={styles.carouselIndicators}>
              <span className={`${styles.dot} ${styles.activeDot}`}></span>
              <span className={styles.dot}></span>
              <span className={styles.dot}></span>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className={styles.rightPanel}>
          <div className={styles.loginCard}>
            
            <div className={styles.tabsContainer}>
              <button 
                className={`${styles.tab} ${activeTab === 'login' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('login')}
              >
                Iniciar sesión
              </button>
              <button 
                className={`${styles.tab} ${activeTab === 'register' ? styles.activeTab : ''}`}
                onClick={() => navigate('/register')}
              >
                Registrarse
              </button>
            </div>

            <div className={styles.formHeader}>
              <h2>¡Hola de vuelta!</h2>
              <p>Ingresá tu correo electrónico y contraseña para iniciar sesión.</p>
            </div>

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
                  placeholder="profesional@ejemplo.com"
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
                  <button 
                    type="button" 
                    className={styles.eyeBtn}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                  </button>
                </div>
              </div>

              <div className={styles.rememberRow}>
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" /> Recordar contraseña
                </label>
              </div>

              <div className={styles.helpLinks}>
                <Link to="/help-center" className={styles.link}>Olvidé mi contraseña</Link>
                <Link to="/support" className={styles.link}>Necesito ayuda</Link>
              </div>

              <button type="submit" className={styles.submitBtn} disabled={loading}>
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

            <div className={styles.adminAccess}>
              <Icon name="lock" size={14} /> 
              ¿Eres administrador? <Link to="/admin/login">Ingresa aquí</Link>
            </div>
          </div>
        </div>
        
      </div>
    </>
  );
}
