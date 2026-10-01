import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../hooks/useAdminAuth';
import styles from './AdminSellersPage.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

const AdminSellersPage = () => {
  const { token: adminToken } = useAdminAuth();
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', commission_type: 'fixed', commission_value: 0 });
  const [isEditing, setIsEditing] = useState(null);
  const [expandedSellerId, setExpandedSellerId] = useState(null);
  const [sellerDoctors, setSellerDoctors] = useState({});
  const [loadingDoctors, setLoadingDoctors] = useState(null);

  const fetchSellers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/admin/sellers`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (response.data.success) {
        setSellers(response.data.sellers);
      }
    } catch (err) {
      setError('Error al cargar vendedores');
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`${API_BASE_URL}/api/admin/sellers/${isEditing.id}`, formData, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
      } else {
        await axios.post(`${API_BASE_URL}/api/admin/sellers`, formData, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
      }
      setShowModal(false);
      fetchSellers();
    } catch (err) {
      alert('Error al guardar: ' + (err.response?.data?.error || err.message));
    }
  };

  const openEdit = (seller) => {
    setIsEditing(seller);
    setFormData({
      name: seller.name,
      email: seller.email,
      phone: seller.phone || '',
      password: '',
      commission_type: seller.commission_type || 'fixed',
      commission_value: seller.commission_value || 0,
      is_active: seller.is_active
    });
    setShowModal(true);
  };

  const toggleSellerDoctors = async (seller) => {
    if (expandedSellerId === seller.id) {
      setExpandedSellerId(null);
      return;
    }

    setExpandedSellerId(seller.id);
    if (sellerDoctors[seller.id]) return;

    setLoadingDoctors(seller.id);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/admin/sellers/${seller.id}/doctors`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (response.data.success) {
        setSellerDoctors(prev => ({ ...prev, [seller.id]: response.data.doctors }));
      }
    } catch (err) {
      setSellerDoctors(prev => ({ ...prev, [seller.id]: [] }));
      alert('Error al cargar profesionales: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoadingDoctors(null);
    }
  };

  const formatDate = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('es-AR');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Gestión de Vendedores</h2>
        <button className={styles.addButton} onClick={() => { setIsEditing(null); setFormData({ name: '', email: '', phone: '', password: '', commission_type: 'fixed', commission_value: 0 }); setShowModal(true); }}>
          + Nuevo Vendedor
        </button>
      </div>

      {loading ? (
        <p>Cargando vendedores...</p>
      ) : error ? (
        <p className={styles.error}>{error}</p>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Estado</th>
                <th>Comisión</th>
                <th>Leads / Clientes</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sellers.map(seller => (
                <React.Fragment key={seller.id}>
                  <tr>
                    <td>{seller.name}</td>
                    <td>{seller.email}</td>
                    <td>
                      <span className={seller.is_active ? styles.badgeActive : styles.badgeInactive}>
                        {seller.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>{seller.commission_type === 'percentage' ? `${seller.commission_value}%` : `$${seller.commission_value}`}</td>
                    <td>{seller.total_leads} / {seller.total_paying}</td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.viewBtn} onClick={() => toggleSellerDoctors(seller)}>
                          {expandedSellerId === seller.id ? 'Ocultar' : 'Ver profesionales'}
                        </button>
                        <button className={styles.editBtn} onClick={() => openEdit(seller)}>Editar</button>
                      </div>
                    </td>
                  </tr>
                  {expandedSellerId === seller.id && (
                    <tr className={styles.detailRow}>
                      <td colSpan="6">
                        <div className={styles.detailPanel}>
                          <div className={styles.detailHeader}>
                            <h3>Profesionales traídos por {seller.name}</h3>
                            <span>{seller.total_leads || 0} registrados</span>
                          </div>
                          {loadingDoctors === seller.id ? (
                            <p className={styles.muted}>Cargando profesionales...</p>
                          ) : (sellerDoctors[seller.id] || []).length === 0 ? (
                            <p className={styles.muted}>Este vendedor todavía no registró profesionales.</p>
                          ) : (
                            <div className={styles.doctorsGrid}>
                              {(sellerDoctors[seller.id] || []).map(doctor => (
                                <div key={doctor.id} className={styles.doctorCard}>
                                  <div className={styles.doctorCardHeader}>
                                    <div>
                                      <h4>{doctor.name}</h4>
                                      <p>{doctor.email}</p>
                                    </div>
                                    <span className={styles.statusPill}>{doctor.commercial_status || 'lead'}</span>
                                  </div>
                                  <div className={styles.doctorMeta}>
                                    <span>{doctor.rubro || 'Sin rubro'}</span>
                                    <span>{doctor.specialization || 'Sin especialidad'}</span>
                                    <span>{doctor.phone || 'Sin teléfono'}</span>
                                    <span>Alta: {formatDate(doctor.created_at)}</span>
                                    <span>Plan: {doctor.plan_name || 'Sin plan'}</span>
                                    <span>Turnos: {doctor.total_appointments || 0}</span>
                                  </div>
                                  {doctor.seller_notes && <p className={styles.notes}>{doctor.seller_notes}</p>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>{isEditing ? 'Editar Vendedor' : 'Nuevo Vendedor'}</h3>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label>Nombre</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className={styles.formGroup}>
                <label>Email</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} disabled={!!isEditing} />
              </div>
              <div className={styles.formGroup}>
                <label>Teléfono</label>
                <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div className={styles.formGroup}>
                <label>{isEditing ? 'Nueva Contraseña (dejar en blanco para no cambiar)' : 'Contraseña'}</label>
                <input required={!isEditing} type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              </div>
              <div className={styles.formGroup}>
                <label>Tipo de Comisión</label>
                <select value={formData.commission_type} onChange={e => setFormData({...formData, commission_type: e.target.value})}>
                  <option value="fixed">Monto Fijo</option>
                  <option value="percentage">Porcentaje (%)</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Valor de Comisión</label>
                <input required type="number" step="0.01" value={formData.commission_value} onChange={e => setFormData({...formData, commission_value: e.target.value})} />
              </div>
              {isEditing && (
                <div className={styles.formGroup}>
                  <label>Estado</label>
                  <select value={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.value === 'true'})}>
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              )}
              <div className={styles.modalActions}>
                <button type="button" onClick={() => setShowModal(false)} className={styles.cancelBtn}>Cancelar</button>
                <button type="submit" className={styles.saveBtn}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSellersPage;
