import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Icon from '../components/Icon';
import SplashLoader from '../components/SplashLoader';
import styles from './LoginPage.module.css';

const carouselData = [
  {
    image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=2070&auto=format&fit=crop',
    title: 'Bienvenido a TurnoHub',
    description: 'La plataforma moderna para gestionar tus turnos con eficiencia y seguridad.'
  },
  {
    image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=2070&auto=format&fit=crop',
    title: 'Estética y Dermatología',
    description: 'Centraliza historiales clínicos, tratamientos y consentimientos en un solo lugar.'
  },
  {
    image: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?q=80&w=2070&auto=format&fit=crop',
    title: 'Gestión Integral',
    description: 'Accedé a los estudios y archivos de tus pacientes desde cualquier dispositivo, 24/7.'
  }
];

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
  const [currentBg, setCurrentBg] = useState(0);

  useEffect(() => {
    // Preload images to avoid empty background during transitions
    carouselData.forEach((item) => {
      const img = new Image();
      img.src = item.image;
    });

    const interval = setInterval(() => {
      setCurrentBg(prev => (prev + 1) % carouselData.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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
        <div 
          className={styles.leftPanel}
          style={{ backgroundImage: `url('${carouselData[currentBg].image}')`, transition: 'background-image 1s ease-in-out' }}
        >
          <div className={styles.overlay}></div>
          <div className={styles.leftContent}>
            <div className={styles.logoContainer}>
              <img src="/logo_turnohub.png" alt="TurnoHub" className={styles.logoImage} />
              <span className={styles.logoText}>TurnoHub</span>
            </div>
            
            <h1 className={styles.mainTitle}>
              {carouselData[currentBg].title}
            </h1>
            
            <p className={styles.description}>
              {carouselData[currentBg].description}
            </p>
            
            <button className={styles.knowMoreBtn}>
              Conoce más <Icon name="chevron-right" size={14} />
            </button>
            
            <div className={styles.carouselIndicators}>
              {carouselData.map((_, index) => (
                <span 
                  key={index}
                  className={`${styles.dot} ${index === currentBg ? styles.activeDot : ''}`}
                  onClick={() => setCurrentBg(index)}
                  style={{ cursor: 'pointer' }}
                ></span>
              ))}
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

            <div className={styles.legalLinks}>
              <Link to="/privacy">Política de Privacidad</Link>
              <span className={styles.divider}>•</span>
              <Link to="/terms">Términos de Servicio</Link>
            </div>
          </div>
        </div>
        
      </div>
    </>
  );
}
