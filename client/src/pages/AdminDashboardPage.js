import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import AdminLayout from '../components/AdminLayout';
import axios from 'axios';
import styles from './AdminDashboardPage.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { admin, token, logout } = useAdminAuth();
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    suspended: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/admin/doctors`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success && response.data.doctors) {
        const doctors = response.data.doctors;
        const stats = {
          total: doctors.length,
          pending: doctors.filter(d => d.status === 'pending').length,
          approved: doctors.filter(d => d.status === 'approved').length,
          rejected: doctors.filter(d => d.status === 'rejected').length,
          suspended: doctors.filter(d => d.status === 'suspended').length
        };
        setStats(stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <AdminLayout>
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1>Panel de Administración</h1>
          <p>Bienvenido, {admin?.name}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.content}>
        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ backgroundColor: '#e0e7ff' }}>
              👤
            </div>
            <div className={styles.statInfo}>
              <p className={styles.statLabel}>Doctores Total</p>
              <p className={styles.statValue}>{stats.total}</p>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ backgroundColor: '#fef3c7' }}>
              ⏳
            </div>
            <div className={styles.statInfo}>
              <p className={styles.statLabel}>Pendientes</p>
              <p className={styles.statValue}>{stats.pending}</p>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ backgroundColor: '#dcfce7' }}>
              ✓
            </div>
            <div className={styles.statInfo}>
              <p className={styles.statLabel}>Aprobados</p>
              <p className={styles.statValue}>{stats.approved}</p>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ backgroundColor: '#fee2e2' }}>
              ✕
            </div>
            <div className={styles.statInfo}>
              <p className={styles.statLabel}>Rechazados</p>
              <p className={styles.statValue}>{stats.rejected}</p>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ backgroundColor: '#f3e8ff' }}>
              ⛔
            </div>
            <div className={styles.statInfo}>
              <p className={styles.statLabel}>Suspendidos</p>
              <p className={styles.statValue}>{stats.suspended}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={styles.actions}>
          <button
            className={styles.actionBtn}
            onClick={() => navigate('/admin/doctors')}
          >
            <span>👨‍⚕️</span>
            Gestionar Doctores
          </button>
          <button
            className={styles.actionBtn}
            onClick={() => navigate('/admin/subscriptions')}
          >
            <span>💰</span>
            Ver Suscripciones
          </button>
        </div>

        {/* Quick Actions */}
        <div className={styles.quickActions}>
          <h2>Acciones Rápidas</h2>
          <div className={styles.actionsList}>
            <div className={styles.actionItem}>
              <p>📋 Revisar solicitudes pendientes</p>
              <button
                onClick={() => navigate('/admin/doctors')}
                className={styles.smallBtn}
              >
                Ir
              </button>
            </div>
            <div className={styles.actionItem}>
              <p>⏱️ Extender suscripciones que vencen pronto</p>
              <button
                onClick={() => navigate('/admin/doctors')}
                className={styles.smallBtn}
              >
                Ir
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </AdminLayout>
  );
}
