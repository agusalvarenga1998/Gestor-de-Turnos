import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DoctorLayout from '../components/DoctorLayout';
import Icon from '../components/Icon';
import Loading from '../components/Loading';
import { patientAPI, insuranceAPI } from '../services/api';
import styles from './PatientsPage.module.css';

export default function PatientsPage() {
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [insurances, setInsurances] = useState([]);
  const [selectedInsurances, setSelectedInsurances] = useState([]);
  const [patientInsurances, setPatientInsurances] = useState({});
  const [plans, setPlans] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: 'M',
    address: '',
    document_number: '',
    document_type: 'DNI',
    locality: '',
    province: '',
    insurance_company_id: '',
    insurance_plan_id: '',
    insurance_policy_number: ''
  });

  useEffect(() => {
    fetchPatients();
    fetchInsurances();
  }, []);

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

  useEffect(() => {
    if (searchTerm) {
      const filtered = patients.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.phone?.includes(searchTerm)
      );
      setFilteredPatients(filtered);
    } else {
      setFilteredPatients(patients);
    }
  }, [patients, searchTerm]);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const response = await patientAPI.getPatients();

      if (response.success) {
        setPatients(response.patients);

        // Cargar obras sociales de todos los pacientes
        const insurancesMap = {};
        for (const patient of response.patients) {
          try {
            const insuranceResponse = await insuranceAPI.getPatientInsurances(patient.id);
            if (insuranceResponse.success) {
              insurancesMap[patient.id] = insuranceResponse.insurances;
            }
          } catch (err) {
            console.error(`Error cargando obras sociales del paciente ${patient.id}:`, err);
            insurancesMap[patient.id] = [];
          }
        }
        setPatientInsurances(insurancesMap);
      }

      setError(null);
    } catch (err) {
      console.error('Error cargando pacientes:', err);
      setError('Error al cargar los pacientes');
    } finally {
      setLoading(false);
    }
  };

  const loadInsurancePlans = async (insuranceId) => {
    if (!insuranceId) {
      setPlans([]);
      return;
    }
    try {
      const response = await insuranceAPI.getPlans(insuranceId);
      if (response.success) {
        setPlans(response.plans || []);
      }
    } catch (err) {
      console.error('Error cargando planes:', err);
      setPlans([]);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'insurance_company_id') {
      loadInsurancePlans(value);
      setFormData(prev => ({
        ...prev,
        insurance_company_id: value,
        insurance_plan_id: '',
        insurance_policy_number: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.phone) {
      alert('Por favor completa los campos requeridos');
      return;
    }

    try {
      let response;
      let patientId;

      if (editingId) {
        response = await patientAPI.updatePatient(editingId, formData);
        patientId = editingId;
      } else {
        response = await patientAPI.createPatient(formData);
        patientId = response.patient.id;
      }

      if (response.success) {
        // Guardar obras sociales
        const updatedInsuranceIds = formData.insurance_company_id ? [formData.insurance_company_id] : selectedInsurances;
        await insuranceAPI.setPatientInsurances(patientId, updatedInsuranceIds);
        
        const companyName = insurances.find(ins => ins.id === formData.insurance_company_id)?.name || '';
        const planName = plans.find(p => p.id === formData.insurance_plan_id)?.name || '';
        
        const enrichedPatient = {
          ...response.patient,
          insurance_company_name: companyName,
          insurance_plan_name: planName
        };

        setPatientInsurances(prev => ({
          ...prev,
          [patientId]: updatedInsuranceIds.map(id =>
            insurances.find(ins => ins.id === id)
          ).filter(Boolean)
        }));

        setPatients(prev => {
          if (editingId) {
            return prev.map(p => p.id === editingId ? enrichedPatient : p);
          } else {
            return [...prev, enrichedPatient];
          }
        });

        resetForm();
        setShowForm(false);
      }
    } catch (err) {
      console.error('Error guardando paciente:', err);
      alert(err.response?.data?.message || 'Error al guardar el paciente');
    }
  };

  const handleDelete = async (patientId) => {
    if (!window.confirm('¿Confirmas que deseas eliminar este paciente?')) {
      return;
    }

    try {
      const response = await patientAPI.deletePatient(patientId);

      if (response.success) {
        setPatients(prev => prev.filter(p => p.id !== patientId));
      }
    } catch (err) {
      console.error('Error eliminando paciente:', err);
      alert('Error al eliminar el paciente');
    }
  };

  const handleEdit = async (patient) => {
    setFormData({
      name: patient.name,
      email: patient.email || '',
      phone: patient.phone || '',
      date_of_birth: patient.date_of_birth || '',
      gender: patient.gender || 'M',
      address: patient.address || '',
      document_number: patient.document_number || '',
      document_type: patient.document_type || 'DNI',
      locality: patient.locality || '',
      province: patient.province || '',
      insurance_company_id: patient.insurance_company_id || '',
      insurance_plan_id: patient.insurance_plan_id || '',
      insurance_policy_number: patient.insurance_policy_number || ''
    });
    setEditingId(patient.id);

    if (patient.insurance_company_id) {
      loadInsurancePlans(patient.insurance_company_id);
    } else {
      setPlans([]);
    }

    // Cargar obras sociales del paciente
    try {
      const response = await insuranceAPI.getPatientInsurances(patient.id);
      if (response.success) {
        const insuranceIds = response.insurances.map(ins => ins.id);
        setSelectedInsurances(insuranceIds);
        setPatientInsurances(prev => ({
          ...prev,
          [patient.id]: response.insurances
        }));
      }
    } catch (err) {
      console.error('Error cargando obras sociales del paciente:', err);
      setSelectedInsurances([]);
    }

    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      date_of_birth: '',
      gender: 'M',
      address: '',
      document_number: '',
      document_type: 'DNI',
      locality: '',
      province: '',
      insurance_company_id: '',
      insurance_plan_id: '',
      insurance_policy_number: ''
    });
    setEditingId(null);
    setSelectedInsurances([]);
    setPlans([]);
  };

  if (loading) {
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
            <h1 className={styles.title}>Mis Clientes</h1>
            <p className={styles.subtitle}>Gestiona tu base de datos de clientes</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className={styles.addBtn}
          >
            <Icon name="plus" size={18} color="currentColor" />
            Nuevo Cliente
          </button>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        {/* Search */}
        <div className={styles.searchBox}>
          <Icon name="search" size={18} color="#64748b" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h2>{editingId ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className={styles.closeBtn}
                >
                  <Icon name="x" size={20} color="currentColor" />
                </button>
              </div>              <form onSubmit={handleSubmit} className={styles.form}>
                <h3 className={styles.formSectionTitle}>Información Personal</h3>
                
                <div className={styles.formGroup}>
                  <label>Nombre y Apellido*</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    placeholder="Apellido, Nombre"
                    required
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Tipo Doc.*</label>
                    <select
                      name="document_type"
                      value={formData.document_type || 'DNI'}
                      onChange={handleFormChange}
                      required
                    >
                      <option value="DNI">DNI</option>
                      <option value="LC">LC</option>
                      <option value="LE">LE</option>
                      <option value="CI">CI</option>
                      <option value="PASAPORTE">PASAPORTE</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>DNI / Documento*</label>
                    <input
                      type="text"
                      name="document_number"
                      value={formData.document_number}
                      onChange={handleFormChange}
                      placeholder="Ej: 12345678"
                      required
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Fecha de Nacimiento</label>
                    <input
                      type="date"
                      name="date_of_birth"
                      value={formData.date_of_birth}
                      onChange={handleFormChange}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Género</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleFormChange}
                    >
                      <option value="M">Masculino</option>
                      <option value="F">Femenino</option>
                      <option value="O">Otro</option>
                    </select>
                  </div>
                </div>

                <h3 className={styles.formSectionTitle}>Contacto</h3>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Teléfono*</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleFormChange}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleFormChange}
                      placeholder="ejemplo@email.com"
                    />
                  </div>
                </div>

                <h3 className={styles.formSectionTitle}>Domicilio</h3>
                <div className={styles.formGroup}>
                  <label>Dirección</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleFormChange}
                    placeholder="Calle 123"
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Localidad</label>
                    <input
                      type="text"
                      name="locality"
                      value={formData.locality || ''}
                      onChange={handleFormChange}
                      placeholder="Ej: Buenos Aires"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Provincia</label>
                    <input
                      type="text"
                      name="province"
                      value={formData.province || ''}
                      onChange={handleFormChange}
                      placeholder="Ej: CABA"
                    />
                  </div>
                </div>

                <h3 className={styles.formSectionTitle}>Obra Social / Cobertura</h3>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Obra Social</label>
                    <select
                      name="insurance_company_id"
                      value={formData.insurance_company_id || ''}
                      onChange={handleFormChange}
                    >
                      <option value="">Particular / Sin obra social</option>
                      {insurances.map(ins => (
                        <option key={ins.id} value={ins.id}>{ins.name}</option>
                      ))}
                    </select>
                  </div>

                  {formData.insurance_company_id && plans.length > 0 && (
                    <div className={styles.formGroup}>
                      <label>Plan</label>
                      <select
                        name="insurance_plan_id"
                        value={formData.insurance_plan_id || ''}
                        onChange={handleFormChange}
                        required
                      >
                        <option value="">Selecciona tu plan...</option>
                        {plans.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {formData.insurance_company_id && (
                  <div className={styles.formGroup}>
                    <label>N° de Afiliado</label>
                    <input
                      type="text"
                      name="insurance_policy_number"
                      value={formData.insurance_policy_number || ''}
                      onChange={handleFormChange}
                      placeholder="N° de credencial"
                    />
                  </div>
                )}

                <div className={styles.formActions}>
                  <button type="submit" className={styles.submitBtn}>
                    {editingId ? 'Guardar Cambios' : 'Crear Cliente'}
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

        {/* Patients Table / Cards */}
        {filteredPatients.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No hay clientes que coincidan con tu búsqueda</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className={styles.tableWrapper}>
              <table className={styles.patientsTable}>
                <thead>
                  <tr>
                    <th>CLIENTE</th>
                    <th>OBRA SOCIAL</th>
                    <th>CONTACTO</th>
                    <th>VISITAS</th>
                    <th>ÚLTIMA CITA</th>
                    <th>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map(patient => {
                    const initials = patient.name
                      .split(' ')
                      .map(word => word[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2);

                    return (
                      <tr key={patient.id}>
                        <td className={styles.patientCell} data-label="Cliente">
                          <div className={styles.patientInfo}>
                            <div className={styles.avatar}>{initials}</div>
                            <div>
                              <div className={styles.patientName}>{patient.name}</div>
                              <div className={styles.patientMeta}>
                                {patient.document_number ? `DNI: ${patient.document_number}` : 'Sin DNI'}
                                {patient.date_of_birth && ` • ${new Date(patient.date_of_birth).toLocaleDateString('es-ES')}`}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td data-label="Obra Social">
                          <div className={styles.insuranceList}>
                            {patient.insurance_company_name ? (
                              <span className={styles.insuranceBadge}>
                                {patient.insurance_company_name}
                                {patient.insurance_plan_name && ` • Plan: ${patient.insurance_plan_name}`}
                                {patient.insurance_policy_number && ` • Afiliado: ${patient.insurance_policy_number}`}
                              </span>
                            ) : patientInsurances[patient.id]?.length > 0 ? (
                              patientInsurances[patient.id].map(ins => (
                                <span key={ins.id} className={styles.insuranceBadge}>
                                  {ins.name}
                                </span>
                              ))
                            ) : (
                              <span className={styles.noInsurance}>Sin Obra Social</span>
                            )}
                          </div>
                        </td>
                        <td className={styles.contactCell} data-label="Contacto">
                          {patient.email && (
                            <div className={styles.contactInfo}>{patient.email}</div>
                          )}
                          {patient.phone && (
                            <div className={styles.contactInfo}>
                              <a href={`tel:${patient.phone}`}>{patient.phone}</a>
                            </div>
                          )}
                        </td>
                        <td className={styles.visitsCell} data-label="Visitas">
                          {patient.visit_count || 0} visitas
                        </td>
                        <td className={styles.lastVisitCell} data-label="Última Cita">
                          {patient.last_appointment_date
                            ? new Date(patient.last_appointment_date).toLocaleDateString('es-ES')
                            : 'Sin citas'}
                        </td>
                        <td className={styles.actionsCell} data-label="Acciones">
                          <div className={styles.actionButtons}>
                            <Link
                              to={`/patient-history/${patient.id}`}
                              className={styles.historyBtn}
                              title="Historial"
                            >
                              <Icon name="folder-open" size={16} />
                              Historial
                            </Link>
                            <button
                              onClick={() => handleEdit(patient)}
                              className={styles.actionBtn}
                              title="Editar"
                            >
                              Editar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards eliminadas para vista limpia */}
          </>
        )}

        <div className={styles.footer}>
          <p>Total: <strong>{filteredPatients.length}</strong> cliente(s)</p>
        </div>
      </div>
    </DoctorLayout>
  );
}
