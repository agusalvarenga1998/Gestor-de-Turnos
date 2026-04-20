import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import DoctorLayout from '../components/DoctorLayout';
import Icon from '../components/Icon';
import Loading from '../components/Loading';
import styles from './ServicesPage.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002';

export default function ServicesPage() {
  const { token } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Estado para el modal de edición/creación
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    booking_fee: '',
    duration_minutes: 30
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
      if (editingService) {
        await axios.put(`${API_BASE_URL}/api/services/${editingService.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_BASE_URL}/api/services`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setIsModalOpen(false);
      setEditingService(null);
      setFormData({ name: '', description: '', price: '', booking_fee: '', duration_minutes: 30 });
      fetchServices();
    } catch (err) {
      alert('Error al guardar el servicio');
    }
  };

  const handleEdit = (service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      price: service.price,
      booking_fee: service.booking_fee || '',
      duration_minutes: service.duration_minutes
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
          <button className={styles.addBtn} onClick={() => { setEditingService(null); setFormData({ name: '', description: '', price: '', booking_fee: '', duration_minutes: 30 }); setIsModalOpen(true); }}>
            <Icon name="plus" size={18} /> Nuevo Servicio
          </button>
        </div>

        {error ? (
          <div className={styles.error}>{error}</div>
        ) : (
          <div className={styles.servicesGrid}>
            {services.map(service => (
              <div key={service.id} className={styles.serviceCard}>
                <div className={styles.serviceHeader}>
                  <h3>{service.name}</h3>
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
                <div className={styles.formGroup}>
                  <label>Nombre del Servicio</label>
                  <input 
                    type="text" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Ej: Corte de Cabello, Consulta General..."
                    required
                  />
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
