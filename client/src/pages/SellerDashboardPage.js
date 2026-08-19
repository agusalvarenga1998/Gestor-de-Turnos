import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSellerAuth } from '../context/SellerAuthContext';
import styles from './SellerDashboardPage.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

const SellerDashboardPage = () => {
  const { seller, token, logout, startDemoMode } = useSellerAuth();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startingDemoId, setStartingDemoId] = useState(null);

  const fetchDoctors = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/seller/doctors`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setDoctors(response.data.doctors);
      }
    } catch (err) {
      console.error('Error al cargar profesionales:', err);
      setError('No se pudo cargar el listado de profesionales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDoctors();
    }
  }, [token]);

  const handleStartDemo = async (doctorId) => {
    setStartingDemoId(doctorId);
    try {
      await startDemoMode(doctorId);
    } finally {
      setStartingDemoId(null);
    }
  };

  // Filtrado de profesionales
  const filteredDoctors = doctors.filter((doc) => {
    const queryLower = searchQuery.toLowerCase();
    const matchesSearch =
      doc.name.toLowerCase().includes(queryLower) ||
      doc.email.toLowerCase().includes(queryLower) ||
      doc.rubro.toLowerCase().includes(queryLower) ||
      doc.specialization.toLowerCase().includes(queryLower);

    if (!matchesSearch) return false;

    if (statusFilter === 'active') return doc.expiration_status === 'active';
    if (statusFilter === 'expiring_soon') return doc.expiration_status === 'expiring_soon';
    if (statusFilter === 'trial') return doc.subscription_status === 'trial';
    if (statusFilter === 'expired') return doc.expiration_status === 'expired';

    return true;
  });

  // KPIs
  const totalActive = doctors.filter((d) => d.expiration_status === 'active').length;
  const totalExpiringSoon = doctors.filter((d) => d.expiration_status === 'expiring_soon').length;
  const totalTrial = doctors.filter((d) => d.subscription_status === 'trial').length;
  const totalExpired = doctors.filter((d) => d.expiration_status === 'expired').length;

  return (
    <div className={styles.dashboardContainer}>
      {/* TopBar */}
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <span className="material-symbols-outlined">point_of_sale</span>
          </div>
          <div>
            <h1 className={styles.brandTitle}>TurnoHub Comercial</h1>
            <div className={styles.brandSubtitle}>Panel de Vendedores & Demostraciones</div>
          </div>
        </div>

        <div className={styles.userNav}>
          <div className={styles.sellerBadge}>
            👤 {seller?.name || 'Vendedor'}
          </div>
          <button onClick={logout} className={styles.logoutButton}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
            Cerrar Sesión
          </button>
        </div>
      </header>

      <main className={styles.mainContent}>
        {/* KPI Cards */}
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiIconBox} style={{ background: '#dcfce7', color: '#15803d' }}>
              <span className="material-symbols-outlined">check_circle</span>
            </div>
            <div>
              <div className={styles.kpiValue}>{totalActive}</div>
              <div className={styles.kpiLabel}>Activos al día</div>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiIconBox} style={{ background: '#fefce8', color: '#a16207' }}>
              <span className="material-symbols-outlined">warning</span>
            </div>
            <div>
              <div className={styles.kpiValue}>{totalExpiringSoon}</div>
              <div className={styles.kpiLabel}>Vencen en &lt; 7 días</div>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiIconBox} style={{ background: '#e0f2fe', color: '#0369a1' }}>
              <span className="material-symbols-outlined">hourglass_top</span>
            </div>
            <div>
              <div className={styles.kpiValue}>{totalTrial}</div>
              <div className={styles.kpiLabel}>En Periodo de Prueba</div>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiIconBox} style={{ background: '#fee2e2', color: '#b91c1c' }}>
              <span className="material-symbols-outlined">cancel</span>
            </div>
            <div>
              <div className={styles.kpiValue}>{totalExpired}</div>
              <div className={styles.kpiLabel}>Vencidos</div>
            </div>
          </div>
        </div>

        {/* Buscador y Filtros */}
        <div className={styles.controlsSection}>
          <div className={styles.searchBox}>
            <span className={`material-symbols-outlined ${styles.searchIcon}`}>search</span>
            <input
              type="text"
              placeholder="Buscar por nombre, email, especialidad..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">Todos los profesionales ({doctors.length})</option>
            <option value="active">Activos</option>
            <option value="expiring_soon">Vencimiento cercano (&lt; 7 días)</option>
            <option value="trial">Prueba gratis</option>
            <option value="expired">Vencidos</option>
          </select>
        </div>

        {/* Tabla de Profesionales */}
        <div className={styles.tableCard}>
          {loading ? (
            <div className={styles.emptyState}>Cargando profesionales...</div>
          ) : error ? (
            <div className={styles.emptyState} style={{ color: '#b91c1c' }}>{error}</div>
          ) : filteredDoctors.length === 0 ? (
            <div className={styles.emptyState}>No se encontraron profesionales con los filtros aplicados.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Profesional / Rubro</th>
                  <th>Estado Suscripción</th>
                  <th>Vencimiento</th>
                  <th>Métricas</th>
                  <th>Acción Demo</th>
                </tr>
              </thead>
              <tbody>
                {filteredDoctors.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <div className={styles.doctorName}>{doc.name}</div>
                      <div className={styles.doctorSub}>
                        <span>{doc.email}</span>
                        {doc.phone && <span>• {doc.phone}</span>}
                        <span className={styles.rubroTag}>{doc.rubro}</span>
                      </div>
                    </td>

                    <td>
                      {doc.subscription_status === 'trial' ? (
                        <span className={`${styles.statusBadge} ${styles.badgeTrial}`}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>trial</span>
                          Prueba gratis
                        </span>
                      ) : doc.expiration_status === 'expired' ? (
                        <span className={`${styles.statusBadge} ${styles.badgeExpired}`}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>error</span>
                          Vencido
                        </span>
                      ) : (
                        <span className={`${styles.statusBadge} ${styles.badgeActive}`}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>verified</span>
                          Activo ({doc.plan_name})
                        </span>
                      )}
                    </td>

                    <td>
                      {doc.days_remaining !== null ? (
                        <span
                          className={`${styles.daysBadge} ${
                            doc.expiration_status === 'expired'
                              ? styles.daysExpired
                              : doc.expiration_status === 'expiring_soon'
                              ? styles.daysWarning
                              : styles.daysOk
                          }`}
                        >
                          {doc.expiration_status === 'expired'
                            ? 'Vencido'
                            : `${doc.days_remaining} días restantes`}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Sin fecha</span>
                      )}
                      {doc.expiration_date && (
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                          {new Date(doc.expiration_date).toLocaleDateString('es-AR')}
                        </div>
                      )}
                    </td>

                    <td>
                      <div style={{ fontSize: '13px', color: '#334155' }}>
                        👥 <strong>{doc.total_patients}</strong> pacientes
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        📅 {doc.total_appointments} turnos creados
                      </div>
                    </td>

                    <td>
                      <button
                        onClick={() => handleStartDemo(doc.id)}
                        disabled={startingDemoId === doc.id}
                        className={styles.demoBtn}
                        title="Ingresar a la pantalla de este profesional para hacer una demostración"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>slideshow</span>
                        {startingDemoId === doc.id ? 'Ingresando...' : 'Iniciar Demo'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
};

export default SellerDashboardPage;
