import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useWebSocketContext } from '../hooks/useWebSocketContext';
import WebSocketStatus from '../components/WebSocketStatus';
import styles from './DashboardPage.module.css';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isConnected, subscribeDoctor } = useWebSocketContext();
  const [loading, setLoading] = useState(false);
  const [updates, setUpdates] = useState([]);

  // Suscribirse a actualizaciones del doctor
  useEffect(() => {
    if (!user?.id) return;

    const handleDoctorUpdate = (message) => {
      console.log('📤 Actualización del doctor recibida:', message);
      setUpdates(prev => [{
        type: 'doctor_update',
        message: `Actualización: ${JSON.stringify(message.update)}`,
        timestamp: new Date().toLocaleTimeString()
      }, ...prev.slice(0, 4)]);
    };

    const unsubscribe = subscribeDoctor(user.id, handleDoctorUpdate);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.id, subscribeDoctor]);

  const handleLogout = async () => {
    setLoading(true);
    await logout();
    navigate('/login');
  };

  return (
    <div className={styles.container}>
      <nav className={styles.navbar}>
        <div className={styles.navContent}>
          <div className={styles.logoSection}>
            <h1 className={styles.logo}>🏥 Turnos Médicos</h1>
          </div>
          <div className={styles.wsStatus}>
            <WebSocketStatus />
          </div>
          <div className={styles.userSection}>
            <span className={styles.userName}>{user?.name}</span>
            <button
              className={styles.logoutBtn}
              onClick={handleLogout}
              disabled={loading}
            >
              {loading ? 'Cerrando sesión...' : 'Cerrar Sesión'}
            </button>
          </div>
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.header}>
          <h2>Bienvenido, {user?.name}</h2>
          <p className={styles.subtitle}>Dashboard en desarrollo (FASE 3)</p>
        </div>

        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.cardIcon}>📅</div>
            <h3>Mis Turnos</h3>
            <p>Gestiona tus citas y pacientes</p>
            <button className={styles.cardBtn}>En desarrollo</button>
          </div>

          <div className={styles.card}>
            <div className={styles.cardIcon}>👥</div>
            <h3>Pacientes</h3>
            <p>Administra tu base de datos</p>
            <button className={styles.cardBtn}>En desarrollo</button>
          </div>

          <div className={styles.card}>
            <div className={styles.cardIcon}>📊</div>
            <h3>Reportes</h3>
            <p>Estadísticas y análisis</p>
            <button className={styles.cardBtn}>En desarrollo</button>
          </div>

          <div className={styles.card}>
            <div className={styles.cardIcon}>⚙️</div>
            <h3>Configuración</h3>
            <p>Actualiza tu perfil</p>
            <button className={styles.cardBtn}>En desarrollo</button>
          </div>
        </div>

        <div className={styles.grid}>
          <div className={styles.infoBox}>
            <h3>📋 Estado del Proyecto</h3>
            <p><strong>FASE 1:</strong> Setup Base & Autenticación ✅ <em>(Completado)</em></p>
            <p><strong>FASE 2:</strong> Backend Core (Turnos, WebSocket) ✅ <em>(Completado)</em></p>
            <p><strong>FASE 2.5:</strong> WebSocket & Tiempo Real ⏳ <em>(En desarrollo)</em></p>
            <p><strong>FASE 3:</strong> Panel Doctor (Interfaz Completa)</p>
            <p><strong>FASE 4:</strong> Portal Paciente</p>
            <p><strong>FASE 5:</strong> Testing & Optimizaciones</p>
            <p><strong>FASE 6:</strong> Deploy a Producción</p>
          </div>

          <div className={styles.infoBox}>
            <h3>⚡ Actualizaciones en Tiempo Real</h3>
            {updates.length === 0 ? (
              <p style={{ color: 'var(--gray)', fontStyle: 'italic' }}>
                Esperando actualizaciones... {isConnected ? '🟢' : '🔴'}
              </p>
            ) : (
              <div>
                {updates.map((update, index) => (
                  <p key={index} style={{ fontSize: 'var(--font-size-sm)' }}>
                    <span style={{ color: 'var(--primary-color)' }}>[{update.timestamp}]</span> {update.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
