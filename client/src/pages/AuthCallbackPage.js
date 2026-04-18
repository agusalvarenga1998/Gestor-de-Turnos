import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import styles from './AuthCallbackPage.module.css';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { loginWithGoogle } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const error = searchParams.get('error');

  useEffect(() => {
    const handleCallback = async () => {
      if (error) {
        console.error('Error en callback:', error);
        navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true });
        return;
      }

      if (!token) {
        navigate('/login?error=no_token', { replace: true });
        return;
      }

      try {
        console.log('🔐 Procesando token de Google Auth...');
        await loginWithGoogle(token);
        console.log('✓ Autenticación exitosa, redirigiendo al dashboard...');
        navigate('/dashboard', { replace: true });
      } catch (err) {
        console.error('Error procesando callback:', err);
        navigate(`/login?error=${encodeURIComponent('Error al procesar la autenticación')}`, { replace: true });
      }
    };

    handleCallback();
  }, [token, error, navigate, loginWithGoogle]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.spinner}></div>
        <h2>Autenticando...</h2>
        <p>Por favor espera mientras completamos tu autenticación con Google</p>
      </div>
    </div>
  );
}
