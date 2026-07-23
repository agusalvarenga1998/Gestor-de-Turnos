import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAdminAuth } from '../hooks/useAdminAuth';
import AdminLayout from '../components/AdminLayout';
import Loading from '../components/Loading';
import styles from './AdminActivityPage.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002';

export default function AdminActivityPage() {
  const { token } = useAdminAuth();
  const location = useLocation();

  // Leer doctorId de los query params de la URL (si viene desde /admin/doctors)
  const queryParams = new URLSearchParams(location.search);
  const initialDoctorId = queryParams.get('doctorId') || 'all';

  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'activity'
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState(initialDoctorId);
  const [typeFilter, setTypeFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Datos
  const [movements, setMovements] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'transactions') {
      fetchTransactions();
    } else {
      fetchActivityLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedDoctorId, typeFilter, paymentMethodFilter]);

  const fetchDoctors = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/admin/doctors`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setDoctors(response.data.doctors || []);
      }
    } catch (err) {
      console.error('Error al cargar profesionales:', err);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = {
        doctorId: selectedDoctorId,
        type: typeFilter,
        paymentMethod: paymentMethodFilter
      };

      const response = await axios.get(`${API_BASE_URL}/api/admin/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      if (response.data.success) {
        setMovements(response.data.movements || []);
      }
    } catch (err) {
      console.error('Error al cargar transacciones:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityLogs = async () => {
    try {
      setLoading(true);
      const params = {
        doctorId: selectedDoctorId
      };

      const response = await axios.get(`${API_BASE_URL}/api/admin/activity-logs`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      if (response.data.success) {
        setActivityLogs(response.data.logs || []);
      }
    } catch (err) {
      console.error('Error al cargar historial de actividad:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtrado por buscador
  const filteredMovements = movements.filter(m => {
    const search = searchTerm.toLowerCase();
    return (
      (m.doctor_name && m.doctor_name.toLowerCase().includes(search)) ||
      (m.doctor_email && m.doctor_email.toLowerCase().includes(search)) ||
      (m.patient_name && m.patient_name.toLowerCase().includes(search)) ||
      (m.description && m.description.toLowerCase().includes(search))
    );
  });

  const filteredLogs = activityLogs.filter(l => {
    const search = searchTerm.toLowerCase();
    return (
      (l.doctor_name && l.doctor_name.toLowerCase().includes(search)) ||
      (l.doctor_email && l.doctor_email.toLowerCase().includes(search)) ||
      (l.action && l.action.toLowerCase().includes(search)) ||
      (l.details && l.details.toLowerCase().includes(search))
    );
  });

  // Cálculos para métricas
  const totalAmount = movements.reduce((acc, m) => acc + Number(m.amount || 0), 0);
  const mercadopagoCount = movements.filter(m => m.payment_method === 'mercadopago').length;
  const efectivoCount = movements.filter(m => m.payment_method === 'efectivo').length;
  const transferenciaCount = movements.filter(m => m.payment_method === 'transferencia').length;

  // Exportar a CSV
  const exportToCSV = () => {
    if (activeTab === 'transactions') {
      const headers = ['ID', 'Fecha', 'Profesional', 'Email', 'Paciente/Detalle', 'Tipo', 'Medio de Pago', 'Monto'];
      const rows = filteredMovements.map(m => [
        m.id,
        new Date(m.created_at).toLocaleString(),
        `"${m.doctor_name || ''}"`,
        m.doctor_email || '',
        `"${m.patient_name || m.description || ''}"`,
        m.type,
        m.payment_method,
        m.amount
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `transacciones_profesionales_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const headers = ['ID', 'Fecha', 'Profesional', 'Email', 'Accion', 'Detalles', 'IP'];
      const rows = filteredLogs.map(l => [
        l.id,
        new Date(l.created_at).toLocaleString(),
        `"${l.doctor_name || ''}"`,
        l.doctor_email || '',
        l.action,
        `"${(l.details || '').replace(/"/g, '""')}"`,
        l.ip_address || ''
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `actividad_profesionales_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const renderMovementBadge = (type) => {
    switch (type) {
      case 'cobro':
        return <span className={`${styles.badge} ${styles.badgeCobro}`}>Cobro 🟢</span>;
      case 'seña':
        return <span className={`${styles.badge} ${styles.badgeSena}`}>Seña 🟡</span>;
      case 'reembolso':
        return <span className={`${styles.badge} ${styles.badgeReembolso}`}>Reembolso 🔴</span>;
      default:
        return <span className={`${styles.badge} ${styles.badgeGasto}`}>{type}</span>;
    }
  };

  return (
    <AdminLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Transacciones y Historial de Actividades</h1>
          <p>Supervisa todos los cobros, movimientos de dinero y registros de auditoría de los profesionales.</p>
        </div>

        {/* Métricas de Transacciones */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statTitle}>Total Transaccionado</div>
            <div className={styles.statValue} style={{ color: '#10b981' }}>
              ${totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statTitle}>Movimientos Registrados</div>
            <div className={styles.statValue}>{movements.length}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statTitle}>Medios de Pago</div>
            <div style={{ fontSize: '0.9rem', color: '#475569', marginTop: '4px' }}>
              💳 MercadoPago: <strong>{mercadopagoCount}</strong> | 💵 Efectivo: <strong>{efectivoCount}</strong> | 🏦 Transf: <strong>{transferenciaCount}</strong>
            </div>
          </div>
        </div>

        {/* Pestañas */}
        <div className={styles.tabsContainer}>
          <button
            className={`${styles.tabBtn} ${activeTab === 'transactions' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('transactions')}
          >
            💳 Transacciones Financieras ({movements.length})
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'activity' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            📜 Registro de Actividades / Auditoría ({activityLogs.length})
          </button>
        </div>

        {/* Barra de Filtros */}
        <div className={styles.filterBar}>
          {/* Selector de Profesional */}
          <select
            className={styles.selectInput}
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
          >
            <option value="all">👨‍⚕️ Todos los profesionales</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.email})
              </option>
            ))}
          </select>

          {activeTab === 'transactions' && (
            <>
              <select
                className={styles.selectInput}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">Todos los tipos</option>
                <option value="cobro">Cobro</option>
                <option value="seña">Seña</option>
                <option value="reembolso">Reembolso</option>
              </select>

              <select
                className={styles.selectInput}
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
              >
                <option value="all">Todos los medios de pago</option>
                <option value="mercadopago">MercadoPago 💳</option>
                <option value="efectivo">Efectivo 💵</option>
                <option value="transferencia">Transferencia 🏦</option>
              </select>
            </>
          )}

          <input
            type="text"
            className={styles.searchInput}
            placeholder="Buscar por profesional, paciente o detalle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <button className={styles.exportBtn} onClick={exportToCSV}>
            📥 Exportar CSV
          </button>
        </div>

        {/* Tablas */}
        {loading ? (
          <Loading />
        ) : activeTab === 'transactions' ? (
          filteredMovements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', background: 'white', borderRadius: '12px' }}>
              No se encontraron transacciones financieras con los filtros aplicados.
            </div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Fecha y Hora</th>
                    <th>Profesional</th>
                    <th>Tipo</th>
                    <th>Medio de Pago</th>
                    <th>Monto ($)</th>
                    <th>Paciente / Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map(m => (
                    <tr key={m.id}>
                      <td>
                        {new Date(m.created_at).toLocaleDateString()} {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <strong>{m.doctor_name}</strong>
                        <div className={styles.doctorMeta}>{m.doctor_email}</div>
                      </td>
                      <td>{renderMovementBadge(m.type)}</td>
                      <td>
                        <span className={`${styles.badge} ${styles.badgePayment}`}>
                          {m.payment_method === 'mercadopago' && '💳 MercadoPago'}
                          {m.payment_method === 'efectivo' && '💵 Efectivo'}
                          {m.payment_method === 'transferencia' && '🏦 Transferencia'}
                          {!['mercadopago', 'efectivo', 'transferencia'].includes(m.payment_method) && m.payment_method}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: Number(m.amount) < 0 ? '#dc2626' : '#059669', fontSize: '1.05rem' }}>
                          ${Number(m.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </strong>
                      </td>
                      <td>
                        {m.patient_name ? (
                          <div><strong>Paciente:</strong> {m.patient_name}</div>
                        ) : null}
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{m.description || 'Sin descripción'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          filteredLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', background: 'white', borderRadius: '12px' }}>
              No se registraron actividades de auditoría con los filtros aplicados.
            </div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Fecha y Hora</th>
                    <th>Profesional</th>
                    <th>Acción</th>
                    <th>Detalles / Payload</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(l => (
                    <tr key={l.id}>
                      <td>
                        {new Date(l.created_at).toLocaleDateString()} {new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <strong>{l.doctor_name}</strong>
                        <div className={styles.doctorMeta}>{l.doctor_email}</div>
                      </td>
                      <td>
                        <span className={styles.badge} style={{ background: '#e0f2fe', color: '#0369a1' }}>
                          {l.action}
                        </span>
                      </td>
                      <td>
                        <div className={styles.codeBox}>{l.details || 'Sin detalles adicionales'}</div>
                      </td>
                      <td><code style={{ fontSize: '0.85rem' }}>{l.ip_address || 'N/A'}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </AdminLayout>
  );
}
