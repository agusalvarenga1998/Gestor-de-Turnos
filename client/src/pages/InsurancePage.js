import React, { useState, useEffect } from 'react';
import DoctorLayout from '../components/DoctorLayout';
import Icon from '../components/Icon';
import Loading from '../components/Loading';
import { insuranceAPI, serviceAPI } from '../services/api';
import styles from './InsurancePage.module.css';

export default function InsurancePage() {
  const [insurances, setInsurances] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    additional_fee: ''
  });

  // Estado para configuración de servicios
  const [configuringInsurance, setConfiguringInsurance] = useState(null);
  const [showCoverageModal, setShowCoverageModal] = useState(false);
  const [coverages, setCoverages] = useState({}); // { serviceId: { type, value } }
  const [savingCoverage, setSavingCoverage] = useState(false);
  const [importErrors, setImportErrors] = useState(null);

  // Estado para gestión de planes
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [configuringPlansInsurance, setConfiguringPlansInsurance] = useState(null);
  const [plans, setPlans] = useState([]);
  const [planFormData, setPlanFormData] = useState({
    name: '',
    coverageType: 'fixed_amount',
    coverageValue: ''
  });
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [savingPlan, setSavingPlan] = useState(false);

  // Estado para importación de catálogo global
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCatalogIds, setSelectedCatalogIds] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [importingCatalog, setImportingCatalog] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [insuranceRes, servicesRes] = await Promise.all([
        insuranceAPI.getInsurances(),
        serviceAPI.getMyServices()
      ]);

      if (insuranceRes.success) {
        setInsurances(insuranceRes.insurances);
      }
      if (servicesRes.success) {
        setServices(servicesRes.services);
      }

      setError(null);
    } catch (err) {
      console.error('Error cargando datos:', err);
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const fetchInsurances = async () => {
    try {
      const response = await insuranceAPI.getInsurances();
      if (response.success) {
        setInsurances(response.insurances);
      }
    } catch (err) {
      console.error('Error cargando obras sociales:', err);
    }
  };

  const handleOpenCatalog = async () => {
    setShowCatalogModal(true);
    setCatalogSearch('');
    setSelectedCatalogIds([]);
    try {
      setLoadingCatalog(true);
      const response = await insuranceAPI.getTemplateCatalog();
      if (response.success) {
        setCatalog(response.catalog);
      }
    } catch (err) {
      console.error('Error loading template catalog:', err);
      alert('No se pudo cargar el catálogo de convenios base.');
    } finally {
      setLoadingCatalog(false);
    }
  };

  const handleImportSelectedCatalog = async () => {
    if (selectedCatalogIds.length === 0) {
      alert('Por favor selecciona al menos un convenio para importar');
      return;
    }

    try {
      setImportingCatalog(true);
      const response = await insuranceAPI.importFromCatalog(selectedCatalogIds);
      if (response.success) {
        alert(response.message);
        setShowCatalogModal(false);
        fetchInsurances();
      }
    } catch (err) {
      console.error('Error importing from catalog:', err);
      alert('Error al importar los convenios seleccionados.');
    } finally {
      setImportingCatalog(false);
    }
  };

  const handleToggleCatalogSelection = (id) => {
    setSelectedCatalogIds(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id) 
        : [...prev, id]
    );
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || formData.name.trim() === '') {
      alert('Por favor completa el nombre de la obra social');
      return;
    }

    try {
      let response;

      if (editingId) {
        response = await insuranceAPI.updateInsurance(editingId, {
          name: formData.name,
          additional_fee: parseFloat(formData.additional_fee) || 0
        });
      } else {
        response = await insuranceAPI.createInsurance({
          name: formData.name,
          additional_fee: parseFloat(formData.additional_fee) || 0
        });
      }

      if (response.success) {
        await fetchInsurances();
        resetForm();
        setShowForm(false);
      }
    } catch (err) {
      console.error('Error guardando obra social:', err);
      alert('Error al guardar la obra social');
    }
  };

  const handleDelete = async (insuranceId) => {
    if (!window.confirm('¿Confirmas que deseas eliminar esta obra social?')) {
      return;
    }

    try {
      const response = await insuranceAPI.deleteInsurance(insuranceId);

      if (response.success) {
        setInsurances(prev => prev.filter(i => i.id !== insuranceId));
      }
    } catch (err) {
      console.error('Error eliminando obra social:', err);
      alert('Error al eliminar la obra social');
    }
  };

  const handleEdit = (insurance) => {
    setFormData({
      name: insurance.name,
      additional_fee: insurance.additional_fee || ''
    });
    setEditingId(insurance.id);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      additional_fee: ''
    });
    setEditingId(null);
  };

  // Lógica para Cobertura por Servicio
  const handleConfigureCoverage = async (insurance) => {
    console.log('🔘 Configure Coverage for:', insurance);
    if (!insurance || !insurance.id) {
      console.error('❌ No insurance ID found');
      alert('Error: No se pudo identificar la obra social seleccionada.');
      return;
    }

    setConfiguringInsurance(insurance);
    setLoading(true);
    try {
      console.log('📡 Fetching coverages for:', insurance.id);
      const response = await insuranceAPI.getServiceCoverages(insurance.id);
      console.log('📥 Coverages Response:', response);
      
      if (response.success) {
        const coverageMap = {};
        if (response.coverages && Array.isArray(response.coverages)) {
          response.coverages.forEach(c => {
            coverageMap[c.service_id] = {
              type: c.coverage_type,
              value: c.coverage_value
            };
          });
        }
        setCoverages(coverageMap);
        setShowCoverageModal(true);
      } else {
        alert(response.message || 'Error al obtener coberturas');
      }
    } catch (err) {
      console.error('❌ Error cargando coberturas:', err);
      // Intentar extraer el mensaje de error de Axios si existe
      const msg = err.response?.data?.message || err.response?.data?.error || err.message;
      alert(`Error al cargar coberturas por servicio: ${msg}`);
    } finally {
      setLoading(false);
    }
  };


  const handleCoverageChange = (serviceId, field, value) => {
    setCoverages(prev => ({
      ...prev,
      [serviceId]: {
        ...(prev[serviceId] || { type: 'fixed_amount', value: 0 }),
        [field]: value
      }
    }));
  };

  const saveCoverage = async (serviceId) => {
    const coverage = coverages[serviceId];
    if (!coverage) return;

    setSavingCoverage(serviceId);
    try {
      const response = await insuranceAPI.setServiceCoverage(configuringInsurance.id, {
        serviceId,
        coverageType: coverage.type,
        coverageValue: parseFloat(coverage.value) || 0
      });
      
      if (response.success) {
        // Opcional: mostrar un mini feedback de "Guardado"
      }
    } catch (err) {
      console.error('Error guardando cobertura:', err);
      alert('No se pudo guardar la cobertura para este servicio');
    } finally {
      setSavingCoverage(null);
    }
  };

  // Lógica para Gestión de Planes
  const handleConfigurePlans = async (insurance) => {
    if (!insurance || !insurance.id) return;
    setConfiguringPlansInsurance(insurance);
    setLoading(true);
    try {
      const response = await insuranceAPI.getPlans(insurance.id);
      if (response.success) {
        setPlans(response.plans || []);
        resetPlanForm();
        setShowPlansModal(true);
      }
    } catch (err) {
      console.error('Error cargando planes:', err);
      alert('Error al cargar los planes de la obra social');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanFormChange = (e) => {
    const { name, value } = e.target;
    setPlanFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!planFormData.name || planFormData.name.trim() === '') {
      alert('Por favor ingresa el nombre del plan');
      return;
    }

    setSavingPlan(true);
    try {
      let response;
      const data = {
        name: planFormData.name,
        coverageType: planFormData.coverageType,
        coverageValue: parseFloat(planFormData.coverageValue) || 0
      };

      if (editingPlanId) {
        response = await insuranceAPI.updatePlan(editingPlanId, data);
      } else {
        response = await insuranceAPI.createPlan(configuringPlansInsurance.id, data);
      }

      if (response.success) {
        // Recargar planes
        const plansRes = await insuranceAPI.getPlans(configuringPlansInsurance.id);
        if (plansRes.success) setPlans(plansRes.plans || []);
        resetPlanForm();
      }
    } catch (err) {
      console.error('Error guardando plan:', err);
      alert(err.response?.data?.message || 'Error al guardar el plan');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleEditPlan = (plan) => {
    setPlanFormData({
      name: plan.name,
      coverageType: plan.coverage_type,
      coverageValue: plan.coverage_value
    });
    setEditingPlanId(plan.id);
  };

  const handleDeletePlan = async (planId) => {
    if (!window.confirm('¿Confirmas que deseas eliminar este plan?')) return;

    try {
      const response = await insuranceAPI.deletePlan(planId);
      if (response.success) {
        setPlans(prev => prev.filter(p => p.id !== planId));
        if (editingPlanId === planId) resetPlanForm();
      }
    } catch (err) {
      console.error('Error eliminando plan:', err);
      alert('Error al eliminar el plan');
    }
  };

  const resetPlanForm = () => {
    setPlanFormData({
      name: '',
      coverageType: 'fixed_amount',
      coverageValue: ''
    });
    setEditingPlanId(null);
  };

  const handleExportExcel = async () => {
    try {
      setLoading(true);
      const data = await insuranceAPI.exportInsurances();
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'beneficios.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error exportando Excel:', err);
      alert('Error al exportar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formDataImport = new FormData();
    formDataImport.append('file', file);

    try {
      setLoading(true);
      const response = await insuranceAPI.importInsurances(formDataImport);
      if (response.success) {
        alert(response.message);
        setImportErrors(response.errors || null);
        fetchInitialData();
      }
    } catch (err) {
      console.error('Error importando Excel:', err);
      alert('Error al importar el archivo: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  if (loading && !showCoverageModal) {
    return (
      <DoctorLayout>
        <Loading />
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Convenios y Beneficios</h1>
            <p className={styles.subtitle}>Gestiona tus convenios y montos de descuento</p>
          </div>
          <div className={styles.headerActions}>
            <button
              onClick={handleExportExcel}
              className={styles.exportBtn}
              title="Descargar plantilla con servicios"
            >
              <Icon name="download" size={18} color="currentColor" />
              Exportar
            </button>
            <label className={styles.importBtn}>
              <Icon name="upload" size={18} color="currentColor" />
              Importar
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                onChange={handleImportExcel} 
                style={{ display: 'none' }} 
              />
            </label>
            <button
              onClick={handleOpenCatalog}
              style={{
                background: 'white',
                color: 'var(--primary)',
                border: '1px solid var(--primary)',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                fontWeight: '600',
                fontSize: '0.95rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
              }}
              title="Cargar convenios desde el catálogo global de TurnoHub"
            >
              <Icon name="globe" size={18} color="currentColor" />
              Catálogo TurnoHub
            </button>
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className={styles.addBtn}
            >
              <Icon name="plus" size={18} color="currentColor" />
              Nuevo Convenio
            </button>
          </div>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}
        
        {importErrors && (
          <div className={styles.importErrorBox}>
            <h3>Errores en la última importación:</h3>
            <ul>
              {importErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
            <button onClick={() => setImportErrors(null)} className={styles.clearErrorsBtn}>Cerrar</button>
          </div>
        )}

        {/* Form Modal (Crear/Editar Obra Social) */}
        {showForm && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h2>{editingId ? 'Editar Convenio' : 'Nuevo Convenio'}</h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className={styles.closeBtn}
                >
                  <Icon name="x" size={20} color="currentColor" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formGroup}>
                  <label>Convenio / Beneficio*</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    placeholder="Ej: OSDE, Cupón, Descuento Especial, etc."
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Monto a Descontar Global ($)</label>
                  <input
                    type="number"
                    name="additional_fee"
                    value={formData.additional_fee}
                    onChange={handleFormChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                  <small>Este monto se usará por defecto para todos los servicios si no configuras uno específico.</small>
                </div>

                <div className={styles.formActions}>
                  <button type="submit" className={styles.submitBtn}>
                    {editingId ? 'Guardar Cambios' : 'Crear Convenio'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className={styles.cancelBtn}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Cobertura por Servicio */}
        {showCoverageModal && configuringInsurance && (
          <div className={styles.modal}>
            <div className={`${styles.modalContent} ${styles.largeModal}`}>
              <div className={styles.modalHeader}>
                <div>
                  <h2>Configurar Coberturas: {configuringInsurance.name}</h2>
                  <p className={styles.modalSubtitle}>Define cuánto cubre esta obra social para cada servicio específico.</p>
                </div>
                <button
                  onClick={() => setShowCoverageModal(false)}
                  className={styles.closeBtn}
                >
                  <Icon name="x" size={20} color="currentColor" />
                </button>
              </div>

              <div className={styles.coverageList}>
                <div className={styles.coverageHeader}>
                  <span>Servicio</span>
                  <span>Tipo de Cobertura</span>
                  <span>Valor</span>
                  <span>Acción</span>
                </div>
                {services.length === 0 ? (
                  <p className={styles.emptyServices}>No tienes servicios creados para configurar.</p>
                ) : (
                  services.map(service => {
                    const coverage = coverages[service.id] || { type: 'fixed_amount', value: 0 };
                    const isSaving = savingCoverage === service.id;

                    return (
                      <div key={service.id} className={styles.coverageItem}>
                        <div className={styles.serviceInfo}>
                          <strong>{service.name}</strong>
                          <span>Precio base: ${parseFloat(service.price).toFixed(2)}</span>
                        </div>
                        <div className={styles.coverageInputs}>
                          <select 
                            value={coverage.type}
                            onChange={(e) => handleCoverageChange(service.id, 'type', e.target.value)}
                            className={styles.selectInput}
                          >
                            <option value="fixed_amount">Monto Fijo ($)</option>
                            <option value="percentage">Porcentaje (%)</option>
                          </select>
                          <input 
                            type="number"
                            value={coverage.value}
                            onChange={(e) => handleCoverageChange(service.id, 'value', e.target.value)}
                            className={styles.valueInput}
                            placeholder="0.00"
                            step="0.01"
                          />
                        </div>
                        <div className={styles.coverageAction}>
                          <button 
                            onClick={() => saveCoverage(service.id)}
                            disabled={isSaving}
                            className={styles.saveCoverageBtn}
                          >
                            {isSaving ? '...' : 'Guardar'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              
              <div className={styles.modalFooter}>
                <button 
                  onClick={() => setShowCoverageModal(false)}
                  className={styles.doneBtn}
                >
                  Finalizar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Gestión de Planes */}
        {showPlansModal && configuringPlansInsurance && (
          <div className={styles.modal}>
            <div className={`${styles.modalContent} ${styles.largeModal}`}>
              <div className={styles.modalHeader}>
                <div>
                  <h2>Gestionar Planes: {configuringPlansInsurance.name}</h2>
                  <p className={styles.modalSubtitle}>Crea o edita los diferentes planes de esta obra social.</p>
                </div>
                <button
                  onClick={() => setShowPlansModal(false)}
                  className={styles.closeBtn}
                >
                  <Icon name="x" size={20} color="currentColor" />
                </button>
              </div>

              {/* Formulario para Crear / Editar Plan */}
              <form onSubmit={handleSavePlan} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', background: '#f8fafc', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Nombre del Plan*</label>
                  <input
                    type="text"
                    name="name"
                    value={planFormData.name}
                    onChange={handlePlanFormChange}
                    placeholder="Ej: OSDE 210, Galeno Oro"
                    required
                    style={{ padding: '8px 12px', border: '1px solid var(--ticket-border)', borderRadius: '6px' }}
                  />
                </div>
                
                <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Tipo Cobertura</label>
                  <select
                    name="coverageType"
                    value={planFormData.coverageType}
                    onChange={handlePlanFormChange}
                    style={{ padding: '8px 12px', border: '1px solid var(--ticket-border)', borderRadius: '6px', height: '38px' }}
                  >
                    <option value="fixed_amount">Monto Fijo ($)</option>
                    <option value="percentage">Porcentaje (%)</option>
                  </select>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Valor*</label>
                  <input
                    type="number"
                    name="coverageValue"
                    value={planFormData.coverageValue}
                    onChange={handlePlanFormChange}
                    placeholder="0"
                    step="0.01"
                    min="0"
                    required
                    style={{ padding: '8px 12px', border: '1px solid var(--ticket-border)', borderRadius: '6px' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingPlan}
                  className={styles.saveCoverageBtn}
                  style={{ height: '38px', padding: '0 15px' }}
                >
                  {savingPlan ? '...' : (editingPlanId ? 'Guardar' : 'Agregar')}
                </button>

                {editingPlanId && (
                  <button
                    type="button"
                    onClick={resetPlanForm}
                    className={styles.cancelBtn}
                    style={{ height: '38px', padding: '0 10px', background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
                  >
                    Cancelar
                  </button>
                )}
              </form>

              {/* Lista de Planes Existentes */}
              <div className={styles.coverageList}>
                <div className={styles.coverageHeader} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '10px 15px', fontWeight: 'bold', borderBottom: '2px solid var(--ticket-border)' }}>
                  <span>Nombre del Plan</span>
                  <span>Tipo Cobertura</span>
                  <span>Valor Cobertura</span>
                  <span>Acciones</span>
                </div>
                
                {plans.length === 0 ? (
                  <p className={styles.emptyServices} style={{ padding: '20px 15px' }}>Esta obra social aún no tiene planes configurados.</p>
                ) : (
                  plans.map(plan => (
                    <div key={plan.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '12px 15px', alignItems: 'center', borderBottom: '1px solid var(--ticket-border)' }}>
                      <strong style={{ color: 'var(--text-main)' }}>{plan.name}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        {plan.coverage_type === 'percentage' ? 'Porcentaje (%)' : 'Monto Fijo ($)'}
                      </span>
                      <strong style={{ color: 'var(--primary)' }}>
                        {plan.coverage_type === 'percentage' ? `${parseFloat(plan.coverage_value)}%` : `$${parseFloat(plan.coverage_value).toFixed(2)}`}
                      </strong>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleEditPlan(plan)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                          title="Editar"
                        >
                          <Icon name="edit" size={16} color="currentColor" />
                        </button>
                        <button
                          onClick={() => handleDeletePlan(plan.id)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}
                          title="Eliminar"
                        >
                          <Icon name="trash" size={16} color="currentColor" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className={styles.modalFooter}>
                <button 
                  onClick={() => setShowPlansModal(false)}
                  className={styles.doneBtn}
                >
                  Finalizar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Insurance Table */}
        {insurances.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No tienes obras sociales registradas</p>
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className={styles.emptyStateBtn}
            >
              Crear la primera
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className={styles.desktopTableView}>
              <div className={styles.tableContainer}>
                <table className={styles.insuranceTable}>
                  <thead>
                    <tr>
                      <th>Convenio</th>
                      <th>Monto Global</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insurances.map((insurance) => (
                      <tr key={insurance.id}>
                        <td className={styles.name}>{insurance.name}</td>
                        <td className={styles.fee}>
                          ${parseFloat(insurance.additional_fee || 0).toFixed(2)}
                        </td>
                        <td className={styles.actions}>
                          <button
                            onClick={() => handleConfigurePlans(insurance)}
                            className={styles.configBtn}
                            title="Gestionar Planes de Cobertura"
                            style={{ marginRight: '6px' }}
                          >
                            <Icon name="list" size={18} color="currentColor" />
                            Planes
                          </button>
                          <button
                            onClick={() => handleConfigureCoverage(insurance)}
                            className={styles.configBtn}
                            title="Configurar por Servicio"
                          >
                            <Icon name="settings" size={18} color="currentColor" />
                            Servicios
                          </button>
                          <button
                            onClick={() => handleEdit(insurance)}
                            className={styles.iconBtn}
                            title="Editar nombre/global"
                          >
                            <Icon name="edit" size={18} color="currentColor" />
                          </button>
                          <button
                            onClick={() => handleDelete(insurance.id)}
                            className={styles.iconBtn}
                            title="Eliminar"
                          >
                            <Icon name="trash" size={18} color="currentColor" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards View */}
            <div className={styles.mobileCardsView}>
              {insurances.map((insurance) => (
                <div key={insurance.id} className={styles.insuranceCardMobile}>
                  <div className={styles.insuranceCardHeaderMobile}>
                    <h3 className={styles.insuranceNameMobile}>{insurance.name}</h3>
                    <div className={styles.insuranceFeeMobile}>
                      <span>Monto Global:</span>
                      <strong>${parseFloat(insurance.additional_fee || 0).toFixed(2)}</strong>
                    </div>
                  </div>
                  <div className={styles.insuranceCardActionsMobile}>
                    <button
                      onClick={() => handleConfigurePlans(insurance)}
                      className={styles.mobileActionBtn}
                    >
                      <Icon name="list" size={16} color="currentColor" />
                      <span>Planes</span>
                    </button>
                    <button
                      onClick={() => handleConfigureCoverage(insurance)}
                      className={styles.mobileActionBtn}
                    >
                      <Icon name="settings" size={16} color="currentColor" />
                      <span>Servicios</span>
                    </button>
                    <button
                      onClick={() => handleEdit(insurance)}
                      className={styles.mobileEditBtn}
                      aria-label="Editar"
                    >
                      <Icon name="edit" size={16} color="currentColor" />
                    </button>
                    <button
                      onClick={() => handleDelete(insurance.id)}
                      className={styles.mobileDeleteBtn}
                      aria-label="Eliminar"
                    >
                      <Icon name="trash" size={16} color="currentColor" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Modal de Catálogo Global */}
        {showCatalogModal && (
          <div className={styles.modal}>
            <div className={`${styles.modalContent} ${styles.largeModal}`}>
              <div className={styles.modalHeader}>
                <div>
                  <h2>Catálogo de Convenios</h2>
                  <p className={styles.modalSubtitle}>Selecciona las obras sociales y prepagas que deseas importar a tu lista.</p>
                </div>
                <button
                  onClick={() => setShowCatalogModal(false)}
                  className={styles.closeBtn}
                >
                  <Icon name="x" size={20} color="currentColor" />
                </button>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <input
                  type="text"
                  placeholder="Buscar obra social o prepaga..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 15px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    backgroundColor: '#ffffff',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>

              {loadingCatalog ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Cargando catálogo...</div>
              ) : (() => {
                const filteredCatalog = catalog.filter(item => 
                  item.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                  (item.acronym && item.acronym.toLowerCase().includes(catalogSearch.toLowerCase()))
                );

                if (filteredCatalog.length === 0) {
                  return (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                      No hay convenios disponibles para importar en este momento.
                    </div>
                  );
                }

                return (
                  <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                    <table className={styles.insuranceTable} style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ width: '40px', padding: '10px' }}></th>
                          <th style={{ padding: '10px' }}>Convenio</th>
                          <th style={{ padding: '10px' }}>Planes por Defecto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCatalog.map((item) => (
                          <tr 
                            key={item.id} 
                            onClick={() => handleToggleCatalogSelection(item.id)} 
                            style={{ cursor: 'pointer' }}
                          >
                            <td onClick={(e) => e.stopPropagation()} style={{ padding: '10px', verticalAlign: 'middle' }}>
                              <input
                                type="checkbox"
                                checked={selectedCatalogIds.includes(item.id)}
                                onChange={() => handleToggleCatalogSelection(item.id)}
                                style={{ width: '18px', height: '18px', cursor: 'pointer', margin: 0 }}
                              />
                            </td>
                            <td style={{ fontWeight: '700', padding: '10px', verticalAlign: 'middle' }}>
                              {item.name} {item.acronym ? <span style={{ color: '#6b7280', fontWeight: 'normal', fontSize: '0.85rem' }}>({item.acronym})</span> : ''}
                            </td>
                            <td style={{ padding: '10px', verticalAlign: 'middle' }}>
                              {item.plans && item.plans.length > 0 ? (
                                item.plans.map(p => (
                                  <span 
                                    key={p.id} 
                                    style={{
                                      background: '#f3f4f6',
                                      color: '#374151',
                                      padding: '3px 8px',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      marginRight: '5px',
                                      fontWeight: '600',
                                      display: 'inline-block',
                                      border: '1px solid #e5e7eb',
                                      marginBottom: '2px'
                                    }}
                                  >
                                    {p.name}
                                  </span>
                                ))
                              ) : (
                                <span style={{ color: '#9ca3af', fontSize: '13px' }}>Sin planes</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              <div className={styles.modalFooter} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', borderTop: '1px solid #e5e7eb', paddingTop: '15px' }}>
                <span style={{ fontSize: '14px', color: '#374151', fontWeight: '600' }}>
                  {selectedCatalogIds.length} seleccionado(s)
                </span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setShowCatalogModal(false)}
                    className={styles.cancelBtn}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleImportSelectedCatalog}
                    disabled={importingCatalog || selectedCatalogIds.length === 0}
                    className={styles.doneBtn}
                    style={{
                      background: selectedCatalogIds.length === 0 ? '#93c5fd' : '#2563eb',
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '8px',
                      cursor: selectedCatalogIds.length === 0 ? 'not-allowed' : 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    {importingCatalog ? 'Importando...' : 'Importar Seleccionados'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={styles.footer}>
          <p>Total: <strong>{insurances.length}</strong> convenio(s)</p>
        </div>
      </div>
    </DoctorLayout>
  );
}
