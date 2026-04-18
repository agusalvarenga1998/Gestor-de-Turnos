import React, { useState, useEffect } from 'react';
import DoctorLayout from '../components/DoctorLayout';
import Icon from '../components/Icon';
import { insuranceAPI } from '../services/api';
import styles from './InsurancePage.module.css';

export default function InsurancePage() {
  const [insurances, setInsurances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    additional_fee: ''
  });

  useEffect(() => {
    fetchInsurances();
  }, []);

  const fetchInsurances = async () => {
    try {
      setLoading(true);
      const response = await insuranceAPI.getInsurances();

      if (response.success) {
        setInsurances(response.insurances);
      }

      setError(null);
    } catch (err) {
      console.error('Error cargando obras sociales:', err);
      setError('Error al cargar las obras sociales');
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
        setInsurances(prev => {
          if (editingId) {
            return prev.map(i => i.id === editingId ? response.insurance : i);
          } else {
            return [...prev, response.insurance];
          }
        });

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

  if (loading) {
    return (
      <DoctorLayout>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Cargando obras sociales...</p>
        </div>
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Obras Sociales</h1>
            <p className={styles.subtitle}>Gestiona tus obras sociales y montos adicionales</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className={styles.addBtn}
          >
            <Icon name="plus" size={18} color="currentColor" />
            Nueva Obra Social
          </button>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        {/* Form Modal */}
        {showForm && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h2>{editingId ? 'Editar Obra Social' : 'Nueva Obra Social'}</h2>
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
                    placeholder="Ej: OSDE, Swiss Medical, etc."
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Monto Adicional ($)</label>
                  <input
                    type="number"
                    name="additional_fee"
                    value={formData.additional_fee}
                    onChange={handleFormChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                  <small>Monto adicional que cobras por esta obra social</small>
                </div>

                <div className={styles.formActions}>
                  <button type="submit" className={styles.submitBtn}>
                    {editingId ? 'Guardar Cambios' : 'Crear Obra Social'}
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
          <div className={styles.tableContainer}>
            <table className={styles.insuranceTable}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Monto Adicional</th>
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
                        onClick={() => handleEdit(insurance)}
                        className={styles.iconBtn}
                        title="Editar"
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
        )}

        <div className={styles.footer}>
          <p>Total: <strong>{insurances.length}</strong> obra(s) social(es)</p>
        </div>
      </div>
    </DoctorLayout>
  );
}
