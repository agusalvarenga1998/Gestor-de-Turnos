import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';
import AdminLayout from '../components/AdminLayout';
import Icon from '../components/Icon';
import axios from 'axios';
import { RUBROS_ESPECIALIDADES } from '../constants/categories';
import styles from './AdminTemplateServicesPage.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export default function AdminTemplateServicesPage() {
  const { token } = useAdminAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState(null);
  const [editFormData, setEditFormData] = useState({
    rubro: '',
    specialization: '',
    name: '',
    description: '',
    price: '',
    duration_minutes: '30',
    booking_fee: '0',
    code: '',
    is_online: false
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');



  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/admin/template-services`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setServices(response.data.services);
      }
    } catch (err) {
      console.error('Error fetching template services:', err);
      setError('No se pudieron cargar los servicios base precargados.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (service) => {
    // Determinar el rubro a partir de la especialidad guardada
    let foundRubro = '';
    for (const [rub, specs] of Object.entries(RUBROS_ESPECIALIDADES)) {
      if (specs.includes(service.specialization)) {
        foundRubro = rub;
        break;
      }
    }

    setSelectedService(service);
    setEditFormData({
      rubro: foundRubro,
      specialization: service.specialization,
      name: service.name,
      description: service.description || '',
      price: service.price !== null ? String(service.price) : '',
      duration_minutes: String(service.duration_minutes || 30),
      booking_fee: service.booking_fee !== null ? String(service.booking_fee) : '0',
      code: service.code || '',
      is_online: service.is_online === true
    });
    setSuccessMsg('');
    setError('');
  };

  const handleCreateClick = () => {
    setSelectedService({ id: 'new', isNew: true });
    setEditFormData({
      rubro: '',
      specialization: '',
      name: '',
      description: '',
      price: '',
      duration_minutes: '30',
      booking_fee: '0',
      code: '',
      is_online: false
    });
    setSuccessMsg('');
    setError('');
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleRubroChange = (e) => {
    const val = e.target.value;
    setEditFormData(prev => ({
      ...prev,
      rubro: val,
      specialization: ''
    }));
  };

  const handleDeleteClick = async (serviceId, serviceName) => {
    if (!window.confirm(`¿Estás seguro de eliminar el servicio base "${serviceName}"?`)) {
      return;
    }

    try {
      setError('');
      setSuccessMsg('');
      const response = await axios.delete(`${API_BASE_URL}/api/admin/template-services/${serviceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setSuccessMsg('✓ Servicio base eliminado correctamente');
        fetchServices();
      }
    } catch (err) {
      console.error('Error deleting template service:', err);
      setError(err.response?.data?.error || 'Error al eliminar el servicio base.');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!editFormData.specialization || !editFormData.name || !editFormData.duration_minutes) {
      setError('Por favor completa todos los campos requeridos (Especialidad, Nombre y Duración).');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccessMsg('');

      const url = selectedService.isNew 
        ? `${API_BASE_URL}/api/admin/template-services`
        : `${API_BASE_URL}/api/admin/template-services/${selectedService.id}`;

      const method = selectedService.isNew ? 'post' : 'put';

      const { rubro, ...payload } = editFormData;
      const response = await axios[method](url, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setSuccessMsg(`✓ Servicio base ${selectedService.isNew ? 'creado' : 'actualizado'} correctamente`);
        setSelectedService(null);
        fetchServices();
      }
    } catch (err) {
      console.error('Error saving template service:', err);
      setError(err.response?.data?.error || 'Ocurrió un error al guardar el servicio base.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1>Servicios Base Precargados</h1>
            <p>Define las plantillas de servicios por especialidad. Al registrarse o actualizar su especialidad, el profesional recibirá de forma automática estos servicios precargados.</p>
          </div>
          <button className={styles.createBtn} onClick={handleCreateClick}>
            <Icon name="plus" size={18} color="white" />
            Nuevo Servicio Base
          </button>
        </div>

        {error && <div className={styles.errorMessage}>{error}</div>}
        {successMsg && <div className={styles.successMessage}>{successMsg}</div>}

        {selectedService ? (
          <div className={styles.formContainer}>
            <div className={styles.cardHeader}>
              <h2>{selectedService.isNew ? 'Crear Nuevo Servicio Base' : 'Editar Servicio Base'}</h2>
              <button className={styles.cancelBtn} onClick={() => setSelectedService(null)}>
                Volver
              </button>
            </div>

            <form onSubmit={handleSave} className={styles.form}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="rubro">Rubro (Categoría Principal) *</label>
                  <select
                    id="rubro"
                    name="rubro"
                    value={editFormData.rubro}
                    onChange={handleRubroChange}
                    required
                  >
                    <option value="">Selecciona un rubro...</option>
                    {Object.keys(RUBROS_ESPECIALIDADES).map(rub => (
                      <option key={rub} value={rub}>{rub}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="specialization">Especialidad *</label>
                  <input
                    type="text"
                    id="specialization"
                    name="specialization"
                    list="specialization-list"
                    value={editFormData.specialization}
                    onChange={handleFormChange}
                    placeholder={editFormData.rubro ? "Selecciona o escribe una especialidad" : "Primero selecciona un rubro..."}
                    disabled={!editFormData.rubro}
                    required
                  />
                  <datalist id="specialization-list">
                    {editFormData.rubro && RUBROS_ESPECIALIDADES[editFormData.rubro]?.map((spec, i) => (
                      <option key={i} value={spec} />
                    ))}
                  </datalist>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="name">Nombre del Servicio *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={editFormData.name}
                    onChange={handleFormChange}
                    placeholder="Ej: Consulta Médica, Consulta Online, etc."
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="duration_minutes">Duración (minutos) *</label>
                  <input
                    type="number"
                    id="duration_minutes"
                    name="duration_minutes"
                    value={editFormData.duration_minutes}
                    onChange={handleFormChange}
                    placeholder="Ej: 15, 30, 60"
                    min="1"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="price">Precio Base (ARS)</label>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    value={editFormData.price}
                    onChange={handleFormChange}
                    placeholder="Ej: 30000"
                    min="0"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="booking_fee">Comisión de Reserva (ARS)</label>
                  <input
                    type="number"
                    id="booking_fee"
                    name="booking_fee"
                    value={editFormData.booking_fee}
                    onChange={handleFormChange}
                    placeholder="Ej: 1000"
                    min="0"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="code">Código Interno</label>
                  <input
                    type="text"
                    id="code"
                    name="code"
                    value={editFormData.code}
                    onChange={handleFormChange}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div className={styles.formGroupCheckbox}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    name="is_online"
                    checked={editFormData.is_online}
                    onChange={handleFormChange}
                  />
                  <span>Modalidad Online (Telemedicina / Videollamada)</span>
                </label>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="description">Descripción</label>
                <textarea
                  id="description"
                  name="description"
                  value={editFormData.description}
                  onChange={handleFormChange}
                  placeholder="Descripción para el paciente o profesional"
                  rows="3"
                />
              </div>

              <div className={styles.formActions}>
                <button type="submit" className={styles.saveBtn} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar Plantilla'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            {loading ? (
              <p className={styles.infoText}>Cargando servicios base...</p>
            ) : services.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No hay servicios base configurados.</p>
                <p>Haz clic en "Nuevo Servicio Base" para crear tu primera plantilla por especialidad.</p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Especialidad</th>
                    <th>Nombre de Servicio</th>
                    <th>Duración</th>
                    <th>Precio</th>
                    <th>Comisión Reserva</th>
                    <th>Modalidad</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((service) => (
                    <tr key={service.id}>
                      <td className={styles.specCell}>{service.specialization}</td>
                      <td><strong>{service.name}</strong></td>
                      <td>{service.duration_minutes} min</td>
                      <td>${parseFloat(service.price).toLocaleString()}</td>
                      <td>${parseFloat(service.booking_fee).toLocaleString()}</td>
                      <td>
                        {service.is_online ? (
                          <span className={styles.onlineBadge}>🎥 Online</span>
                        ) : (
                          <span className={styles.offlineBadge}>🏢 Presencial</span>
                        )}
                      </td>
                      <td className={styles.actionsCell}>
                        <button className={styles.editBtn} onClick={() => handleEditClick(service)}>
                          Editar
                        </button>
                        <button className={styles.deleteBtn} onClick={() => handleDeleteClick(service.id, service.name)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
