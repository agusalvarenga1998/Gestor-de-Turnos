import React, { useState, useEffect, useRef } from 'react';
import DoctorLayout from '../components/DoctorLayout';
import Icon from '../components/Icon';
import { doctorAPI } from '../services/api';
import styles from './WorkingHoursPage.module.css';

const DAYS = [
  { id: 1, name: 'Lunes' },
  { id: 2, name: 'Martes' },
  { id: 3, name: 'Miércoles' },
  { id: 4, name: 'Jueves' },
  { id: 5, name: 'Viernes' },
  { id: 6, name: 'Sábado' },
  { id: 0, name: 'Domingo' }
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
      const rawAvailability = response.availability || [];

      // Mapear franjas horarias a estructura de 2 turnos por día
      const allDays = DAYS.map(day => {
        const matchingRows = rawAvailability.filter(h => h.day_of_week === day.id);

        if (matchingRows.length === 0) {
          return {
            day_of_week: day.id,
            is_available: false,
            morning_enabled: true,
            morning_start: '08:00',
            morning_end: '12:00',
            afternoon_enabled: false,
            afternoon_start: '16:00',
            afternoon_end: '20:00'
          };
        }

        if (matchingRows.length === 1) {
          const row = matchingRows[0];
          const start = String(row.start_time || '09:00').substring(0, 5);
          const end = String(row.end_time || '17:00').substring(0, 5);

          if (end <= '14:00') {
            return {
              day_of_week: day.id,
              is_available: true,
              morning_enabled: true,
              morning_start: start,
              morning_end: end,
              afternoon_enabled: false,
              afternoon_start: '16:00',
              afternoon_end: '20:00'
            };
          } else if (start >= '13:00') {
            return {
              day_of_week: day.id,
              is_available: true,
              morning_enabled: false,
              morning_start: '08:00',
              morning_end: '12:00',
              afternoon_enabled: true,
              afternoon_start: start,
              afternoon_end: end
            };
          } else {
            // Jornada continua de 1 solo turno
            return {
              day_of_week: day.id,
              is_available: true,
              morning_enabled: true,
              morning_start: start,
              morning_end: end,
              afternoon_enabled: false,
              afternoon_start: '16:00',
              afternoon_end: '20:00'
            };
          }
        }

        // 2 o más turnos cargados
        const r1 = matchingRows[0];
        const r2 = matchingRows[1];

        return {
          day_of_week: day.id,
          is_available: true,
          morning_enabled: true,
          morning_start: String(r1.start_time).substring(0, 5),
          morning_end: String(r1.end_time).substring(0, 5),
          afternoon_enabled: true,
          afternoon_start: String(r2.start_time).substring(0, 5),
          afternoon_end: String(r2.end_time).substring(0, 5)
        };
      });

      setWorkingHours(allDays);
    } catch (err) {
      console.error('Error cargando horarios:', err);
      const defaultHours = DAYS.map(day => ({
        day_of_week: day.id,
        is_available: day.id >= 1 && day.id <= 5,
        morning_enabled: true,
        morning_start: '08:00',
        morning_end: '12:00',
        afternoon_enabled: false,
        afternoon_start: '16:00',
        afternoon_end: '20:00'
      }));
      setWorkingHours(defaultHours);
    } finally {
      setLoading(false);
    }
  };

  const autoSaveWorkingHours = async (hoursState) => {
    try {
      setSaveStatus('saving');

      // Transformar estructura de 2 turnos a lista de franjas para el backend
      const payload = [];

      hoursState.forEach(day => {
        if (day.is_available) {
          if (day.morning_enabled && day.morning_start && day.morning_end) {
            payload.push({
              day_of_week: day.day_of_week,
              start_time: day.morning_start,
              end_time: day.morning_end,
              is_available: true
            });
          }
          if (day.afternoon_enabled && day.afternoon_start && day.afternoon_end) {
            payload.push({
              day_of_week: day.day_of_week,
              start_time: day.afternoon_start,
              end_time: day.afternoon_end,
              is_available: true
            });
          }
        }
      });

      const response = await doctorAPI.updateWorkingHours(payload);
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

  const handleToggleDay = (dayId) => {
    setWorkingHours(prev => prev.map(day => {
      if (day.day_of_week === dayId) {
        const nextAvailable = !day.is_available;
        return {
          ...day,
          is_available: nextAvailable,
          morning_enabled: nextAvailable ? (day.morning_enabled || !day.afternoon_enabled) : day.morning_enabled
        };
      }
      return day;
    }));
  };

  const handleToggleShift = (dayId, shiftType) => {
    setWorkingHours(prev => prev.map(day => {
      if (day.day_of_week === dayId) {
        const isMorning = shiftType === 'morning';
        const newMorning = isMorning ? !day.morning_enabled : day.morning_enabled;
        const newAfternoon = !isMorning ? !day.afternoon_enabled : day.afternoon_enabled;

        return {
          ...day,
          morning_enabled: newMorning,
          afternoon_enabled: newAfternoon,
          is_available: newMorning || newAfternoon
        };
      }
      return day;
    }));
  };

  const handleTimeChange = (dayId, field, value) => {
    setWorkingHours(prev => prev.map(day => {
      if (day.day_of_week === dayId) {
        return {
          ...day,
          [field]: value
        };
      }
      return day;
    }));
  };

  const handleCopyMondayToWeek = () => {
    const monday = workingHours.find(h => h.day_of_week === 1);
    if (!monday) return;

    setWorkingHours(prev => prev.map(day => {
      if (day.day_of_week >= 2 && day.day_of_week <= 5) {
        return {
          ...day,
          is_available: monday.is_available,
          morning_enabled: monday.morning_enabled,
          morning_start: monday.morning_start,
          morning_end: monday.morning_end,
          afternoon_enabled: monday.afternoon_enabled,
          afternoon_start: monday.afternoon_start,
          afternoon_end: monday.afternoon_end
        };
      }
      return day;
    }));
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
      is_available: false,
      morning_enabled: true,
      morning_start: '08:00',
      morning_end: '12:00',
      afternoon_enabled: false,
      afternoon_start: '16:00',
      afternoon_end: '20:00'
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
              <h1 className={styles.title}>Horarios de Atención</h1>
              <p className={styles.subtitle}>
                Configura tus turnos de Mañana y Tarde con descanso al mediodía. Se guardan automáticamente.
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

          <div className={styles.quickTools}>
            <button 
              type="button" 
              onClick={handleCopyMondayToWeek}
              className={styles.copyBtn}
              title="Copiar la configuración de Lunes a Martes, Miércoles, Jueves y Viernes"
            >
              <Icon name="copy" size={16} color="currentColor" />
              Copiar Lunes a Lun-Vie
            </button>
          </div>
        </div>

        <div className={styles.scheduleContainer}>
          <div className={styles.scheduleGrid}>
            {DAYS.map(day => {
              const hours = getHoursForDay(day.id);
              const isAvailable = hours?.is_available ?? false;

              return (
                <div key={day.id} className={`${styles.dayCard} ${!isAvailable ? styles.disabledCard : ''}`}>
                  <div className={styles.dayHeader}>
                    <div className={styles.dayTitleGroup}>
                      <h3>{day.name}</h3>
                      {isAvailable ? (
                        <span className={styles.statusBadgeActive}>Atiende</span>
                      ) : (
                        <span className={styles.statusBadgeInactive}>No atiende</span>
                      )}
                    </div>
                    <label className={styles.toggle} title="Habilitar/Deshabilitar este día">
                      <input
                        type="checkbox"
                        checked={isAvailable}
                        onChange={() => handleToggleDay(day.id)}
                      />
                      <span className={styles.toggleSlider}></span>
                    </label>
                  </div>

                  {isAvailable ? (
                    <div className={styles.shiftsContainer}>
                      {/* Turno Mañana */}
                      <div className={`${styles.shiftBlock} ${!hours.morning_enabled ? styles.shiftDisabled : ''}`}>
                        <div className={styles.shiftHeader}>
                          <label className={styles.shiftCheckLabel}>
                            <input
                              type="checkbox"
                              checked={hours.morning_enabled}
                              onChange={() => handleToggleShift(day.id, 'morning')}
                            />
                            <span className={styles.shiftTitle}>☀️ Turno Mañana</span>
                          </label>
                        </div>

                        {hours.morning_enabled && (
                          <div className={styles.timeInputs}>
                            <div className={styles.timeGroup}>
                              <label>Desde</label>
                              <input
                                type="time"
                                value={hours.morning_start || '08:00'}
                                onChange={(e) => handleTimeChange(day.id, 'morning_start', e.target.value)}
                              />
                            </div>
                            <div className={styles.timeGroup}>
                              <label>Hasta</label>
                              <input
                                type="time"
                                value={hours.morning_end || '12:00'}
                                onChange={(e) => handleTimeChange(day.id, 'morning_end', e.target.value)}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Turno Tarde */}
                      <div className={`${styles.shiftBlock} ${!hours.afternoon_enabled ? styles.shiftDisabled : ''}`}>
                        <div className={styles.shiftHeader}>
                          <label className={styles.shiftCheckLabel}>
                            <input
                              type="checkbox"
                              checked={hours.afternoon_enabled}
                              onChange={() => handleToggleShift(day.id, 'afternoon')}
                            />
                            <span className={styles.shiftTitle}>🌙 Turno Tarde</span>
                          </label>
                        </div>

                        {hours.afternoon_enabled && (
                          <div className={styles.timeInputs}>
                            <div className={styles.timeGroup}>
                              <label>Desde</label>
                              <input
                                type="time"
                                value={hours.afternoon_start || '16:00'}
                                onChange={(e) => handleTimeChange(day.id, 'afternoon_start', e.target.value)}
                              />
                            </div>
                            <div className={styles.timeGroup}>
                              <label>Hasta</label>
                              <input
                                type="time"
                                value={hours.afternoon_end || '20:00'}
                                onChange={(e) => handleTimeChange(day.id, 'afternoon_end', e.target.value)}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className={styles.notAvailable}>
                      Cerrado todo el día
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
            {saveStatus === 'saving' ? 'Guardando...' : saveStatus === 'saved' ? '¡Guardado!' : 'Guardar Horarios'}
          </button>
        </div>
      </div>
    </DoctorLayout>
  );
}

