import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';
import AdminLayout from '../components/AdminLayout';
import Loading from '../components/Loading';
import axios from 'axios';
import styles from './AdminDoctorsPage.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

export default function AdminDoctorsPage() {
  const { token } = useAdminAuth();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [extendDays, setExtendDays] = useState(30);
  const [amount, setAmount] = useState(0);
  const [planType, setPlanType] = useState('monthly');
  const [commissionRate, setCommissionRate] = useState(3);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/admin/doctors`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setDoctors(response.data.doctors);
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action) => {
    setActionLoading(true);
    try {
      let response;
      const doctorId = selectedDoctor.id;

      switch (action) {
        case 'approve':
          response = await axios.patch(
            `${API_BASE_URL}/api/admin/doctors/${doctorId}/approve`,
            { amount: parseFloat(amount) || 0 },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          break;
        case 'reject':
          response = await axios.patch(
            `${API_BASE_URL}/api/admin/doctors/${doctorId}/reject`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          break;
        case 'suspend':
          response = await axios.patch(
            `${API_BASE_URL}/api/admin/doctors/${doctorId}/suspend`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          break;
        case 'extend':
          response = await axios.post(
            `${API_BASE_URL}/api/admin/doctors/${doctorId}/extend`,
            { days: extendDays, amount: parseFloat(amount) || 0 },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          break;
        case 'reactivate':
          response = await axios.patch(
            `${API_BASE_URL}/api/admin/doctors/${doctorId}/reactivate`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          break;
        case 'reset-debt':
          response = await axios.patch(
            `${API_BASE_URL}/api/admin/doctors/${doctorId}/reset-debt`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          break;
        case 'change-plan':
          response = await axios.patch(
            `${API_BASE_URL}/api/admin/doctors/${doctorId}/plan`,
            { plan_type: planType, commission_rate: parseFloat(commissionRate) || 3 },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          break;
        default:
          break;
      }

      if (response?.data?.success) {
        // Actualizar la lista de doctores
        await fetchDoctors();
        setActionModal(null);
        setSelectedDoctor(null);
      }
    } catch (error) {
      console.error('Error performing action:', error);
      alert('Error al realizar la acción');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: '#fbbf24', label: 'Pendiente' },
      approved: { color: '#34d399', label: 'Aprobado' },
      rejected: { color: '#f87171', label: 'Rechazado' },
      suspended: { color: '#a78bfa', label: 'Suspendido' }
    };
    const config = statusConfig[status] || { color: '#9ca3af', label: status };
    return (
      <span
        className={styles.badge}
        style={{ backgroundColor: config.color + '20', color: config.color }}
      >
        {config.label}
      </span>
    );
  };

  const getSubscriptionStatus = (doctor) => {
    if (doctor.subscription_status === 'trial') {
      return (
        <span className={styles.badge} style={{ backgroundColor: '#fef3c7', color: '#b45309' }}>
          Trial
        </span>
      );
    }
    if (doctor.subscription_status === 'active') {
      return (
        <span className={styles.badge} style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
          Activa
        </span>
      );
    }
    if (doctor.subscription_status === 'expired') {
      return (
        <span className={styles.badge} style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
          Vencida
        </span>
      );
    }
    return <span className={styles.badge}>-</span>;
  };

  if (loading) {
    return (
      <AdminLayout>
        <Loading />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Gestión de Profesionales</h1>
        <p>Total: {doctors.length} profesionales</p>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rubro / Actividad</th>
              <th>Estado</th>
              <th>Plan</th>
              <th>Vigencia</th>
              <th>Deuda</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {doctors.map(doctor => (
              <tr key={doctor.id}>
                <td>{doctor.name}</td>
                <td>{doctor.email}</td>
                <td>{doctor.specialization || '-'}</td>
                <td>{getStatusBadge(doctor.status)}</td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {getSubscriptionStatus(doctor)}
                    <span className={styles.planBadge}>
                      {doctor.plan_type === 'commission' ? `Comisión (${doctor.commission_rate}%)` : 'Mensualidad'}
                    </span>
                    <button 
                      className={styles.planBtn}
                      onClick={() => {
                        setSelectedDoctor(doctor);
                        setPlanType(doctor.plan_type || 'monthly');
                        setCommissionRate(doctor.commission_rate || 3);
                        setActionModal('change-plan');
                      }}
                    >
                      Cambiar Plan
                    </button>
                  </div>
                </td>
                <td className={styles.expiry}>
                  {doctor.subscription_expires_at
                    ? new Date(doctor.subscription_expires_at).toLocaleDateString('es-ES')
                    : '-'}
                </td>
                <td className={styles.debt}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontWeight: 'bold', color: doctor.accumulated_debt > 0 ? '#ef4444' : '#10b981' }}>
                      ${parseFloat(doctor.accumulated_debt || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    {doctor.accumulated_debt > 0 && (
                      <button 
                        className={styles.debtBtn}
                        onClick={() => {
                          setSelectedDoctor(doctor);
                          setActionModal('reset-debt');
                        }}
                      >
                        Cobrar
                      </button>
                    )}
                  </div>
                </td>
                <td>
                  <div className={styles.actionButtons}>
                    {doctor.status === 'pending' && (
                      <>
                        <button
                          className={styles.approveBtn}
                          onClick={() => {
                            setSelectedDoctor(doctor);
                            setAmount(0);
                            setActionModal('approve');
                          }}
                        >
                          Aprobar
                        </button>
                        <button
                          className={styles.rejectBtn}
                          onClick={() => {
                            setSelectedDoctor(doctor);
                            setActionModal('reject');
                          }}
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                    {doctor.status === 'approved' && (
                      <>
                        <button
                          className={styles.extendBtn}
                          onClick={() => {
                            setSelectedDoctor(doctor);
                            setExtendDays(30);
                            setAmount(0);
                            setActionModal('extend');
                          }}
                        >
                          Extender
                        </button>
                        <button
                          className={styles.suspendBtn}
                          onClick={() => {
                            setSelectedDoctor(doctor);
                            setActionModal('suspend');
                          }}
                        >
                          Suspender
                        </button>
                      </>
                    )}
                    {doctor.status === 'suspended' && (
                      <button
                        className={styles.approveBtn}
                        onClick={() => {
                          setSelectedDoctor(doctor);
                          setActionModal('reactivate');
                        }}
                      >
                        Reactivar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Action Modal */}
      {actionModal && selectedDoctor && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2>
              {actionModal === 'approve' && 'Aprobar Profesional'}
              {actionModal === 'reject' && 'Rechazar Profesional'}
              {actionModal === 'suspend' && 'Suspender Profesional'}
              {actionModal === 'extend' && 'Extender Plan'}
              {actionModal === 'reactivate' && 'Reactivar Profesional'}
              {actionModal === 'reset-debt' && 'Registrar Cobro'}
            </h2>

            <p>
              {actionModal === 'approve' &&
                `¿Aprobar a ${selectedDoctor.name}? Obtendrá 15 días de trial.`}
              {actionModal === 'reject' && `¿Rechazar solicitud de ${selectedDoctor.name}?`}
              {actionModal === 'suspend' && `¿Suspender la cuenta de ${selectedDoctor.name}?`}
              {actionModal === 'extend' && `Extender suscripción de ${selectedDoctor.name}`}
              {actionModal === 'reactivate' && `¿Reactivar la cuenta de ${selectedDoctor.name}?`}
              {actionModal === 'reset-debt' && `Estamos por poner en cero la deuda de $${parseFloat(selectedDoctor.accumulated_debt).toLocaleString()} de ${selectedDoctor.name}. ¿Confirmar cobro?`}
              {actionModal === 'change-plan' && `Cambiar el plan de servicios para ${selectedDoctor.name}`}
            </p>

            {actionModal === 'change-plan' && (
              <div className={styles.formGroup}>
                <label htmlFor="plan_type">Tipo de Plan:</label>
                <select
                  id="plan_type"
                  value={planType}
                  onChange={(e) => setPlanType(e.target.value)}
                  className={styles.select}
                  disabled={actionLoading}
                >
                  <option value="monthly">Mensualidad (Fija)</option>
                  <option value="commission">Comisión (Por Turno)</option>
                </select>
              </div>
            )}

            {actionModal === 'change-plan' && planType === 'commission' && (
              <div className={styles.formGroup}>
                <label htmlFor="commission_rate">Porcentaje de Comisión (%):</label>
                <input
                  type="number"
                  id="commission_rate"
                  min="0"
                  max="100"
                  step="0.1"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                  disabled={actionLoading}
                />
              </div>
            )}

            {(actionModal === 'approve' || actionModal === 'extend') && (
              <>
                {actionModal === 'extend' && (
                  <div className={styles.formGroup}>
                    <label htmlFor="days">Días a extender:</label>
                    <input
                      type="number"
                      id="days"
                      min="1"
                      max="365"
                      value={extendDays}
                      onChange={e => setExtendDays(parseInt(e.target.value))}
                      disabled={actionLoading}
                    />
                  </div>
                )}
                <div className={styles.formGroup}>
                  <label htmlFor="amount">Monto a pagar ($):</label>
                  <input
                    type="number"
                    id="amount"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    disabled={actionLoading}
                    placeholder="0.00"
                  />
                </div>
              </>
            )}

            <div className={styles.modalButtons}>
              <button
                className={styles.cancelBtn}
                onClick={() => {
                  setActionModal(null);
                  setSelectedDoctor(null);
                }}
                disabled={actionLoading}
              >
                Cancelar
              </button>
              <button
                className={
                  actionModal === 'reject' || actionModal === 'suspend'
                    ? styles.dangerBtn
                    : styles.confirmBtn
                }
                onClick={() => handleAction(actionModal)}
                disabled={actionLoading}
              >
                {actionLoading ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </AdminLayout>
  );
}
