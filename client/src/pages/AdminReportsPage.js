import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';
import AdminLayout from '../components/AdminLayout';
import Icon from '../components/Icon';
import axios from 'axios';
import styles from './AdminReportsPage.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export default function AdminReportsPage() {
  const { token } = useAdminAuth();
  const [doctors, setDoctors] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [doctorsRes, subsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/admin/doctors`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE_URL}/api/admin/subscriptions`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (doctorsRes.data.success) {
        setDoctors(doctorsRes.data.doctors);
      }
      if (subsRes.data.success) {
        setSubscriptions(subsRes.data.subscriptions);
      }
    } catch (err) {
      console.error('Error fetching admin reports data:', err);
      setError('Ocurrió un error al cargar los datos de los reportes.');
    } finally {
      setLoading(false);
    }
  };

  // 1. Cálculos de Recaudación Financiera
  const approvedPayments = subscriptions.filter(s => s.status === 'approved' || s.status === 'paid' || s.status === 'active' || s.status === 'approved_payment');
  const totalRevenue = approvedPayments.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyRevenue = approvedPayments
    .filter(s => {
      const date = new Date(s.created_at);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    })
    .reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);

  // 2. Distribución de Estados de Suscripciones (Médicos)
  const activeCount = doctors.filter(d => d.subscription_status === 'active').length;
  const trialCount = doctors.filter(d => d.subscription_status === 'trial').length;
  const expiredCount = doctors.filter(d => d.subscription_status === 'expired' || d.subscription_status === 'unpaid').length;
  const suspendedCount = doctors.filter(d => d.status === 'suspended').length;
  
  const totalInPlan = activeCount + trialCount + expiredCount + suspendedCount;
  const activePct = totalInPlan > 0 ? (activeCount / totalInPlan) * 100 : 0;
  const trialPct = totalInPlan > 0 ? (trialCount / totalInPlan) * 100 : 0;
  const expiredPct = totalInPlan > 0 ? (expiredCount / totalInPlan) * 100 : 0;
  const suspendedPct = totalInPlan > 0 ? (suspendedCount / totalInPlan) * 100 : 0;

  // 3. Tasa de Conversión (Trial -> Active)
  const totalConvertedOrExpired = activeCount + expiredCount;
  const conversionRate = totalConvertedOrExpired > 0 
    ? ((activeCount / totalConvertedOrExpired) * 100).toFixed(1) 
    : '0.0';

  // 4. Agrupación de Ingresos por últimos 6 meses para Gráfico de Barras
  const getLast6MonthsData = () => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: d.toLocaleString('es-ES', { month: 'short' }).toUpperCase(),
        monthNum: d.getMonth(),
        year: d.getFullYear(),
        value: 0
      });
    }

    approvedPayments.forEach(s => {
      const sDate = new Date(s.created_at);
      const match = months.find(m => m.monthNum === sDate.getMonth() && m.year === sDate.getFullYear());
      if (match) {
        match.value += parseFloat(s.amount || 0);
      }
    });

    return months;
  };

  const last6Months = getLast6MonthsData();
  const maxBarValue = Math.max(...last6Months.map(m => m.value), 1);

  // 5. Ranking de Especialidades
  const getSpecializationsRank = () => {
    const counts = {};
    doctors.forEach(d => {
      if (d.specialization) {
        const cleanName = d.specialization.trim();
        counts[cleanName] = (counts[cleanName] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const topSpecializations = getSpecializationsRank();
  const maxSpecialtyCount = Math.max(...topSpecializations.map(s => s.count), 1);

  return (
    <AdminLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Reportes y Estadísticas</h1>
          <p>Visión consolidada del rendimiento de suscripciones, ingresos y distribución de profesionales de TurnoHub.</p>
        </div>

        {error && <div className={styles.errorMessage}>{error}</div>}

        {loading ? (
          <div className={styles.loader}>Cargando datos estadísticos...</div>
        ) : (
          <>
            {/* KPI Cards Grid */}
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}>
                <div>
                  <div className={styles.metricLabel}>Ingresos Históricos</div>
                  <div className={styles.metricValue}>${totalRevenue.toLocaleString()}</div>
                </div>
                <div className={styles.metricSub}>
                  Total de pagos aprobados en el sistema
                </div>
                <div className={styles.metricIcon}>💰</div>
              </div>

              <div className={styles.metricCard}>
                <div>
                  <div className={styles.metricLabel}>Ingresos Mensuales</div>
                  <div className={styles.metricValue}>${monthlyRevenue.toLocaleString()}</div>
                </div>
                <div className={styles.metricSub}>
                  Suma recaudada en el mes en curso
                </div>
                <div className={styles.metricIcon}>📈</div>
              </div>

              <div className={styles.metricCard}>
                <div>
                  <div className={styles.metricLabel}>Conversión de Trial</div>
                  <div className={styles.metricValue}>{conversionRate}%</div>
                </div>
                <div className={styles.metricSub}>
                  Profesionales que pagaron al terminar la prueba
                </div>
                <div className={styles.metricIcon}>🎯</div>
              </div>

              <div className={styles.metricCard}>
                <div>
                  <div className={styles.metricLabel}>Suscripciones Activas</div>
                  <div className={styles.metricValue}>{activeCount}</div>
                </div>
                <div className={styles.metricSub}>
                  Médicos con plan activo actualmente
                </div>
                <div className={styles.metricIcon}>👥</div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className={styles.chartsGrid}>
              {/* Facturación últimos 6 meses */}
              <div className={styles.chartCard}>
                <h3>
                  <Icon name="bar-chart-2" size={18} color="#2563eb" />
                  Ingresos Mensuales (ARS) - Últimos 6 meses
                </h3>
                <div className={styles.barChartContainer}>
                  {last6Months.map((m, idx) => {
                    const percentage = (m.value / maxBarValue) * 100;
                    return (
                      <div key={idx} className={styles.barCol}>
                        <div 
                          className={styles.bar} 
                          style={{ height: `${Math.max(percentage, 4)}%` }}
                        >
                          <span className={styles.barValueTooltip}>
                            ${m.value.toLocaleString()}
                          </span>
                        </div>
                        <span className={styles.barLabel}>{m.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Distribución de Estados de Suscripciones */}
              <div className={styles.chartCard}>
                <h3>
                  <Icon name="pie-chart" size={18} color="#10b981" />
                  Estado de Cuentas y Suscripciones
                </h3>
                
                <div className={styles.stackedProgressContainer}>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '8px', fontWeight: '600' }}>
                    Proporción sobre el total de {totalInPlan} profesionales:
                  </p>
                  <div className={styles.stackedProgress}>
                    <div className={styles.stackedSegment} style={{ width: `${activePct}%`, background: '#10b981' }} title={`Activos: ${activeCount}`} />
                    <div className={styles.stackedSegment} style={{ width: `${trialPct}%`, background: '#3b82f6' }} title={`Prueba: ${trialCount}`} />
                    <div className={styles.stackedSegment} style={{ width: `${expiredPct}%`, background: '#ef4444' }} title={`Vencidos: ${expiredCount}`} />
                    <div className={styles.stackedSegment} style={{ width: `${suspendedPct}%`, background: '#64748b' }} title={`Suspendidos: ${suspendedCount}`} />
                  </div>

                  <div className={styles.legendGrid}>
                    <div className={styles.legendItem}>
                      <span className={styles.legendDot} style={{ background: '#10b981' }} />
                      <span>Activos: {activeCount} ({activePct.toFixed(0)}%)</span>
                    </div>
                    <div className={styles.legendItem}>
                      <span className={styles.legendDot} style={{ background: '#3b82f6' }} />
                      <span>En Prueba: {trialCount} ({trialPct.toFixed(0)}%)</span>
                    </div>
                    <div className={styles.legendItem}>
                      <span className={styles.legendDot} style={{ background: '#ef4444' }} />
                      <span>Vencidos: {expiredCount} ({expiredPct.toFixed(0)}%)</span>
                    </div>
                    <div className={styles.legendItem}>
                      <span className={styles.legendDot} style={{ background: '#64748b' }} />
                      <span>Suspendidos: {suspendedCount} ({suspendedPct.toFixed(0)}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Grid: Especialidades & Últimos Movimientos */}
            <div className={styles.chartsGrid}>
              {/* Ranking Especialidades */}
              <div className={styles.chartCard}>
                <h3>
                  <Icon name="users" size={18} color="#eab308" />
                  Especialidades más Frecuentes
                </h3>
                <div className={styles.progressList}>
                  {topSpecializations.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'center' }}>No hay especialidades cargadas aún.</p>
                  ) : (
                    topSpecializations.map((spec, idx) => {
                      const specPct = (spec.count / maxSpecialtyCount) * 100;
                      return (
                        <div key={idx} className={styles.progressItem}>
                          <div className={styles.progressHeader}>
                            <span className={styles.progressName}>{spec.name}</span>
                            <span className={styles.progressVal}>{spec.count} {spec.count === 1 ? 'médico' : 'médicos'}</span>
                          </div>
                          <div className={styles.progressBarOuter}>
                            <div 
                              className={styles.progressBarInner} 
                              style={{ width: `${specPct}%`, background: '#2563eb' }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Últimas Transacciones */}
              <div className={styles.chartCard} style={{ padding: '1.25rem 0' }}>
                <h3 style={{ padding: '0 1.5rem', marginBottom: '1rem' }}>
                  <Icon name="activity" size={18} color="#ec4899" />
                  Últimos Pagos Registrados
                </h3>
                <div className={styles.tableContainer}>
                  {subscriptions.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'center', padding: '2rem' }}>No hay registros de pagos aún.</p>
                  ) : (
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Profesional</th>
                          <th>Fecha</th>
                          <th>Monto</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subscriptions.slice(0, 4).map((sub) => (
                          <tr key={sub.id}>
                            <td style={{ fontWeight: '600' }}>{sub.doctor_name || 'Desconocido'}</td>
                            <td>
                              {(() => {
                                const d = new Date(sub.created_at);
                                return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('es-ES');
                              })()}
                            </td>
                            <td>${parseFloat(sub.amount || 0).toLocaleString()}</td>
                            <td>
                              <span className={`${styles.statusBadge} ${
                                sub.status === 'approved' || sub.status === 'paid' || sub.status === 'active' || sub.status === 'approved_payment'
                                  ? styles.statusApproved
                                  : styles.statusPending
                              }`}>
                                {sub.status === 'approved' || sub.status === 'paid' || sub.status === 'active' || sub.status === 'approved_payment' ? 'Aprobado' : 'Pendiente'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
