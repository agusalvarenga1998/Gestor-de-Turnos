import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSellerAuth } from '../context/SellerAuthContext';
import styles from './SellerDashboardPage.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

const SellerDashboardPage = () => {
  const { seller, token, logout, startDemoMode } = useSellerAuth();
  
  // Estado de Pestañas: 'seguimiento' o 'demos'
  const [activeTab, setActiveTab] = useState('seguimiento');

  // Datos de Pestaña Seguimiento
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [errorDoctors, setErrorDoctors] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Estado de edición de notas comerciales
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [savingNoteId, setSavingNoteId] = useState(null);

  // Datos de Pestaña Demos por Plan
  const [planDemos, setPlanDemos] = useState([]);
  const [loadingDemos, setLoadingDemos] = useState(true);
  const [launchingPlanKey, setLaunchingPlanKey] = useState(null);

  // Cargar Profesionales para Seguimiento
  const fetchDoctors = async () => {
    setLoadingDoctors(true);
    setErrorDoctors(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/seller/doctors`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setDoctors(response.data.doctors);
      }
    } catch (err) {
      console.error('Error al cargar profesionales:', err);
      setErrorDoctors('No se pudo cargar el listado de profesionales');
    } finally {
      setLoadingDoctors(false);
    }
  };

  // Cargar Demos por Plan
  const fetchPlanDemos = async () => {
    setLoadingDemos(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/seller/plans-demo`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setPlanDemos(response.data.plans);
      }
    } catch (err) {
      console.error('Error al cargar demos por plan:', err);
    } finally {
      setLoadingDemos(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDoctors();
      fetchPlanDemos();
    }
  }, [token]);

  // Guardar Nota de Seguimiento Comercial
  const handleSaveNote = async (doctorId) => {
    setSavingNoteId(doctorId);
    try {
      const response = await axios.put(
        `${API_BASE_URL}/api/seller/doctors/${doctorId}/notes`,
        { notes: noteText },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setDoctors((prev) =>
          prev.map((doc) => (doc.id === doctorId ? { ...doc, seller_notes: noteText } : doc))
        );
        setEditingNoteId(null);
      }
    } catch (err) {
      console.error('Error al guardar nota comercial:', err);
    } finally {
      setSavingNoteId(null);
    }
  };

  // Lanzar Demo de un Plan Específico
  const handleLaunchPlanDemo = async (planKey) => {
    setLaunchingPlanKey(planKey);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/seller/launch-plan-demo/${planKey}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const { token: doctorDemoToken, doctor } = response.data;
        localStorage.setItem('token', doctorDemoToken);
        localStorage.setItem('isDemoMode', 'true');
        localStorage.setItem('demoDoctorName', doctor.name);

        window.location.href = '/dashboard';
      }
    } catch (err) {
      console.error('Error al lanzar demo de plan:', err);
      alert('Error al iniciar la demostración del plan');
    } finally {
      setLaunchingPlanKey(null);
    }
  };

  // Lanzar sesión demo sobre un profesional real
  const handleStartDoctorDemo = async (doctorId) => {
    await startDemoMode(doctorId);
  };

  // Filtrado de profesionales
  const filteredDoctors = doctors.filter((doc) => {
    const queryLower = searchQuery.toLowerCase();
    const matchesSearch =
      doc.name.toLowerCase().includes(queryLower) ||
      doc.email.toLowerCase().includes(queryLower) ||
      doc.rubro.toLowerCase().includes(queryLower) ||
      doc.specialization.toLowerCase().includes(queryLower) ||
      (doc.seller_notes && doc.seller_notes.toLowerCase().includes(queryLower));

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
            <div className={styles.brandSubtitle}>Panel de Seguimiento & Centro de Demos por Plan</div>
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
        {/* Navegación de Pestañas */}
        <div className={styles.tabsContainer}>
          <button
            onClick={() => setActiveTab('seguimiento')}
            className={`${styles.tabButton} ${activeTab === 'seguimiento' ? styles.tabActive : ''}`}
          >
            <span className="material-symbols-outlined">monitoring</span>
            1. Seguimiento de Profesionales ({doctors.length})
          </button>

          <button
            onClick={() => setActiveTab('demos')}
            className={`${styles.tabButton} ${activeTab === 'demos' ? styles.tabActive : ''}`}
          >
            <span className="material-symbols-outlined">slideshow</span>
            2. Centro de Demos por Plan (Demos Pre-cargadas)
          </button>
        </div>

        {/* CONTENIDO PESTAÑA 1: SEGUIMIENTO DE PROFESIONALES */}
        {activeTab === 'seguimiento' && (
          <>
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
                  placeholder="Buscar profesional, email, rubro o notas..."
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
                <option value="all">Todos los estados ({doctors.length})</option>
                <option value="active">Activos</option>
                <option value="expiring_soon">Vencimiento cercano (&lt; 7 días)</option>
                <option value="trial">Prueba gratis</option>
                <option value="expired">Vencidos</option>
              </select>
            </div>

            {/* Tabla de Profesionales y Seguimiento */}
            <div className={styles.tableCard}>
              {loadingDoctors ? (
                <div className={styles.emptyState}>Cargando profesionales...</div>
              ) : errorDoctors ? (
                <div className={styles.emptyState} style={{ color: '#b91c1c' }}>{errorDoctors}</div>
              ) : filteredDoctors.length === 0 ? (
                <div className={styles.emptyState}>No se encontraron profesionales con los filtros aplicados.</div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Profesional / Rubro</th>
                      <th>Plan Contratado</th>
                      <th>Vencimiento</th>
                      <th>Notas Comercial</th>
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
                              Prueba gratis
                            </span>
                          ) : doc.expiration_status === 'expired' ? (
                            <span className={`${styles.statusBadge} ${styles.badgeExpired}`}>
                              Vencido
                            </span>
                          ) : (
                            <span className={`${styles.statusBadge} ${styles.badgeActive}`}>
                              {doc.plan_name}
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
                                : `${doc.days_remaining} días`}
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

                        {/* Columna de Anotación Comercial */}
                        <td>
                          <div className={styles.notesBox}>
                            {editingNoteId === doc.id ? (
                              <div>
                                <textarea
                                  value={noteText}
                                  onChange={(e) => setNoteText(e.target.value)}
                                  className={styles.notesInput}
                                  rows={2}
                                  placeholder="Escribe nota de seguimiento..."
                                />
                                <button
                                  onClick={() => handleSaveNote(doc.id)}
                                  disabled={savingNoteId === doc.id}
                                  className={styles.saveNoteBtn}
                                >
                                  {savingNoteId === doc.id ? 'Guardando...' : 'Guardar'}
                                </button>
                              </div>
                            ) : (
                              <div>
                                <div className={styles.noteText}>
                                  {doc.seller_notes ? doc.seller_notes : <em>Sin notas registradas</em>}
                                </div>
                                <button
                                  onClick={() => {
                                    setEditingNoteId(doc.id);
                                    setNoteText(doc.seller_notes || '');
                                  }}
                                  className={styles.editNoteBtn}
                                >
                                  ✏️ {doc.seller_notes ? 'Editar nota' : 'Agregar nota'}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        <td>
                          <button
                            onClick={() => handleStartDoctorDemo(doc.id)}
                            className={styles.demoBtn}
                            title="Ingresar a la pantalla de este profesional"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>preview</span>
                            Ver Pantalla
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* CONTENIDO PESTAÑA 2: CENTRO DE DEMOS POR PLAN */}
        {activeTab === 'demos' && (
          <>
            <div className={styles.demosHeader}>
              <h2 className={styles.demosTitle}>
                <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>slideshow</span>
                Entornos de Demostración Pre-cargados por Plan
              </h2>
              <div className={styles.demosSubtitle}>
                Haz clic en <strong>"Lanzar Demo"</strong> en cualquiera de los planes para iniciar una presentación en vivo para tu cliente.
                Cada plan cuenta con un consultorio/negocio pre-configurado con <strong>turnos agendados, pacientes, movimientos de caja, odontograma o fila virtual</strong> cargados para mostrar todas las funcionalidades en tiempo real.
              </div>
            </div>

            {loadingDemos ? (
              <div className={styles.emptyState}>Cargando entorno de demos...</div>
            ) : (
              <div className={styles.plansGrid}>
                {planDemos.map((plan) => (
                  <div key={plan.planKey} className={styles.planCard}>
                    <span
                      className={styles.planBadge}
                      style={{ backgroundColor: plan.badgeColor }}
                    >
                      {plan.badgeText}
                    </span>

                    <div>
                      <h3 className={styles.planTitle}>{plan.title}</h3>
                      <div className={styles.planSubtitle}>{plan.subtitle}</div>
                      <div className={styles.planPrice}>{plan.price}</div>

                      <ul className={styles.featureList}>
                        {plan.features.map((feat, idx) => (
                          <li key={idx} className={styles.featureItem}>
                            <span className={`material-symbols-outlined ${styles.featureCheck}`}>check_circle</span>
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>

                      <div className={styles.mockSummaryBox}>
                        <div className={styles.mockSummaryTitle}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>inventory_2</span>
                          Datos Pre-cargados en esta Demo:
                        </div>
                        <div>{plan.demoDataSummary}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleLaunchPlanDemo(plan.planKey)}
                      disabled={launchingPlanKey === plan.planKey}
                      className={styles.launchDemoBtn}
                    >
                      <span className="material-symbols-outlined">play_circle</span>
                      {launchingPlanKey === plan.planKey
                        ? 'Abriendo Demostración...'
                        : `Lanzar Demo ${plan.planKey === 'mensual_pro' ? 'Mensual Pro' : plan.title.split(' ')[1]}`}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default SellerDashboardPage;
