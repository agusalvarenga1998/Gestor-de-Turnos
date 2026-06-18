import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';
import AdminLayout from '../components/AdminLayout';
import Icon from '../components/Icon';
import axios from 'axios';
import styles from './AdminPlansPage.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export default function AdminPlansPage() {
  const { token } = useAdminAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [editFormData, setEditFormData] = useState({
    key: '',
    name: '',
    description: '',
    price: '',
    price_period: '',
    features: [],
    is_popular: false,
    is_enabled: true,
    allow_google_calendar: true,
    allow_mercadopago: true,
    allow_telemedicine: true,
    allow_reminders: true,
    allow_insurance: true,
    allow_patient_booking: true,
    max_patients: '',
    max_appointments_monthly: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/admin/plans`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setPlans(response.data.plans);
      }
    } catch (err) {
      console.error('Error fetching plans:', err);
      setError('No se pudieron cargar los planes de precios.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (plan) => {
    setSelectedPlan(plan);
    setEditFormData({
      key: plan.key,
      name: plan.name,
      description: plan.description || '',
      price: plan.price,
      price_period: plan.price_period || '',
      features: [...(plan.features || [])],
      is_popular: plan.is_popular || false,
      is_enabled: plan.is_enabled !== false,
      allow_google_calendar: plan.allow_google_calendar !== false,
      allow_mercadopago: plan.allow_mercadopago !== false,
      allow_telemedicine: plan.allow_telemedicine !== false,
      allow_reminders: plan.allow_reminders !== false,
      allow_insurance: plan.allow_insurance !== false,
      allow_patient_booking: plan.allow_patient_booking !== false,
      max_patients: plan.max_patients !== null && plan.max_patients !== undefined ? plan.max_patients : '',
      max_appointments_monthly: plan.max_appointments_monthly !== null && plan.max_appointments_monthly !== undefined ? plan.max_appointments_monthly : ''
    });
    setSuccessMsg('');
    setError('');
  };

  const handleCreateClick = () => {
    setSelectedPlan({ id: 'new', isNew: true });
    setEditFormData({
      key: '',
      name: '',
      description: '',
      price: '',
      price_period: '',
      features: [],
      is_popular: false,
      is_enabled: true,
      allow_google_calendar: true,
      allow_mercadopago: true,
      allow_telemedicine: true,
      allow_reminders: true,
      allow_insurance: true,
      allow_patient_booking: true,
      max_patients: '',
      max_appointments_monthly: ''
    });
    setSuccessMsg('');
    setError('');
  };

  const handleDeleteClick = async (plan) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente el plan "${plan.name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccessMsg('');
      const response = await axios.delete(`${API_BASE_URL}/api/admin/plans/${plan.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setSuccessMsg(response.data.message);
        setSelectedPlan(null);
        fetchPlans();
      }
    } catch (err) {
      console.error('Error deleting plan:', err);
      setError(err.response?.data?.error || 'Error al eliminar el plan.');
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFeatureChange = (index, value) => {
    setEditFormData(prev => {
      const updated = [...prev.features];
      updated[index] = value;
      return { ...prev, features: updated };
    });
  };

  const addFeatureRow = () => {
    setEditFormData(prev => ({
      ...prev,
      features: [...prev.features, '']
    }));
  };

  const removeFeatureRow = (index) => {
    setEditFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editFormData.name || !editFormData.price) {
      setError('El nombre del plan y el precio son obligatorios.');
      return;
    }

    if (selectedPlan.isNew && !editFormData.key) {
      setError('La clave (Key) del plan es obligatoria para planes nuevos.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccessMsg('');
      
      const cleanFeatures = editFormData.features.filter(f => f.trim() !== '');

      let response;
      const payload = {
        ...editFormData,
        features: cleanFeatures,
        max_patients: editFormData.max_patients === '' ? null : parseInt(editFormData.max_patients),
        max_appointments_monthly: editFormData.max_appointments_monthly === '' ? null : parseInt(editFormData.max_appointments_monthly)
      };

      if (selectedPlan.isNew) {
        // CREAR PLAN NUEVO
        response = await axios.post(
          `${API_BASE_URL}/api/admin/plans`,
          payload,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
      } else {
        // ACTUALIZAR PLAN EXISTENTE
        response = await axios.put(
          `${API_BASE_URL}/api/admin/plans/${selectedPlan.id}`,
          payload,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
      }

      if (response.data.success) {
        setSuccessMsg(selectedPlan.isNew ? 'Plan comercial creado correctamente.' : 'Plan comercial actualizado correctamente.');
        setSelectedPlan(null);
        fetchPlans(); // Recargar listado
      }
    } catch (err) {
      console.error('Error saving plan:', err);
      setError(err.response?.data?.error || 'Error al guardar los cambios del plan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1>Configuración de Planes Comerciales</h1>
            <p>Administra los planes de precios y beneficios que se muestran públicamente en la Landing Page comercial.</p>
          </div>
          <button 
            className={styles.createBtn}
            onClick={handleCreateClick}
          >
            + Crear Nuevo Plan
          </button>
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#ef4444', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontWeight: 600 }}>{error}</div>}
        {successMsg && <div style={{ background: '#dcfce7', color: '#10b981', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontWeight: 600 }}>{successMsg}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', fontSize: '1.1rem', color: '#666' }}>Cargando planes comerciales...</div>
        ) : (
          <div className={`${styles.layout} ${selectedPlan ? styles.hasSelection : ''}`}>
            {/* Grid de Planes */}
            <div className={styles.plansGrid}>
              {plans.map((plan) => (
                <div 
                  key={plan.id} 
                  className={`${styles.planCard} ${plan.is_popular ? styles.popular : ''} ${!plan.is_enabled ? styles.disabled : ''}`}
                >
                  {plan.is_popular && <span className={styles.popularBadge}>MÁS ELEGIDO</span>}
                  
                  <div className={styles.cardHeader}>
                    <h3>
                      {plan.name}
                      {!plan.is_enabled && <span className={styles.disabledBadge}>DESACTIVADO</span>}
                    </h3>
                    <span className={styles.planKey}>Key: {plan.key}</span>
                  </div>

                  <p className={styles.pricingDesc}>{plan.description}</p>
                  
                  <div className={styles.pricingPrice}>
                    {plan.price} <span>/ {plan.price_period}</span>
                  </div>

                  <ul className={styles.pricingFeatures}>
                    {(plan.features || []).map((feat, index) => (
                      <li key={index}>
                        <Icon name="check" size={16} className={styles.checkIcon} />
                        {feat}
                      </li>
                    ))}
                  </ul>

                  <div className={styles.technicalLimits}>
                    <div><strong>Google Calendar:</strong> {plan.allow_google_calendar ? 'Habilitado' : 'Bloqueado'}</div>
                    <div><strong>Mercado Pago:</strong> {plan.allow_mercadopago ? 'Habilitado' : 'Bloqueado'}</div>
                    <div><strong>Telemedicina (Meet):</strong> {plan.allow_telemedicine ? 'Habilitado' : 'Bloqueado'}</div>
                    <div><strong>Remisiones Email:</strong> {plan.allow_reminders ? 'Habilitadas' : 'Bloqueadas'}</div>
                    <div><strong>Convenios OS:</strong> {plan.allow_insurance ? 'Habilitados' : 'Bloqueados'}</div>
                    <div><strong>Auto-reserva Pacientes:</strong> {plan.allow_patient_booking ? 'Habilitada' : 'Bloqueada'}</div>
                    <div><strong>Pacientes Máx:</strong> {plan.max_patients || 'Ilimitados'}</div>
                    <div><strong>Turnos/Mes Máx:</strong> {plan.max_appointments_monthly || 'Ilimitados'}</div>
                  </div>

                  <div className={styles.cardActions}>
                    <button 
                      className={styles.editBtn}
                      onClick={() => handleEditClick(plan)}
                    >
                      Editar
                    </button>
                    <button 
                      className={styles.deleteBtn}
                      onClick={() => handleDeleteClick(plan)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Formulario de Edición / Creación */}
            {selectedPlan && (
              <div className={styles.editorCard}>
                <h2>{selectedPlan.isNew ? 'Crear Nuevo Plan' : `Editar: ${selectedPlan.name}`}</h2>
                <form onSubmit={handleSave}>
                  {selectedPlan.isNew && (
                    <div className={styles.formGroup}>
                      <label>Clave Única (Key - Ej: premium)</label>
                      <input 
                        type="text" 
                        name="key" 
                        value={editFormData.key} 
                        onChange={handleInputChange} 
                        placeholder="Ej: premium"
                        required 
                      />
                    </div>
                  )}

                  <div className={styles.formGroup}>
                    <label>Nombre del Plan</label>
                    <input 
                      type="text" 
                      name="name" 
                      value={editFormData.name} 
                      onChange={handleInputChange} 
                      placeholder="Ej: Plan Premium"
                      required 
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Descripción Breve</label>
                    <textarea 
                      name="description" 
                      value={editFormData.description} 
                      onChange={handleInputChange}
                      placeholder="Ej: Para clínicas con alta demanda"
                      rows="2"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Precio (Ej: 3% o $25.000 o Consultar)</label>
                    <input 
                      type="text" 
                      name="price" 
                      value={editFormData.price} 
                      onChange={handleInputChange} 
                      placeholder="Ej: $45.000"
                      required 
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Periodo del Precio (Ej: mes fijo o turno efectivo)</label>
                    <input 
                      type="text" 
                      name="price_period" 
                      value={editFormData.price_period} 
                      placeholder="Ej: mes fijo"
                      onChange={handleInputChange} 
                    />
                  </div>

                  <div className={styles.checkboxes}>
                    <label className={styles.checkboxLabel}>
                      <input 
                        type="checkbox" 
                        name="is_popular" 
                        checked={editFormData.is_popular} 
                        onChange={handleInputChange} 
                      />
                      Destacar plan como "MÁS ELEGIDO"
                    </label>

                    <label className={styles.checkboxLabel}>
                      <input 
                        type="checkbox" 
                        name="is_enabled" 
                        checked={editFormData.is_enabled} 
                        onChange={handleInputChange} 
                      />
                      Habilitar y mostrar este plan en la Web
                    </label>

                    <label className={styles.checkboxLabel}>
                      <input 
                        type="checkbox" 
                        name="allow_google_calendar" 
                        checked={editFormData.allow_google_calendar} 
                        onChange={handleInputChange} 
                      />
                      Sincronización con Google Calendar
                    </label>

                    <label className={styles.checkboxLabel}>
                      <input 
                        type="checkbox" 
                        name="allow_mercadopago" 
                        checked={editFormData.allow_mercadopago} 
                        onChange={handleInputChange} 
                      />
                      Integración con Mercado Pago
                    </label>

                    <label className={styles.checkboxLabel}>
                      <input 
                        type="checkbox" 
                        name="allow_telemedicine" 
                        checked={editFormData.allow_telemedicine} 
                        onChange={handleInputChange} 
                      />
                      Consultas Online (Videollamadas Meet)
                    </label>

                    <label className={styles.checkboxLabel}>
                      <input 
                        type="checkbox" 
                        name="allow_reminders" 
                        checked={editFormData.allow_reminders} 
                        onChange={handleInputChange} 
                      />
                      Recordatorios Automáticos de Turnos (Email)
                    </label>

                    <label className={styles.checkboxLabel}>
                      <input 
                        type="checkbox" 
                        name="allow_insurance" 
                        checked={editFormData.allow_insurance} 
                        onChange={handleInputChange} 
                      />
                      Convenios y Obras Sociales (Módulo OS)
                    </label>

                    <label className={styles.checkboxLabel}>
                      <input 
                        type="checkbox" 
                        name="allow_patient_booking" 
                        checked={editFormData.allow_patient_booking} 
                        onChange={handleInputChange} 
                      />
                      Permitir auto-agendamiento de pacientes
                    </label>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Límite de Pacientes Activos (vacío = ilimitado)</label>
                    <input 
                      type="number" 
                      name="max_patients" 
                      value={editFormData.max_patients} 
                      onChange={handleInputChange} 
                      placeholder="Ej: 50"
                      min="0"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Límite de Turnos por Mes (vacío = ilimitado)</label>
                    <input 
                      type="number" 
                      name="max_appointments_monthly" 
                      value={editFormData.max_appointments_monthly} 
                      onChange={handleInputChange} 
                      placeholder="Ej: 200"
                      min="0"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Beneficios / Características</label>
                    <div className={styles.featuresManager}>
                      {editFormData.features.map((feat, index) => (
                        <div key={index} className={styles.featureItemInput}>
                          <input 
                            type="text" 
                            value={feat} 
                            placeholder="Ej: Todas las funcionalidades" 
                            onChange={(e) => handleFeatureChange(index, e.target.value)} 
                          />
                          <button 
                            type="button" 
                            className={styles.removeFeatureBtn}
                            onClick={() => removeFeatureRow(index)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button 
                        type="button" 
                        className={styles.addFeatureBtn}
                        onClick={addFeatureRow}
                      >
                        + Agregar Beneficio
                      </button>
                    </div>
                  </div>

                  <div className={styles.formActions}>
                    <button 
                      type="submit" 
                      className={styles.saveBtn}
                      disabled={saving}
                    >
                      {saving ? 'Guardando...' : (selectedPlan.isNew ? 'Crear Plan' : 'Guardar Cambios')}
                    </button>
                    <button 
                      type="button" 
                      className={styles.cancelBtn}
                      onClick={() => setSelectedPlan(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
