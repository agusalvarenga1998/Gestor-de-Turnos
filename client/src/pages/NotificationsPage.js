import React, { useState, useEffect } from 'react';
import DoctorLayout from '../components/DoctorLayout';
import Icon from '../components/Icon';
import { useAuth } from '../hooks/useAuth';
import apiClient from '../services/api';
import styles from './NotificationsPage.module.css';

export default function NotificationsPage() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // State matching database fields
  const [settings, setSettings] = useState({
    notify_daily_summary_push: true,
    notify_advance_push: true,
    notify_advance_time: 15,
    notify_email: true,
    notify_approval_push: true,
  });

  // Load initial doctor notification preferences from auth context
  useEffect(() => {
    if (user) {
      setSettings({
        notify_daily_summary_push: user.notify_daily_summary_push !== false,
        notify_advance_push: user.notify_advance_push !== false,
        notify_advance_time: user.notify_advance_time !== undefined && user.notify_advance_time !== null ? user.notify_advance_time : 15,
        notify_email: user.notify_email !== false,
        notify_approval_push: user.notify_approval_push !== false,
      });
    }
  }, [user]);

  const handleToggle = (field) => {
    setSettings(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleTimeChange = (e) => {
    const value = parseInt(e.target.value) || 0;
    setSettings(prev => ({
      ...prev,
      notify_advance_time: value
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setSuccessMessage('');
    setErrorMessage('');
    try {
      const response = await apiClient.put('/api/auth/profile', settings);

      if (response.data.success) {
        setSuccessMessage('✓ Preferencias de notificación guardadas correctamente');
        await refreshUser();
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        setErrorMessage('✗ Error al guardar los cambios');
      }
    } catch (err) {
      console.error('Error al guardar preferencias de notificación:', err);
      setErrorMessage('✗ Ocurrió un error al guardar los cambios');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DoctorLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Notificaciones</h1>
          <p className={styles.subtitle}>Elige cómo y cuándo quieres que TurnoHub te mantenga informado</p>
        </div>

        {successMessage && (
          <div className={styles.successMessage}>
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className={styles.errorMessage}>
            {errorMessage}
          </div>
        )}

        <div className={styles.settingsCard}>
          <div className={styles.sectionHeader}>
            <Icon name="bell" size={24} color="var(--primary-color)" />
            <h2>Alertas del Profesional</h2>
          </div>
          <p className={styles.sectionDescription}>
            Configura tus canales de comunicación preferidos para las alertas de turnos, recordatorios y notificaciones de aprobación de pacientes.
          </p>

          <div className={styles.notificationList}>
            {/* 1. Notificaciones por Email */}
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <div className={styles.iconWrapper} style={{ backgroundColor: '#eff6ff', color: '#3b82f6' }}>
                  <Icon name="mail" size={20} />
                </div>
                <div className={styles.settingText}>
                  <h3 className={styles.settingTitle}>Notificaciones por Email</h3>
                  <p className={styles.settingDesc}>Recibe correos electrónicos automáticos cuando un paciente solicita, reprograma o cancela un turno.</p>
                </div>
              </div>
              <label className={styles.toggleSwitch}>
                <input 
                  type="checkbox" 
                  checked={settings.notify_email}
                  onChange={() => handleToggle('notify_email')}
                />
                <span className={styles.slider}></span>
              </label>
            </div>

            {/* 2. Push: Aprobación de Turnos */}
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <div className={styles.iconWrapper} style={{ backgroundColor: '#fdf2f8', color: '#db2777' }}>
                  <Icon name="lock" size={20} />
                </div>
                <div className={styles.settingText}>
                  <h3 className={styles.settingTitle}>Aprobación de Turnos (Push)</h3>
                  <p className={styles.settingDesc}>Alertas push inmediatas cuando ingresan nuevos turnos pendientes de aprobación o solicitudes de confirmación.</p>
                </div>
              </div>
              <label className={styles.toggleSwitch}>
                <input 
                  type="checkbox" 
                  checked={settings.notify_approval_push}
                  onChange={() => handleToggle('notify_approval_push')}
                />
                <span className={styles.slider}></span>
              </label>
            </div>

            {/* 3. Push: Turnos Diarios */}
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <div className={styles.iconWrapper} style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                  <Icon name="calendar" size={20} />
                </div>
                <div className={styles.settingText}>
                  <h3 className={styles.settingTitle}>Resumen Diario de Agenda (Push)</h3>
                  <p className={styles.settingDesc}>Recibe una notificación push consolidada todas las noches a las 20:00 hs con el total de turnos del día siguiente.</p>
                </div>
              </div>
              <label className={styles.toggleSwitch}>
                <input 
                  type="checkbox" 
                  checked={settings.notify_daily_summary_push}
                  onChange={() => handleToggle('notify_daily_summary_push')}
                />
                <span className={styles.slider}></span>
              </label>
            </div>

            {/* 4. Push: Recordatorio previo */}
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <div className={styles.iconWrapper} style={{ backgroundColor: '#fff7ed', color: '#ea580c' }}>
                  <Icon name="clock" size={20} />
                </div>
                <div className={styles.settingText}>
                  <h3 className={styles.settingTitle}>Recordatorio de Turno Próximo (Push)</h3>
                  <p className={styles.settingDesc}>Recibe una alerta en tu dispositivo minutos antes de que inicie la cita de tu paciente.</p>
                </div>
              </div>
              <label className={styles.toggleSwitch}>
                <input 
                  type="checkbox" 
                  checked={settings.notify_advance_push}
                  onChange={() => handleToggle('notify_advance_push')}
                />
                <span className={styles.slider}></span>
              </label>
            </div>

            {/* Selector de minutos (se muestra solo si la alerta de turno próximo está activa) */}
            {settings.notify_advance_push && (
              <div className={styles.advanceTimeContainer}>
                <div className={styles.advanceTimeLabel}>
                  <span>Anticipación de la alerta:</span>
                  <span className={styles.minutesValue}>{settings.notify_advance_time} minutos</span>
                </div>
                <div className={styles.inputRangeGroup}>
                  <input 
                    type="range" 
                    min="5" 
                    max="60" 
                    step="5"
                    value={settings.notify_advance_time} 
                    onChange={handleTimeChange}
                    className={styles.rangeInput}
                  />
                  <div className={styles.rangeLabels}>
                    <span>5m</span>
                    <span>15m</span>
                    <span>30m</span>
                    <span>45m</span>
                    <span>60m</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={styles.actions}>
            <button 
              onClick={handleSave} 
              disabled={loading}
              className={styles.saveBtn}
            >
              {loading ? (
                <>
                  <div className={styles.spinner}></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Icon name="save" size={18} />
                  Guardar Preferencias
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </DoctorLayout>
  );
}
