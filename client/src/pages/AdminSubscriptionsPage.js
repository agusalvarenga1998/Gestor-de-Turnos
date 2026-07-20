import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';
import AdminLayout from '../components/AdminLayout';
import Loading from '../components/Loading';
import axios from 'axios';
import styles from './AdminSubscriptionsPage.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export default function AdminSubscriptionsPage() {
  const { token } = useAdminAuth();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mpAccount, setMpAccount] = useState(null);
  const [loadingMp, setLoadingMp] = useState(false);
  const [mpMessage, setMpMessage] = useState('');

  useEffect(() => {
    fetchSubscriptions();
    fetchMpAccount();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mp_connected') === 'true') {
      setMpMessage('✓ Cuenta de Mercado Pago vinculada correctamente.');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('mp_connected') === 'error') {
      setMpMessage('✕ Error al vincular la cuenta de Mercado Pago.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
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

  const fetchMpAccount = async () => {
    try {
      setLoadingMp(true);
      const response = await axios.get(`${API_BASE_URL}/api/mercadopago/oauth/admin/account`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success && response.data.connected) {
        setMpAccount(response.data.account || { nickname: 'Cuenta Conectada' });
      } else {
        setMpAccount(null);
      }
    } catch (err) {
      console.error('Error fetching admin Mercado Pago account:', err);
    } finally {
      setLoadingMp(false);
    }
  };

  const handleConnectMp = () => {
    if (!token) return;
    window.location.href = `${API_BASE_URL}/api/mercadopago/oauth/admin/auth?token=${token}`;
  };

  const handleApproveSubscription = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas aprobar esta suscripción? Esto activará y extenderá el plan del profesional por 30 días.')) return;
    try {
      const response = await axios.patch(`${API_BASE_URL}/api/admin/subscriptions/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        alert('Suscripción aprobada con éxito.');
        fetchSubscriptions();
      }
    } catch (error) {
      console.error('Error approving subscription:', error);
      alert(error.response?.data?.error || 'Error al aprobar la suscripción.');
    }
  };

  const handleRejectSubscription = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas rechazar esta solicitud de suscripción?')) return;
    try {
      const response = await axios.patch(`${API_BASE_URL}/api/admin/subscriptions/${id}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        alert('Solicitud rechazada.');
        fetchSubscriptions();
      }
    } catch (error) {
      console.error('Error rejecting subscription:', error);
      alert(error.response?.data?.error || 'Error al rechazar la solicitud.');
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
        <Loading />
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

      {mpMessage && (
        <div className={mpMessage.startsWith('✓') ? styles.mpSuccessAlert : styles.mpErrorAlert}>
          {mpMessage}
        </div>
      )}

      <div className={styles.mpConnectionCard}>
        <div className={styles.mpCardHeader}>
          <h3>💰 Cobro de Suscripciones (Mercado Pago)</h3>
          <p>Vincula la cuenta de Mercado Pago única donde se acreditarán los pagos de todos los planes de suscripción de los médicos.</p>
        </div>
        <div className={styles.mpCardBody}>
          {loadingMp ? (
            <span className={styles.mpLoading}>Cargando estado de Mercado Pago...</span>
          ) : mpAccount ? (
            <div className={styles.mpConnectedInfo}>
              <div className={styles.mpStatusBadgeConnected}>✓ Cuenta Vinculada</div>
              <div className={styles.mpAccountDetails}>
                <strong>Titular:</strong> {mpAccount.name || mpAccount.nickname || 'Administrador'} ({mpAccount.email || 'email no disponible'})
              </div>
              <button onClick={handleConnectMp} className={styles.mpReconnectBtn}>
                Revincular Cuenta
              </button>
            </div>
          ) : (
            <div className={styles.mpDisconnectedInfo}>
              <div className={styles.mpStatusBadgeDisconnected}>⚠ Cuenta no vinculada</div>
              <p className={styles.mpWarningText}>Actualmente se están usando las credenciales estáticas de contingencia. Se recomienda vincular tu cuenta real de producción para recibir los cobros directamente.</p>
              <button onClick={handleConnectMp} className={styles.mpConnectBtn}>
                Vincular Mercado Pago
              </button>
            </div>
          )}
        </div>
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
                <th>Acciones</th>
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
                  <td>
                    {sub.status === 'pending' ? (
                      <div className={styles.actionButtons}>
                        <button
                          onClick={() => handleApproveSubscription(sub.id)}
                          className={styles.approveBtn}
                          title="Aprobar Suscripción"
                        >
                          ✓ Aprobar
                        </button>
                        <button
                          onClick={() => handleRejectSubscription(sub.id)}
                          className={styles.rejectBtn}
                          title="Rechazar Suscripción"
                        >
                          ✕ Rechazar
                        </button>
                      </div>
                    ) : (
                      <span className={styles.noAction}>-</span>
                    )}
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
