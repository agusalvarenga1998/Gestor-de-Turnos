import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Icon from '../components/Icon';
import styles from './ReportsPage.module.css';

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState('30'); // '7', '30', '90', 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      let url = `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002'}/api/doctor/statistics`;
      
      let params = {};
      if (period !== 'custom') {
        const end = new Date().toISOString().split('T')[0];
        const start = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        params = { startDate: start, endDate: end };
      } else {
        if (startDate && endDate) {
          params = { startDate, endDate };
        }
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      if (response.data.success) {
        setStats(response.data.statistics);
      } else {
        setError(response.data.message || 'Error al obtener las estadísticas.');
      }
    } catch (err) {
      console.error('Error fetching statistics:', err);
      setError('Error de red al cargar estadísticas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (period !== 'custom') {
      fetchStats();
    }
  }, [period]);

  const handleCustomSearch = (e) => {
    e.preventDefault();
    if (startDate && endDate) {
      fetchStats();
    }
  };

  if (loading && !stats) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Cargando reportes y estadísticas...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Estadísticas y Reportes</h1>
          <p className={styles.subtitle}>Analizá el rendimiento de tu consultorio y reservaciones</p>
        </div>
        
        <div className={styles.filterGroup}>
          <button 
            className={`${styles.filterBtn} ${period === '7' ? styles.active : ''}`}
            onClick={() => setPeriod('7')}
          >
            7 Días
          </button>
          <button 
            className={`${styles.filterBtn} ${period === '30' ? styles.active : ''}`}
            onClick={() => setPeriod('30')}
          >
            30 Días
          </button>
          <button 
            className={`${styles.filterBtn} ${period === '90' ? styles.active : ''}`}
            onClick={() => setPeriod('90')}
          >
            Trimestre
          </button>
          <button 
            className={`${styles.filterBtn} ${period === 'custom' ? styles.active : ''}`}
            onClick={() => setPeriod('custom')}
          >
            Personalizado
          </button>
        </div>
      </header>

      {period === 'custom' && (
        <form onSubmit={handleCustomSearch} className={styles.customDateForm}>
          <div className={styles.formInputGroup}>
            <label>Desde</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              required
            />
          </div>
          <div className={styles.formInputGroup}>
            <label>Hasta</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              required
            />
          </div>
          <button type="submit" className={styles.searchBtn}>
            <Icon name="search" size={18} /> Filtrar
          </button>
        </form>
      )}

      {error && <div className={styles.errorAlert}>{error}</div>}

      {stats && (
        <div className={styles.dashboardGrid}>
          {/* Fila 1: Métricas Clave */}
          <div className={styles.metricCard}>
            <div className={styles.cardIcon} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
              <Icon name="reports" size={24} />
            </div>
            <div className={styles.cardContent}>
              <span className={styles.cardLabel}>Ocupación del Consultorio</span>
              <span className={styles.cardValue}>{stats.occupancyRate}%</span>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${stats.occupancyRate}%`, background: '#3b82f6' }}></div>
              </div>
              <span className={styles.cardFootnote}>Sobre horas laborales configuradas</span>
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.cardIcon} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              <Icon name="wallet" size={24} />
            </div>
            <div className={styles.cardContent}>
              <span className={styles.cardLabel}>Ingresos Registrados</span>
              <span className={styles.cardValue}>${stats.totalIncome.toLocaleString('es-ES')}</span>
              <span className={styles.cardFootnote} style={{ color: '#10b981', fontWeight: 'bold' }}>✓ Caja del período reconciliada</span>
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.cardIcon} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
              <Icon name="warning" size={24} />
            </div>
            <div className={styles.cardContent}>
              <span className={styles.cardLabel}>Tasa de Cancelación</span>
              <span className={styles.cardValue}>{stats.cancellationRate}%</span>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${stats.cancellationRate}%`, background: '#ef4444' }}></div>
              </div>
              <span className={styles.cardFootnote}>Tasa de ausencias (No-show): {stats.noShowRate}%</span>
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.cardIcon} style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>
              <Icon name="users" size={24} />
            </div>
            <div className={styles.cardContent}>
              <span className={styles.cardLabel}>Clientes Activos</span>
              <span className={styles.cardValue}>{stats.newPatients + stats.recurrentPatients}</span>
              <div className={styles.patientsSplit}>
                <span className={styles.newLabel}>Nuevos: {stats.newPatients}</span>
                <span className={styles.recLabel}>Recurrentes: {stats.recurrentPatients}</span>
              </div>
            </div>
          </div>

          {/* Fila 2: Indicadores Adicionales */}
          <div className={styles.wideCard}>
            <h2 className={styles.cardTitle}>Eficiencia y Canales de Reserva</h2>
            <div className={styles.subGrid}>
              <div className={styles.statInfoBox}>
                <div className={styles.circleGraph}>
                  <svg width="80" height="80" viewBox="0 0 36 36">
                    <path
                      className={styles.circleBg}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className={styles.circleProgress}
                      strokeDasharray={`${stats.onlineBookingPercentage}, 100`}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      stroke="#8b5cf6"
                    />
                  </svg>
                  <span className={styles.circleValue}>{stats.onlineBookingPercentage}%</span>
                </div>
                <div className={styles.statInfoText}>
                  <h4>Reservas Online</h4>
                  <p>Porcentaje de turnos solicitados por pacientes a través de la web o PWA.</p>
                </div>
              </div>

              <div className={styles.statInfoBox}>
                <div className={styles.daysBadge}>
                  <span className={styles.daysValue}>{stats.avgWaitDays}</span>
                  <span className={styles.daysUnit}>días</span>
                </div>
                <div className={styles.statInfoText}>
                  <h4>Anticipación de Reserva</h4>
                  <p>Tiempo promedio transcurrido desde que el paciente solicita el turno hasta la fecha de atención.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Fila 3: Servicios y Horarios */}
          <div className={styles.splitCard}>
            <h2 className={styles.cardTitle}>Servicios Más Solicitados</h2>
            {stats.topServices.length === 0 ? (
              <p className={styles.emptyText}>No hay datos en el período.</p>
            ) : (
              <div className={styles.list}>
                {stats.topServices.map((srv, idx) => (
                  <div key={idx} className={styles.listItem}>
                    <div className={styles.listDetails}>
                      <span className={styles.itemName}>{srv.name}</span>
                      <span className={styles.itemCount}>{srv.count} turnos</span>
                    </div>
                    <div className={styles.progressTrack}>
                      <div 
                        className={styles.progressIndicator} 
                        style={{ 
                          width: `${(srv.count / stats.topServices[0].count) * 100}%`,
                          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)'
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.splitCard}>
            <h2 className={styles.cardTitle}>Horarios de Mayor Demanda</h2>
            {stats.topHours.length === 0 ? (
              <p className={styles.emptyText}>No hay datos en el período.</p>
            ) : (
              <div className={styles.list}>
                {stats.topHours.map((h, idx) => (
                  <div key={idx} className={styles.listItem}>
                    <div className={styles.listDetails}>
                      <span className={styles.itemName}><Icon name="clock" size={16} /> {h.time} hs</span>
                      <span className={styles.itemCount}>{h.count} reservaciones</span>
                    </div>
                    <div className={styles.progressTrack}>
                      <div 
                        className={styles.progressIndicator} 
                        style={{ 
                          width: `${(h.count / stats.topHours[0].count) * 100}%`,
                          background: 'linear-gradient(90deg, #10b981, #3b82f6)'
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
