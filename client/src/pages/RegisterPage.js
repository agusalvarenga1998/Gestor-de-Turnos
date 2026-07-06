import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Icon from '../components/Icon';
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
      // El usuario está auto-aprobado con 30 días de prueba, ir al dashboard
      navigate('/dashboard', { replace: true });
    } else {
      setLocalError(result.error);
    }
  };



  return (
    <div className={styles.pageWrapper}>
      {/* Navbar Superior para no quedar atrapado */}
      <nav className={styles.navbar}>
        <div className={styles.navContent}>
          <Link to="/" className={styles.navLogo}>
            <span className={`material-symbols-outlined ${styles.logoIcon}`}>hub</span>
            <span>TurnoHub</span>
          </Link>
          <div className={styles.navLinks}>
            <Link to="/why-turnohub">¿Cómo funciona?</Link>
            <Link to="/support">Soporte</Link>
            <Link to="/login" className={styles.navBackBtn}>Volver</Link>
          </div>
        </div>
      </nav>

      <main className={styles.registerMain}>
        <div className={styles.registerCard}>
          <h1 className={styles.cardTitle}>Únete a TurnoHub</h1>
          <p className={styles.cardSubtitle}>Crea tu cuenta profesional en segundos</p>

          {(localError || error) && (
            <div className={styles.errorMessage}>
              {localError || error}
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.registerForm}>
            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label>NOMBRE COMPLETO *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Nombre y Apellido"
                  disabled={loading}
                />
              </div>
              <div className={styles.formGroup}>
                <label>CORREO ELECTRÓNICO *</label>
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
                <label>TELÉFONO DE CONTACTO</label>
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

            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label>RUBRO (CATEGORÍA) *</label>
                <select
                  name="rubro"
                  value={formData.rubro}
                  onChange={handleChange}
                  disabled={loading}
                  required
                >
                  <option value="">Selecciona un rubro...</option>
                  {Object.keys(RUBROS_ESPECIALIDADES).map(rub => (
                    <option key={rub} value={rub}>{rub}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>ESPECIALIDAD *</label>
                <select
                  name="specialization"
                  value={formData.specialization}
                  onChange={handleChange}
                  disabled={loading || !formData.rubro}
                  required
                >
                  <option value="">Selecciona una especialidad...</option>
                  {formData.rubro && RUBROS_ESPECIALIDADES[formData.rubro]?.map(spec => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                  {formData.rubro && (
                    <option value="__custom__">+ Otra (Agregar nueva especialidad...)</option>
                  )}
                </select>
              </div>
            </div>

            {isCustomSpecialty && (
              <div className={styles.row}>
                <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                  <label>ESCRIBE TU ESPECIALIDAD PERSONALIZADA *</label>
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
            )}

            <div className={styles.row}>
              <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                <label>NEGOCIO / LOCAL</label>
                <input
                  type="text"
                  name="clinic_name"
                  value={formData.clinic_name}
                  onChange={handleChange}
                  placeholder="Nombre de tu negocio o consultorio"
                  disabled={loading}
                />
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label>CONTRASEÑA *</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>
              <div className={styles.formGroup}>
                <label>CONFIRMAR CONTRASEÑA *</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>
            </div>

            <button type="submit" className={styles.ingresarBtn} disabled={loading}>
              {loading ? 'CREANDO CUENTA...' : 'REGISTRARME AHORA'}
            </button>

            <div className={styles.loginDivider}>
              <span>Ó REGÍSTRATE CON</span>
            </div>

            <button
              type="button"
              onClick={() => window.location.href = `${API_BASE_URL}/api/auth/google`}
              className={styles.googleAuthBtn}
              disabled={loading}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" />
              Registro con Google
            </button>
          </form>

          <div className={styles.loginPrompt}>
            ¿Ya tienes una cuenta? <Link to="/login">Inicia sesión aquí</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
