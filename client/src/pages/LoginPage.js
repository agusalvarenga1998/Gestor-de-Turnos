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
    usernameBilog: '',
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
              <span className={styles.plusSign}>+</span>
              <span className={styles.logoText}>bilog</span>
            </div>
            
            <h1 className={styles.mainTitle}>
              Accedé a estudios y<br />archivos de tus pacientes
            </h1>
            
            <p className={styles.description}>
              Visualizá y organizá todos los estudios en un solo lugar. Subí imágenes, informes o resultados y consultalos cuando los necesites, desde cualquier dispositivo.
            </p>
            
            <button className={styles.knowMoreBtn}>
              Conoce mas <Icon name="chevron-right" size={14} />
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
              <p>Ingresá tu usuario y contraseña para iniciar sesión.</p>
            </div>

            {(localError || error) && (
              <div className={styles.errorMessage}>
                {localError || error}
              </div>
            )}

            <form onSubmit={handleSubmit} className={styles.loginForm}>
              
              <div className={styles.formGroup}>
                <label>Usuario bilog</label>
                <input
                  type="text"
                  name="usernameBilog"
                  value={formData.usernameBilog}
                  onChange={handleChange}
                  placeholder="alva5332"
                  disabled={loading}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Usuario</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Ingresá tu correo electrónico o usuario asignado"
                  disabled={loading}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Contraseña</label>
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
                {loading ? 'Continuando...' : 'Continuar'}
              </button>
              
            </form>
          </div>
        </div>
        
      </div>
    </>
  );
}
