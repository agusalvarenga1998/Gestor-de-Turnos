import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';
import AdminLayout from '../components/AdminLayout';
import axios from 'axios';
import styles from './AdminSubscriptionsPage.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export default function AdminSubscriptionsPage() {
  const { token } = useAdminAuth();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/admin/subscriptions`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setSubscriptions(response.data.subscriptions);
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: '#fbbf24', label: 'Pendiente' },
      approved: { color: '#34d399', label: 'Aprobado' },
      rejected: { color: '#f87171', label: 'Rechazado' }
    };
    const config = statusConfig[status] || { color: '#9ca3af', label: status };
    return (
      <span
        className={styles.badge}
        style={{ backgroundColor: config.color + '20', color: config.color }}
      >
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1>Historial de Suscripciones</h1>
          </div>
          <p>Cargando...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Historial de Suscripciones</h1>
        <p>Total de registros: {subscriptions.length}</p>
      </div>

      {subscriptions.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No hay registros de suscripciones aún</p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Doctor</th>
                <th>Email</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Fecha Registro</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map(sub => (
                <tr key={sub.id}>
                  <td>{sub.name || '-'}</td>
                  <td>{sub.email || '-'}</td>
                  <td>
                    {sub.amount ? `$${parseFloat(sub.amount).toFixed(2)}` : '-'}
                  </td>
                  <td>{getStatusBadge(sub.status)}</td>
                  <td>{formatDate(sub.period_start)}</td>
                  <td>{formatDate(sub.period_end)}</td>
                  <td className={styles.date}>{formatDate(sub.created_at)}</td>
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
