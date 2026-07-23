import React from 'react';
import axios from 'axios';
import styles from './ErrorBoundary.module.css';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('⚠️ ErrorBoundary capturó un error no controlado:', error, errorInfo);

    // Reportar el error automáticamente al backend
    try {
      const baseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002';
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      axios.post(`${baseUrl}/api/support/client-error`, {
        errorMessage: error?.message || 'React UI Crash',
        errorStack: error?.stack || '',
        componentStack: errorInfo?.componentStack || '',
        url: window.location.href
      }, { headers }).catch(err => console.error('Error al notificar error al backend:', err));
    } catch (e) {
      console.error('Error en logging de ErrorBoundary:', e);
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.container}>
          <div className={styles.card}>
            <div className={styles.iconCircle}>🚨</div>
            <h1 className={styles.title}>Ocurrió un inconveniente inesperado</h1>
            <p className={styles.message}>
              Disculpa las molestias. Los detalles técnicos de este problema han sido registrados y enviados automáticamente a nuestro equipo a <strong>admin.turnohub@gmail.com</strong>.
            </p>
            <div className={styles.actions}>
              <a href="/support" className={styles.supportBtn}>
                Comunícate con Soporte Técnico
              </a>
              <button onClick={this.handleReload} className={styles.retryBtn}>
                Reintentar / Volver al Inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
