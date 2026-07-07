import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import DoctorLayout from '../components/DoctorLayout';
import Icon from '../components/Icon';
import Loading from '../components/Loading';
import styles from './ServicesPage.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002';

export default function ServicesPage() {
  const { user, token } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const handleSyncTemplates = async () => {
    try {
      setSyncing(true);
      setError(null);
      const response = await axios.post(`${API_BASE_URL}/api/services/doctor/me/sync-templates`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setServices(response.data.services);
        alert(response.data.message);
      }
    } catch (err) {
      console.error('Error syncing template services:', err);
      alert('No se pudieron sincronizar los servicios base: ' + (err.response?.data?.error || err.message));
    } finally {
      setSyncing(false);
    }
  };
  
  // Estado para el modal de edición/creación
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    booking_fee: '',
    duration_minutes: 30,
    code: '',
    is_online: false
  });

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/services/doctor/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Nota: Deberé añadir el endpoint /doctor/me en el backend para mayor comodidad
      if (response.data.success) {
        setServices(response.data.services);
      }
    } catch (err) {
      console.error('Error fetching services:', err);
      setError('No se pudieron cargar los servicios.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        is_online: user?.plan?.allow_telemedicine === false ? false : formData.is_online
      };
      if (editingService) {
        await axios.put(`${API_BASE_URL}/api/services/${editingService.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_BASE_URL}/api/services`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setIsModalOpen(false);
      setEditingService(null);
      setFormData({ name: '', description: '', price: '', booking_fee: '', duration_minutes: 30, code: '', is_online: false });
      fetchServices();
    } catch (err) {
      alert('Error al guardar el servicio: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleEdit = (service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      price: service.price,
      booking_fee: service.booking_fee || '',
      duration_minutes: service.duration_minutes,
      code: service.code || '',
      is_online: service.is_online || false
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este servicio?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/services/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchServices();
    } catch (err) {
      alert('Error al eliminar');
    }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formDataImport = new FormData();
    formDataImport.append('file', file);

    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/api/services/import`, formDataImport, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      if (response.data.success) {
        alert(response.data.message);
        if (response.data.errors) {
          console.warn('Errores de importación:', response.data.errors);
        }
        fetchServices();
      }
    } catch (err) {
      console.error('Error importing Excel:', err);
      alert('Error al importar el archivo Excel: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
      // Reset input
      e.target.value = '';
    }
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
            <h1>Mis Servicios</h1>
            <p className={styles.subtitle}>Define qué ofreces, cuánto cuesta y cuánto dura cada turno.</p>
          </div>
          <div className={styles.headerActions}>
            <label className={styles.importBtn}>
              <Icon name="upload" size={18} /> Importar Excel
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                onChange={handleImportExcel} 
                style={{ display: 'none' }} 
              />
            </label>
            <button className={styles.syncBtn} onClick={handleSyncTemplates} disabled={syncing}>
              <Icon name="refresh" size={18} /> {syncing ? 'Cargando...' : 'Cargar Plantilla'}
            </button>
            <button className={styles.addBtn} onClick={() => { setEditingService(null); setFormData({ name: '', description: '', price: '', booking_fee: '', duration_minutes: 30, code: '', is_online: false }); setIsModalOpen(true); }}>
              <Icon name="plus" size={18} /> Nuevo Servicio
            </button>
          </div>
        </div>

        {error ? (
          <div className={styles.error}>{error}</div>
        ) : (
          <div className={styles.servicesGrid}>
            {services.map(service => (
              <div key={service.id} className={styles.serviceCard}>
                <div className={styles.serviceHeader}>
                  <div className={styles.titleInfo}>
                    <h3>{service.name}</h3>
                    {service.code && <span className={styles.serviceCode}>{service.code}</span>}
                    {service.is_online && <span className={styles.onlineBadge}>🎥 Online</span>}
                  </div>
                  <div className={styles.badge}>{service.duration_minutes} min</div>
                </div>
                <p className={styles.description}>{service.description || 'Sin descripción'}</p>
                <div className={styles.priceRow}>
                  <div className={styles.price}>
                    <span>Precio:</span>
                    <strong>${parseFloat(service.price).toLocaleString()}</strong>
                  </div>
                  <div className={styles.price}>
                    <span>Seña:</span>
                    <strong>${parseFloat(service.booking_fee || 0).toLocaleString()}</strong>
                  </div>
                </div>
                <div className={styles.actions}>
                  <button onClick={() => handleEdit(service)} className={styles.editBtn}>Editar</button>
                  <button onClick={() => handleDelete(service.id)} className={styles.deleteBtn}>Eliminar</button>
                </div>
              </div>
            ))}
            {services.length === 0 && (
              <div className={styles.emptyState}>
                <p>Aún no has creado servicios. ¡Añade el primero!</p>
              </div>
            )}
          </div>
        )}

        {isModalOpen && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <h2>{editingService ? 'Editar Servicio' : 'Nuevo Servicio'}</h2>
              <form onSubmit={handleSubmit}>
                <div className={styles.row}>
                  <div className={styles.formGroup}>
                    <label>Nombre del Servicio*</label>
                    <input 
                      type="text" 
                      value={formData.name} 
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      placeholder="Ej: Corte de Cabello..."
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Código (Opcional)</label>
                    <input 
                      type="text" 
                      value={formData.code} 
                      onChange={e => setFormData({...formData, code: e.target.value})}
                      placeholder="Ej: SERV-01"
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>Descripción (Opcional)</label>
                  <textarea 
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="Detalles sobre el servicio..."
                  />
                </div>
                <div className={styles.row}>
                  <div className={styles.formGroup}>
                    <label>Precio ($)</label>
                    <input 
                      type="number" 
                      value={formData.price} 
                      onChange={e => setFormData({...formData, price: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Duración (Minutos)</label>
                    <select 
                      value={formData.duration_minutes} 
                      onChange={e => setFormData({...formData, duration_minutes: e.target.value})}
                    >
                      <option value="15">15 min</option>
                      <option value="30">30 min</option>
                      <option value="45">45 min</option>
                      <option value="60">1 hora</option>
                      <option value="90">1.5 horas</option>
                      <option value="120">2 horas</option>
                    </select>
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>Seña de Reserva ($) - Opcional</label>
                  <input 
                    type="number" 
                    value={formData.booking_fee} 
                    onChange={e => setFormData({...formData, booking_fee: e.target.value})}
                    placeholder="Monto de la seña que te queda a ti"
                  />
                  <p className={styles.helpText}>Al cliente se le sumará el 3% de comisión del sistema sobre el precio total.</p>
                </div>
                <div className={`${styles.onlineToggle} ${user?.plan?.allow_telemedicine === false ? styles.toggleDisabled : ''}`}>
                  <label className={styles.toggleLabel}>
                    <span>🎥 Servicio Online (videollamada)</span>
                    {user?.plan?.allow_telemedicine === false ? (
                      <span className={styles.upgradeBadge}>🔒 Requiere Plan Superior</span>
                    ) : (
                      <div className={styles.toggleSwitch}>
                        <input 
                          type="checkbox" 
                          checked={formData.is_online}
                          onChange={e => setFormData({...formData, is_online: e.target.checked})}
                        />
                        <span className={styles.toggleSlider}></span>
                      </div>
                    )}
                  </label>
                  {user?.plan?.allow_telemedicine === false && (
                    <p className={styles.restrictedHint}>Esta característica no está incluida en tu plan actual (<strong>{user?.plan?.name || 'Plan Básico'}</strong>). Contacta al administrador para solicitar Consultas Online.</p>
                  )}
                  {formData.is_online && user?.plan?.allow_telemedicine !== false && (
                    <p className={styles.onlineHint}>⚡ Al confirmar el turno se generará un link de Google Meet automáticamente (requiere Google Calendar conectado).</p>
                  )}
                </div>
                <div className={styles.modalActions}>
                  <button type="button" onClick={() => setIsModalOpen(false)} className={styles.cancelLink}>Cancelar</button>
                  <button type="submit" className={styles.saveBtn}>Guardar Servicio</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DoctorLayout>
  );
}
