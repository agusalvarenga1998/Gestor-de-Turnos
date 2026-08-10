import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import AdminLayout from '../components/AdminLayout';
import Loading from '../components/Loading';
import axios from 'axios';
import styles from './AdminDoctorsPage.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

export default function AdminDoctorsPage() {
  const navigate = useNavigate();
  const { token } = useAdminAuth();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [extendDays, setExtendDays] = useState(30);
  const [amount, setAmount] = useState(0);
  const [planType, setPlanType] = useState('monthly');
  const [commissionRate, setCommissionRate] = useState(3);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [plans, setPlans] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    name: '',
    email: '',
    phone: '',
    license_number: '',
    rubro: '',
    specialization: '',
    clinic_name: '',
    clinic_address: ''
  });

  useEffect(() => {
    fetchDoctors();
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/admin/plans`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setPlans(response.data.plans);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

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
            { 
              pricing_plan_id: selectedPlanId, 
              commission_rate: (commissionRate !== '' && !isNaN(parseFloat(commissionRate))) ? parseFloat(commissionRate) : 3 
            },
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
    const now = new Date();
    const isTrialExpired = doctor.trial_ends_at && new Date(doctor.trial_ends_at) < now;
    const isActiveExpired = doctor.subscription_expires_at && new Date(doctor.subscription_expires_at) < now;
    const isExpired = doctor.subscription_status === 'expired' || (doctor.subscription_status === 'trial' && isTrialExpired) || (doctor.subscription_status === 'active' && isActiveExpired);

    if (isExpired) {
      return (
        <span className={styles.badge} style={{ backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 600 }}>
          {doctor.subscription_status === 'trial' || isTrialExpired ? 'Trial Vencido' : 'Vencida'}
        </span>
      );
    }
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
              <th>Profesional</th>
              <th>Contacto Directo (Email / WA)</th>
              <th>Rubro / Especialidad</th>
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
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{doctor.name}</strong>
                    {doctor.license_number && (
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Mat: {doctor.license_number}</span>
                    )}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <a href={`mailto:${doctor.email}`} className={styles.emailBtn} title="Enviar correo">
                      ✉️ {doctor.email}
                    </a>
                    {doctor.phone && doctor.phone.trim() !== '' ? (
                      <a 
                        href={`https://wa.me/${doctor.phone.replace(/[^0-9]/g, '')}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className={styles.whatsappBtn}
                        title="Abrir WhatsApp para soporte"
                      >
                        💬 {doctor.phone}
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDoctor(doctor);
                          setEditData({
                            name: doctor.name || '',
                            email: doctor.email || '',
                            phone: doctor.phone || '',
                            license_number: doctor.license_number || '',
                            rubro: doctor.rubro || '',
                            specialization: doctor.specialization || '',
                            clinic_name: doctor.clinic_name || '',
                            clinic_address: doctor.clinic_address || doctor.address || ''
                          });
                          setEditMode(true);
                          setActionModal('view-details');
                        }}
                        style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', borderRadius: '4px', padding: '2px 6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
                      >
                        ✏️ + Cargar WhatsApp
                      </button>
                    )}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong>{doctor.rubro || doctor.specialization || '-'}</strong>
                    {doctor.clinic_name && (
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>🏥 {doctor.clinic_name}</span>
                    )}
                  </div>
                </td>
                <td>{getStatusBadge(doctor.status)}</td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {getSubscriptionStatus(doctor)}
                    <span className={styles.planBadge}>
                      {plans.find(p => p.id === doctor.pricing_plan_id)?.name || (doctor.plan_type === 'commission' ? 'Comisión' : 'Mensualidad')}
                      {doctor.plan_type === 'commission' && ` (${doctor.commission_rate}%)`}
                    </span>
                    <button 
                      className={styles.planBtn}
                      onClick={() => {
                        setSelectedDoctor(doctor);
                        setPlanType(doctor.plan_type || 'monthly');
                        setCommissionRate(doctor.commission_rate || 3);
                        
                        // Si el profesional no tiene plan ID, pre-seleccionamos el plan correspondiente según su plan_type
                        let initialPlanId = doctor.pricing_plan_id || '';
                        if (!initialPlanId && plans.length > 0) {
                          const matchedPlan = plans.find(p => p.key === (doctor.plan_type || 'monthly'));
                          if (matchedPlan) {
                            initialPlanId = matchedPlan.id;
                          }
                        }
                        setSelectedPlanId(initialPlanId);
                        setActionModal('change-plan');
                      }}
                    >
                      Cambiar Plan
                    </button>
                  </div>
                </td>
                <td className={styles.expiry}>
                  {(() => {
                    const expiryDateStr = doctor.subscription_expires_at || doctor.trial_ends_at;
                    if (!expiryDateStr) return '-';
                    const expiryDate = new Date(expiryDateStr);
                    const isExpired = expiryDate < new Date();
                    const isTrial = doctor.subscription_status === 'trial' || (!doctor.subscription_expires_at && doctor.trial_ends_at);

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ color: isExpired ? '#dc2626' : '#0f172a', fontWeight: isExpired ? 700 : 400 }}>
                          {expiryDate.toLocaleDateString('es-ES')}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: isExpired ? '#ef4444' : '#64748b', fontWeight: isExpired ? 600 : 400 }}>
                          {isExpired ? '⚠️ (Vencido)' : isTrial ? '(Trial)' : '(Suscripción)'}
                        </span>
                      </div>
                    );
                  })()}
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
                    <button
                      className={styles.detailsBtn}
                      onClick={() => {
                        setSelectedDoctor(doctor);
                        setEditData({
                          name: doctor.name || '',
                          email: doctor.email || '',
                          phone: doctor.phone || '',
                          license_number: doctor.license_number || '',
                          rubro: doctor.rubro || '',
                          specialization: doctor.specialization || '',
                          clinic_name: doctor.clinic_name || '',
                          clinic_address: doctor.clinic_address || doctor.address || ''
                        });
                        setEditMode(false);
                        setActionModal('view-details');
                      }}
                      title="Ver ficha completa y datos de contacto"
                    >
                      📋 Ficha
                    </button>
                    <button
                      className={styles.historyBtn}
                      onClick={() => navigate(`/admin/activity?doctorId=${doctor.id}`)}
                      title="Ver transacciones y actividad de este profesional"
                    >
                      📈 Historial
                    </button>
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
          <div className={styles.modalContent} style={actionModal === 'view-details' ? { maxWidth: '650px' } : {}}>
            {actionModal === 'view-details' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <h2 style={{ margin: 0 }}>Ficha del Profesional</h2>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>ID: {selectedDoctor.id}</span>
                  </div>
                  {getStatusBadge(selectedDoctor.status)}
                </div>

                {!editMode ? (
                  <div className={styles.detailGrid}>
                    <div className={styles.detailItem}>
                      <label>Nombre Completo</label>
                      <span>{selectedDoctor.name}</span>
                    </div>

                    <div className={styles.detailItem}>
                      <label>Matrícula / Registro</label>
                      <span>{selectedDoctor.license_number || 'No especificada'}</span>
                    </div>

                    <div className={styles.detailItem}>
                      <label>Correo Electrónico</label>
                      <a href={`mailto:${selectedDoctor.email}`} className={styles.emailBtn}>✉️ {selectedDoctor.email}</a>
                    </div>

                    <div className={styles.detailItem}>
                      <label>WhatsApp / Teléfono</label>
                      {selectedDoctor.phone ? (
                        <a href={`https://wa.me/${selectedDoctor.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className={styles.whatsappBtn}>
                          💬 {selectedDoctor.phone} (Abrir Chat)
                        </a>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Sin número registrado</span>
                      )}
                    </div>

                    <div className={styles.detailItem}>
                      <label>Rubro / Categoría</label>
                      <span>{selectedDoctor.rubro || 'No especificado'}</span>
                    </div>

                    <div className={styles.detailItem}>
                      <label>Especialidad</label>
                      <span>{selectedDoctor.specialization || 'No especificada'}</span>
                    </div>

                    <div className={styles.detailItem}>
                      <label>Establecimiento / Clínica</label>
                      <span>{selectedDoctor.clinic_name || 'No especificado'}</span>
                    </div>

                    <div className={styles.detailItem}>
                      <label>Dirección de Atención</label>
                      <span>{selectedDoctor.clinic_address || selectedDoctor.address || 'No especificada'}</span>
                    </div>

                    <div className={styles.detailItem}>
                      <label>Plan Actual & Tipo</label>
                      <span>{plans.find(p => p.id === selectedDoctor.pricing_plan_id)?.name || (selectedDoctor.plan_type === 'commission' ? `Comisión (${selectedDoctor.commission_rate}%)` : 'Mensualidad')}</span>
                    </div>

                    <div className={styles.detailItem}>
                      <label>Deuda Acumulada</label>
                      <span style={{ color: selectedDoctor.accumulated_debt > 0 ? '#ef4444' : '#10b981', fontWeight: 800 }}>
                        ${parseFloat(selectedDoctor.accumulated_debt || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className={styles.detailItem}>
                      <label>Fecha de Registro</label>
                      <span>{new Date(selectedDoctor.created_at).toLocaleDateString('es-ES')}</span>
                    </div>

                    <div className={styles.detailItem}>
                      <label>Vigencia Suscripción</label>
                      <span>{selectedDoctor.subscription_expires_at ? new Date(selectedDoctor.subscription_expires_at).toLocaleDateString('es-ES') : 'Sin fecha'}</span>
                    </div>
                  </div>
                ) : (
                  <div className={styles.detailGrid}>
                    <div className={styles.detailItem}>
                      <label>Nombre Completo (*)</label>
                      <input
                        type="text"
                        value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div className={styles.detailItem}>
                      <label>WhatsApp / Teléfono (*)</label>
                      <input
                        type="text"
                        value={editData.phone}
                        placeholder="+5491123456789"
                        onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                        style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div className={styles.detailItem}>
                      <label>Correo Electrónico</label>
                      <input
                        type="email"
                        value={editData.email}
                        onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                        style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div className={styles.detailItem}>
                      <label>Matrícula / Registro</label>
                      <input
                        type="text"
                        value={editData.license_number}
                        onChange={(e) => setEditData({ ...editData, license_number: e.target.value })}
                        style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div className={styles.detailItem}>
                      <label>Rubro / Categoría</label>
                      <input
                        type="text"
                        value={editData.rubro}
                        onChange={(e) => setEditData({ ...editData, rubro: e.target.value })}
                        style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div className={styles.detailItem}>
                      <label>Especialidad</label>
                      <input
                        type="text"
                        value={editData.specialization}
                        onChange={(e) => setEditData({ ...editData, specialization: e.target.value })}
                        style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div className={styles.detailItem}>
                      <label>Establecimiento / Clínica</label>
                      <input
                        type="text"
                        value={editData.clinic_name}
                        onChange={(e) => setEditData({ ...editData, clinic_name: e.target.value })}
                        style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div className={styles.detailItem}>
                      <label>Dirección de Atención</label>
                      <input
                        type="text"
                        value={editData.clinic_address}
                        onChange={(e) => setEditData({ ...editData, clinic_address: e.target.value })}
                        style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  </div>
                )}

                <div className={styles.modalButtons} style={{ marginTop: '1.5rem' }}>
                  {!editMode ? (
                    <>
                      <button
                        className={styles.cancelBtn}
                        onClick={() => {
                          setActionModal(null);
                          setSelectedDoctor(null);
                        }}
                      >
                        Cerrar
                      </button>
                      <button
                        className={styles.detailsBtn}
                        onClick={() => setEditMode(true)}
                        style={{ background: '#2563eb', color: 'white', border: 'none' }}
                      >
                        ✏️ Editar Datos / Teléfono
                      </button>
                      {selectedDoctor.phone && (
                        <a
                          href={`https://wa.me/${selectedDoctor.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola ${selectedDoctor.name}, te escribimos desde el equipo de soporte de TurnoHub...`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.whatsappBtn}
                          style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
                        >
                          💬 WhatsApp Soporte
                        </a>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        className={styles.cancelBtn}
                        onClick={() => setEditMode(false)}
                        disabled={actionLoading}
                      >
                        Cancelar Edición
                      </button>
                      <button
                        className={styles.confirmBtn}
                        disabled={actionLoading}
                        onClick={async () => {
                          setActionLoading(true);
                          try {
                            const res = await axios.patch(
                              `${API_BASE_URL}/api/admin/doctors/${selectedDoctor.id}`,
                              editData,
                              { headers: { Authorization: `Bearer ${token}` } }
                            );
                            if (res.data.success) {
                              await fetchDoctors();
                              setSelectedDoctor(res.data.doctor);
                              setEditMode(false);
                            }
                          } catch (err) {
                            alert(err.response?.data?.error || 'Error al guardar cambios');
                          } finally {
                            setActionLoading(false);
                          }
                        }}
                      >
                        {actionLoading ? 'Guardando...' : '💾 Guardar Cambios'}
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
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
                `¿Aprobar a ${selectedDoctor.name}? Obtendrá 30 días de trial.`}
              {actionModal === 'reject' && `¿Rechazar solicitud de ${selectedDoctor.name}?`}
              {actionModal === 'suspend' && `¿Suspender la cuenta de ${selectedDoctor.name}?`}
              {actionModal === 'extend' && `Extender suscripción de ${selectedDoctor.name}`}
              {actionModal === 'reactivate' && `¿Reactivar la cuenta de ${selectedDoctor.name}?`}
              {actionModal === 'reset-debt' && `Estamos por poner en cero la deuda de $${parseFloat(selectedDoctor.accumulated_debt).toLocaleString()} de ${selectedDoctor.name}. ¿Confirmar cobro?`}
              {actionModal === 'change-plan' && `Cambiar el plan de servicios para ${selectedDoctor.name}`}
            </p>

            {actionModal === 'change-plan' && (
              <div className={styles.formGroup}>
                <label htmlFor="pricing_plan_id">Plan Comercial:</label>
                <select
                  id="pricing_plan_id"
                  value={selectedPlanId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedPlanId(val);
                    const matchedPlan = plans.find(p => p.id === val);
                    if (matchedPlan) {
                      setPlanType(matchedPlan.key === 'commission' ? 'commission' : 'monthly');
                    }
                  }}
                  className={styles.select}
                  disabled={actionLoading}
                >
                  <option value="" disabled>Seleccione un plan</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (${p.price} / {p.price_period === 'monthly' ? 'mes' : p.price_period})
                    </option>
                  ))}
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
                disabled={
                  actionLoading ||
                  (actionModal === 'change-plan' && !selectedPlanId)
                }
              >
                {actionLoading ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )}
    </div>
    </AdminLayout>
  );
}
