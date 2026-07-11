import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';
import AdminLayout from '../components/AdminLayout';
import Icon from '../components/Icon';
import axios from 'axios';
import styles from './AdminTemplateInsurancesPage.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export default function AdminTemplateInsurancesPage() {
  const { token } = useAdminAuth();
  const [insurances, setInsurances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchInsurances();
  }, []);

  const fetchInsurances = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/admin/template-insurances`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setInsurances(response.data.insurances);
      }
    } catch (err) {
      console.error('Error fetching template insurances:', err);
      setError('No se pudieron cargar las obras sociales base.');
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
      setError('');
      setSuccessMsg('');
      const response = await axios.post(`${API_BASE_URL}/api/admin/template-insurances/import`, formDataImport, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      if (response.data.success) {
        setSuccessMsg(`✓ ${response.data.message}`);
        fetchInsurances();
      }
    } catch (err) {
      console.error('Error importing Excel:', err);
      setError('Error al importar el archivo Excel: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleDeleteClick = async (insuranceId, insuranceName) => {
    if (!window.confirm(`¿Estás seguro de eliminar "${insuranceName}" del catálogo global?`)) {
      return;
    }

    try {
      setError('');
      setSuccessMsg('');
      const response = await axios.delete(`${API_BASE_URL}/api/admin/template-insurances/${insuranceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setSuccessMsg(`✓ ${response.data.message}`);
        fetchInsurances();
      }
    } catch (err) {
      console.error('Error deleting template insurance:', err);
      setError('Error al eliminar la obra social base.');
    }
  };

  return (
    <AdminLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1>Catálogo de Convenios Base</h1>
            <p>Sube plantillas de Obras Sociales y Prepagas para que los profesionales las importen directamente en sus perfiles.</p>
          </div>
          <div className={styles.headerActions}>
            <label className={styles.importBtn}>
              <Icon name="upload" size={16} />
              Importar Excel
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                onChange={handleImportExcel} 
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

        {error && <div className={styles.errorMessage}>{error}</div>}
        {successMsg && <div className={styles.successMessage}>{successMsg}</div>}

        {loading ? (
          <div className={styles.infoText}>Cargando catálogo base...</div>
        ) : insurances.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No hay convenios en el catálogo global</p>
            <p>Usa el botón de importar arriba para cargar un Excel con la estructura de convenios y planes.</p>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Convenio / Prepaga</th>
                  <th>Sigla</th>
                  <th>Planes y Descuentos por Defecto</th>
                  <th style={{ width: '100px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {insurances.map((ins) => (
                  <tr key={ins.id}>
                    <td style={{ fontWeight: '700' }}>{ins.name}</td>
                    <td className={styles.acronym}>{ins.acronym || '-'}</td>
                    <td>
                      {ins.plans && ins.plans.length > 0 ? (
                        ins.plans.map((plan) => (
                          <span key={plan.id} className={styles.planItem}>
                            {plan.name} ({plan.coverage_type === 'percentage' ? `${plan.coverage_value}%` : `$${parseFloat(plan.coverage_value).toLocaleString()}`})
                          </span>
                        ))
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Sin planes configurados</span>
                      )}
                    </td>
                    <td>
                      <div className={styles.actionsCell}>
                        <button 
                          className={styles.deleteBtn}
                          onClick={() => handleDeleteClick(ins.id, ins.name)}
                          title="Eliminar del catálogo"
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
