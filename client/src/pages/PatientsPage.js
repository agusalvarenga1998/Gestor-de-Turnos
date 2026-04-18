import React, { useState, useEffect } from 'react';
import DoctorLayout from '../components/DoctorLayout';
import Icon from '../components/Icon';
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
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: 'M',
    address: '',
    document_number: ''
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

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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
        if (selectedInsurances.length > 0 || editingId) {
          await insuranceAPI.setPatientInsurances(patientId, selectedInsurances);
          setPatientInsurances(prev => ({
            ...prev,
            [patientId]: selectedInsurances.map(id =>
              insurances.find(ins => ins.id === id)
            ).filter(Boolean)
          }));
        }

        setPatients(prev => {
          if (editingId) {
            return prev.map(p => p.id === editingId ? response.patient : p);
          } else {
            return [...prev, response.patient];
          }
        });

        resetForm();
        setShowForm(false);
      }
    } catch (err) {
      console.error('Error guardando paciente:', err);
      alert('Error al guardar el paciente');
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
      document_number: patient.document_number || ''
    });
    setEditingId(patient.id);

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
      document_number: ''
    });
    setEditingId(null);
    setSelectedInsurances([]);
  };

  if (loading) {
    return (
      <DoctorLayout>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Cargando pacientes...</p>
        </div>
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Mis Pacientes</h1>
            <p className={styles.subtitle}>Gestiona tu base de datos de pacientes</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className={styles.addBtn}
          >
            <Icon name="plus" size={18} color="currentColor" />
            Nuevo Paciente
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
                <h2>{editingId ? 'Editar Paciente' : 'Nuevo Paciente'}</h2>
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
                  <label>Nombre*</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    required
                  />
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

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleFormChange}
                    />
                  </div>

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

                <div className={styles.formGroup}>
                  <label>Dirección</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleFormChange}
                  />
                </div>

                {insurances.length > 0 && (
                  <div className={styles.formGroup}>
                    <label>Obras Sociales</label>
                    <div className={styles.checkboxGroup}>
                      {insurances.map(insurance => (
                        <label key={insurance.id} className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={selectedInsurances.includes(insurance.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedInsurances(prev => [...prev, insurance.id]);
                              } else {
                                setSelectedInsurances(prev => prev.filter(id => id !== insurance.id));
                              }
                            }}
                          />
                          {insurance.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className={styles.formActions}>
                  <button type="submit" className={styles.submitBtn}>
                    {editingId ? 'Guardar Cambios' : 'Crear Paciente'}
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
            <p>No hay pacientes que coincidan con tu búsqueda</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className={styles.tableWrapper}>
              <table className={styles.patientsTable}>
                <thead>
                  <tr>
                    <th>PACIENTE</th>
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
                        <td className={styles.patientCell}>
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
                        <td className={styles.contactCell}>
                          {patient.email && (
                            <div className={styles.contactInfo}>{patient.email}</div>
                          )}
                          {patient.phone && (
                            <div className={styles.contactInfo}>
                              <a href={`tel:${patient.phone}`}>{patient.phone}</a>
                            </div>
                          )}
                        </td>
                        <td className={styles.visitsCell}>
                          {patient.visit_count || 0} visitas
                        </td>
                        <td className={styles.lastVisitCell}>
                          {patient.last_appointment_date
                            ? new Date(patient.last_appointment_date).toLocaleDateString('es-ES')
                            : 'Sin citas'}
                        </td>
                        <td className={styles.actionsCell}>
                          <button
                            onClick={() => handleEdit(patient)}
                            className={styles.actionBtn}
                            title="Editar"
                          >
                            Ver/Editar
                          </button>
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
          <p>Total: <strong>{filteredPatients.length}</strong> paciente(s)</p>
        </div>
      </div>
    </DoctorLayout>
  );
}
