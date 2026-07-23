import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { RUBROS_ESPECIALIDADES } from '../constants/categories';
import styles from './RegisterPage.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, loading, error, setError } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    rubro: '',
    specialization: '',
    clinic_name: ''
  });
  const [localError, setLocalError] = useState('');
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [isCustomSpecialty, setIsCustomSpecialty] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'rubro') {
      setFormData(prev => ({
        ...prev,
        rubro: value,
        specialization: ''
      }));
      setIsCustomSpecialty(false);
      setCustomSpecialty('');
    } else if (name === 'specialization') {
      if (value === '__custom__') {
        setIsCustomSpecialty(true);
        setFormData(prev => ({
          ...prev,
          specialization: '__custom__'
        }));
      } else {
        setIsCustomSpecialty(false);
        setFormData(prev => ({
          ...prev,
          specialization: value
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    setLocalError('');
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones
    if (!formData.email || !formData.password || !formData.name || !formData.rubro) {
      setLocalError('Por favor completa los campos requeridos (Nombre, Email, Contraseña y Rubro)');
      return;
    }

    const finalSpecialization = isCustomSpecialty ? customSpecialty.trim() : formData.specialization;
    if (!finalSpecialization) {
      setLocalError('Por favor selecciona o escribe tu especialidad');
      return;
    }

    if (formData.password.length < 6) {
      setLocalError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setLocalError('Las contraseñas no coinciden');
      return;
    }

    const result = await register({
      email: formData.email,
      password: formData.password,
      name: formData.name,
      phone: formData.phone,
      rubro: formData.rubro,
      specialization: finalSpecialization,
      clinic_name: formData.clinic_name
    });

    if (result.success) {
      navigate('/dashboard', { replace: true });
    } else {
      setLocalError(result.error);
    }
  };

  const handleGoogleRegister = () => {
    window.location.href = `${API_BASE_URL}/api/auth/google`;
  };

  return (
    <div className={styles.pageWrapper}>
      {/* Navbar Superior */}
      <nav className={styles.navbar}>
        <div className={styles.navContent}>
          <Link to="/" className={styles.navLogo}>
            <span className={`material-symbols-outlined ${styles.logoIcon}`}>hub</span>
            <span>TurnoHub</span>
          </Link>
          <div className={styles.navLinks}>
            <Link to="/why-turnohub">¿Cómo funciona?</Link>
            <Link to="/support">Soporte</Link>
            <Link to="/login" className={styles.navBackBtn}>Iniciar sesión</Link>
          </div>
        </div>
      </nav>

      <main className={styles.registerMain}>
        <div className={styles.registerCard}>
          <div className={styles.headerGroup}>
            <div className={styles.trialBadge}>
              <span className={styles.badgeDot}></span>
              30 días de prueba gratis • Sin tarjeta de crédito
            </div>

            <h1 className={styles.cardTitle}>Crea tu cuenta profesional</h1>
            <p className={styles.cardSubtitle}>
              Comienza a gestionar tus turnos y clientes en menos de 2 minutos
            </p>
          </div>

          {/* 1. REGISTRO CON GOOGLE PRIMERO */}
          <div className={styles.googleSection}>
            <button
              type="button"
              onClick={handleGoogleRegister}
              className={styles.googleAuthBtn}
              disabled={loading}
            >
              <svg className={styles.googleIcon} viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Registrarse rápidamente con Google</span>
            </button>
          </div>

          <div className={styles.loginDivider}>
            <span>O regístrate con tu correo</span>
          </div>

          {(localError || error) && (
            <div className={styles.errorMessage}>
              <span className="material-symbols-outlined">warning</span>
              <span>{localError || error}</span>
            </div>
          )}

          {/* 2. FORMULARIO MANUAL */}
          <form onSubmit={handleSubmit} className={styles.registerForm}>
            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label>Nombre y Apellido *</label>
                <div className={styles.inputIconWrapper}>
                  <span className={`material-symbols-outlined ${styles.inputIcon}`}>person</span>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Ej: Dra. María González"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Correo Electrónico *</label>
                <div className={styles.inputIconWrapper}>
                  <span className={`material-symbols-outlined ${styles.inputIcon}`}>mail</span>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="maria@ejemplo.com"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label>Teléfono de Contacto</label>
                <div className={styles.inputIconWrapper}>
                  <span className={`material-symbols-outlined ${styles.inputIcon}`}>call</span>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Ej: +54 9 11 1234-5678"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Nombre del Negocio / Consultorio</label>
                <div className={styles.inputIconWrapper}>
                  <span className={`material-symbols-outlined ${styles.inputIcon}`}>store</span>
                  <input
                    type="text"
                    name="clinic_name"
                    value={formData.clinic_name}
                    onChange={handleChange}
                    placeholder="Ej: Centro Estético María"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label>Rubro (Categoría) *</label>
                <div className={styles.inputIconWrapper}>
                  <span className={`material-symbols-outlined ${styles.inputIcon}`}>category</span>
                  <select
                    name="rubro"
                    value={formData.rubro}
                    onChange={handleChange}
                    disabled={loading}
                    required
                  >
                    <option value="">Selecciona tu rubro...</option>
                    {Object.keys(RUBROS_ESPECIALIDADES).map(rub => (
                      <option key={rub} value={rub}>{rub}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Especialidad *</label>
                <div className={styles.inputIconWrapper}>
                  <span className={`material-symbols-outlined ${styles.inputIcon}`}>badge</span>
                  <select
                    name="specialization"
                    value={formData.specialization}
                    onChange={handleChange}
                    disabled={loading || !formData.rubro}
                    required
                  >
                    <option value="">
                      {!formData.rubro ? 'Primero selecciona un rubro' : 'Selecciona una especialidad...'}
                    </option>
                    {formData.rubro && RUBROS_ESPECIALIDADES[formData.rubro]?.map(spec => (
                      <option key={spec} value={spec}>{spec}</option>
                    ))}
                    {formData.rubro && (
                      <option value="__custom__">+ Agregar otra especialidad...</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            {isCustomSpecialty && (
              <div className={styles.row}>
                <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                  <label>Escribe tu especialidad personalizada *</label>
                  <div className={styles.inputIconWrapper}>
                    <span className={`material-symbols-outlined ${styles.inputIcon}`}>edit</span>
                    <input
                      type="text"
                      value={customSpecialty}
                      onChange={(e) => setCustomSpecialty(e.target.value)}
                      placeholder="Ej: Neuropediatría, Microblading Avanzado, etc."
                      disabled={loading}
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label>Contraseña *</label>
                <div className={styles.inputIconWrapper}>
                  <span className={`material-symbols-outlined ${styles.inputIcon}`}>lock</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Mínimo 6 caracteres"
                    disabled={loading}
                  />
                  <button 
                    type="button" 
                    className={styles.togglePasswordBtn} 
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label="Ver u ocultar contraseña"
                  >
                    <span className="material-symbols-outlined">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Confirmar Contraseña *</label>
                <div className={styles.inputIconWrapper}>
                  <span className={`material-symbols-outlined ${styles.inputIcon}`}>lock_reset</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Repite tu contraseña"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <button type="submit" className={styles.ingresarBtn} disabled={loading}>
              {loading ? 'Creando tu cuenta...' : 'Crear Cuenta Gratis'}
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </form>

          <div className={styles.loginPrompt}>
            ¿Ya tienes una cuenta registrada? <Link to="/login">Inicia sesión aquí</Link>
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        <p>© 2026 TurnoHub. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

