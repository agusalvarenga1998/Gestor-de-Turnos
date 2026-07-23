import React, { useState, useEffect, useRef } from 'react';
import DoctorLayout from '../components/DoctorLayout';
import Icon from '../components/Icon';
import { doctorAPI } from '../services/api';
import styles from './WorkingHoursPage.module.css';

const DAYS = [
  { id: 0, name: 'Domingo' },
  { id: 1, name: 'Lunes' },
  { id: 2, name: 'Martes' },
  { id: 3, name: 'Miércoles' },
  { id: 4, name: 'Jueves' },
  { id: 5, name: 'Viernes' },
  { id: 6, name: 'Sábado' }
];

export default function WorkingHoursPage() {
  const [workingHours, setWorkingHours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

  const isInitialLoad = useRef(true);
  const debounceTimer = useRef(null);

  useEffect(() => {
    fetchWorkingHours();
  }, []);

  // Auto-guardado al modificar workingHours
  useEffect(() => {
    if (loading) return;

    // Evitar auto-guardado en la carga inicial de los datos
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    setSaveStatus('saving');

    debounceTimer.current = setTimeout(() => {
      autoSaveWorkingHours(workingHours);
    }, 600);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workingHours]);

  const fetchWorkingHours = async () => {
    try {
      setLoading(true);
      const response = await doctorAPI.getWorkingHours();

      // Crear horarios para todos los días, incluso los no disponibles
      const allDaysHours = DAYS.map(day => {
        const existing = (response.availability || []).find(h => h.day_of_week === day.id);
        return existing || {
          day_of_week: day.id,
          start_time: '09:00',
          end_time: '17:00',
          is_available: false
        };
      });

      setWorkingHours(allDaysHours);
    } catch (err) {
      console.error('Error cargando horarios:', err);
      const defaultHours = DAYS.map(day => ({
        day_of_week: day.id,
        start_time: '09:00',
        end_time: '17:00',
        is_available: false
      }));
      setWorkingHours(defaultHours);
    } finally {
      setLoading(false);
    }
  };

  const autoSaveWorkingHours = async (hoursToSave) => {
    try {
      setSaveStatus('saving');
      const response = await doctorAPI.updateWorkingHours(hoursToSave);
      if (response.success) {
        setSaveStatus('saved');
        setTimeout(() => {
          setSaveStatus(prev => prev === 'saved' ? 'idle' : prev);
        }, 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error('Error guardando horarios automáticamente:', err);
      setSaveStatus('error');
    }
  };

  const handleTimeChange = (dayId, field, value) => {
    setWorkingHours(prev => {
      const index = prev.findIndex(h => h.day_of_week === dayId);
      if (index !== -1) {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          [field]: value
        };
        return updated;
      } else {
        return [...prev, {
          day_of_week: dayId,
          start_time: field === 'start_time' ? value : '09:00',
          end_time: field === 'end_time' ? value : '17:00',
          is_available: true
        }];
      }
    });
  };

  const handleToggleDay = (dayId) => {
    setWorkingHours(prev => {
      const index = prev.findIndex(h => h.day_of_week === dayId);
      if (index !== -1) {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          is_available: !updated[index].is_available
        };
        return updated;
      }
      return prev;
    });
  };

  const handleManualSave = () => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    autoSaveWorkingHours(workingHours);
  };

  const getHoursForDay = (dayId) => {
    return workingHours.find(h => h.day_of_week === dayId) || {
      day_of_week: dayId,
      start_time: '09:00',
      end_time: '17:00',
      is_available: false
    };
  };

  if (loading) {
    return (
      <DoctorLayout>
        <div className={styles.container}>
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p>Cargando horarios...</p>
          </div>
        </div>
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleWrapper}>
            <div>
              <h1 className={styles.title}>Horarios de Trabajo</h1>
              <p className={styles.subtitle}>
                Configura tus días y horarios de atención. Se guardan automáticamente al modificar.
              </p>
            </div>
            
            <div className={styles.autoSaveStatusContainer}>
              {saveStatus === 'saving' && (
                <span className={styles.autoSaveBadgeSaving}>
                  ⏳ Guardando...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className={styles.autoSaveBadgeSaved}>
                  ✓ Guardado automáticamente
                </span>
              )}
              {saveStatus === 'error' && (
                <span className={styles.autoSaveBadgeError}>
                  ❌ Error al guardar automáticamente
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={styles.scheduleContainer}>
          <div className={styles.scheduleGrid}>
            {DAYS.map(day => {
              const hours = getHoursForDay(day.id);
              const isAvailable = hours?.is_available ?? false;

              return (
                <div key={day.id} className={styles.dayCard}>
                  <div className={styles.dayHeader}>
                    <h3>{day.name}</h3>
                    <label className={styles.toggle}>
                      <input
                        type="checkbox"
                        checked={isAvailable}
                        onChange={() => handleToggleDay(day.id)}
                      />
                      <span className={styles.toggleSlider}></span>
                    </label>
                  </div>

                  {isAvailable && (
                    <div className={styles.timeInputs}>
                      <div className={styles.timeGroup}>
                        <label>Desde</label>
                        <input
                          type="time"
                          value={hours?.start_time || '09:00'}
                          onChange={(e) => handleTimeChange(day.id, 'start_time', e.target.value)}
                        />
                      </div>
                      <div className={styles.timeGroup}>
                        <label>Hasta</label>
                        <input
                          type="time"
                          value={hours?.end_time || '17:00'}
                          onChange={(e) => handleTimeChange(day.id, 'end_time', e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {!isAvailable && (
                    <div className={styles.notAvailable}>
                      No Trabajo Este Día
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.actions}>
          <button
            onClick={handleManualSave}
            className={styles.saveBtn}
            disabled={saveStatus === 'saving'}
          >
            <Icon name="check" size={18} color="currentColor" />
            {saveStatus === 'saving' ? 'Guardando...' : saveStatus === 'saved' ? '¡Guardado!' : 'Guardado Automático'}
          </button>
        </div>
      </div>
    </DoctorLayout>
  );
}
