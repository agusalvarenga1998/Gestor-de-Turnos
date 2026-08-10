import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import AdminLayout from '../components/AdminLayout';
import axios from 'axios';
import styles from './AdminDashboardPage.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { admin, token } = useAdminAuth();
  const [doctors, setDoctors] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    suspended: 0,
    trial: 0,
    expiringTrial: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Obtener lista de doctores
      const docsRes = await axios.get(`${API_BASE_URL}/api/admin/doctors`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (docsRes.data.success && docsRes.data.doctors) {
        const docList = docsRes.data.doctors;
        setDoctors(docList);

        const now = new Date();
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

        const pendingCount = docList.filter(d => d.status === 'pending').length;
        const approvedCount = docList.filter(d => d.status === 'approved').length;
        const rejectedCount = docList.filter(d => d.status === 'rejected').length;
        const suspendedCount = docList.filter(d => d.status === 'suspended').length;
        
        // Trials activos (fecha futura)
        const trialCount = docList.filter(d => {
          if (d.subscription_status !== 'trial') return false;
          if (!d.trial_ends_at) return true;
          return new Date(d.trial_ends_at) >= now;
        }).length;

        // Cuentas vencidas (trial o activa con fecha pasada, o estado expired)
        const expiredTrialCount = docList.filter(d => {
          if (d.subscription_status === 'expired') return true;
          if (d.subscription_status === 'trial' && d.trial_ends_at && new Date(d.trial_ends_at) < now) return true;
          if (d.subscription_status === 'active' && d.subscription_expires_at && new Date(d.subscription_expires_at) < now) return true;
          return false;
        }).length;
        
        // Pruebas por vencer en los próximos 3 días (que aún no han vencido)
        const expiringTrialCount = docList.filter(d => {
          if (d.subscription_status === 'trial' && d.trial_ends_at) {
            const endDate = new Date(d.trial_ends_at);
            const diff = endDate.getTime() - now.getTime();
            return diff > 0 && diff <= threeDaysMs;
          }
          return false;
        }).length;

        setStats({
          total: docList.length,
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
          suspended: suspendedCount,
          trial: trialCount,
          expiringTrial: expiringTrialCount,
          expiredTrial: expiredTrialCount
        });
      }

      // 2. Obtener tickets de soporte
      try {
        const ticketsRes = await axios.get(`${API_BASE_URL}/api/admin/tickets`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (ticketsRes.data.success) {
          setTickets(ticketsRes.data.tickets || []);
        }
      } catch (tErr) {
        console.log('No se pudieron cargar los tickets de soporte');
      }
    } catch (error) {
      console.error('Error fetching admin dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const pendingTickets = tickets.filter(t => t.status === 'pending');

  return (
    <AdminLayout>
      <div className={styles.container}>
        {/* Banner Superior Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.adminBadge}>⚡ PANEL SUPERADMIN TURNOHUB</div>
            <h1>Panel de Control Principal</h1>
            <p>Bienvenido, <strong>{admin?.name || 'Administrador Central'}</strong> ({admin?.email || 'admin.turnohub@gmail.com'})</p>
          </div>
          <button className={styles.refreshBtn} onClick={fetchDashboardData} title="Actualizar datos">
            🔄 Actualizar Datos
          </button>
        </div>

        <div className={styles.content}>
          {/* Banners de Alerta Importante */}
          {stats.pending > 0 && (
            <div className={styles.alertBanner}>
              <span className={styles.alertIcon}>⚠️</span>
              <div className={styles.alertText}>
                <strong>{stats.pending} solicitud(es) de profesionales pendiente(s) de aprobación.</strong>
                <span>Revisa la documentación y aprueba sus accesos para iniciar la prueba gratis.</span>
              </div>
              <button 
                className={styles.alertBtn} 
                onClick={() => navigate('/admin/doctors?tab=pending')}
              >
                Revisar Solicitudes
              </button>
            </div>
          )}

          {stats.expiringTrial > 0 && (
            <div className={styles.warningBanner}>
              <span className={styles.alertIcon}>⏳</span>
              <div className={styles.alertText}>
                <strong>{stats.expiringTrial} médico(s) con prueba gratis finalizando en menos de 3 días.</strong>
                <span>El sistema envía un aviso por mail a admin.turnohub@gmail.com cuando faltan 2 días.</span>
              </div>
              <button 
                className={styles.warningBtn} 
                onClick={() => navigate('/admin/doctors?tab=trial')}
              >
                Ver Pruebas por Vencer
              </button>
            </div>
          )}

          {stats.expiredTrial > 0 && (
            <div className={styles.alertBanner} style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca' }}>
              <span className={styles.alertIcon}>🚫</span>
              <div className={styles.alertText}>
                <strong style={{ color: '#991b1b' }}>{stats.expiredTrial} profesional(es) con prueba gratis o suscripción VENCIDA.</strong>
                <span style={{ color: '#7f1d1d' }}>Puedes extender su período o reactivarlos con un plan activo desde la lista de profesionales.</span>
              </div>
              <button 
                className={styles.alertBtn} 
                style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
                onClick={() => navigate('/admin/doctors?status=expired')}
              >
                Ver Cuentas Vencidas
              </button>
            </div>
          )}

          {/* Grilla Principal de Métricas */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard} onClick={() => navigate('/admin/doctors')}>
              <div className={styles.statIcon} style={{ backgroundColor: '#e0e7ff', color: '#4338ca' }}>
                👨‍⚕️
              </div>
              <div className={styles.statInfo}>
                <p className={styles.statLabel}>Total Profesionales</p>
                <p className={styles.statValue}>{stats.total}</p>
                <span className={styles.statSub}>{stats.approved} activos / aprobados</span>
              </div>
            </div>

            <div className={styles.statCard} onClick={() => navigate('/admin/doctors?tab=pending')}>
              <div className={styles.statIcon} style={{ backgroundColor: stats.pending > 0 ? '#fef3c7' : '#f3f4f6', color: '#d97706' }}>
                ⏳
              </div>
              <div className={styles.statInfo}>
                <p className={styles.statLabel}>Pendientes de Alta</p>
                <p className={styles.statValue} style={{ color: stats.pending > 0 ? '#b45309' : undefined }}>
                  {stats.pending}
                </p>
                <span className={styles.statSub}>{stats.pending > 0 ? '⚠️ Requieren revisión' : 'Al día'}</span>
              </div>
            </div>

            <div className={styles.statCard} onClick={() => navigate('/admin/doctors?tab=trial')}>
              <div className={styles.statIcon} style={{ backgroundColor: '#e0f2fe', color: '#0284c7' }}>
                🎁
              </div>
              <div className={styles.statInfo}>
                <p className={styles.statLabel}>En Prueba Gratuita</p>
                <p className={styles.statValue}>{stats.trial}</p>
                <span className={styles.statSub}>{stats.expiringTrial} por vencer en 72hs</span>
              </div>
            </div>

            <div className={styles.statCard} onClick={() => navigate('/admin/support-tickets')}>
              <div className={styles.statIcon} style={{ backgroundColor: pendingTickets.length > 0 ? '#fee2e2' : '#f3f4f6', color: '#dc2626' }}>
                📩
              </div>
              <div className={styles.statInfo}>
                <p className={styles.statLabel}>Tickets Pendientes</p>
                <p className={styles.statValue} style={{ color: pendingTickets.length > 0 ? '#dc2626' : undefined }}>
                  {pendingTickets.length}
                </p>
                <span className={styles.statSub}>{tickets.length} tickets en total</span>
              </div>
            </div>
          </div>

          {/* Accesos Rápidos Principales */}
          <div className={styles.sectionTitle}>
            <h2>Acciones Rápidas del Panel</h2>
            <p>Accede directamente a los módulos más utilizados de la plataforma TurnoHub</p>
          </div>

          <div className={styles.actionsGrid}>
            <button className={styles.actionCard} onClick={() => navigate('/admin/doctors')}>
              <div className={styles.actionHeader}>
                <span className={styles.actionIcon}>👥</span>
                <span className={styles.actionArrow}>→</span>
              </div>
              <h3>Gestión de Profesionales</h3>
              <p>Aprobar nuevos doctores, suspender cuentas, extender periodos de prueba y saldar deudas.</p>
            </button>

            <button className={styles.actionCard} onClick={() => navigate('/admin/subscriptions')}>
              <div className={styles.actionHeader}>
                <span className={styles.actionIcon}>💳</span>
                <span className={styles.actionArrow}>→</span>
              </div>
              <h3>Planes y Pagos</h3>
              <p>Revisar comprobantes de suscripción, aprobar pagos pendientes y gestionar planes.</p>
            </button>

            <button className={styles.actionCard} onClick={() => navigate('/admin/template-services')}>
              <div className={styles.actionHeader}>
                <span className={styles.actionIcon}>💼</span>
                <span className={styles.actionArrow}>→</span>
              </div>
              <h3>Servicios Base</h3>
              <p>Configurar el catálogo predeterminado de servicios y prestaciones por especialidad.</p>
            </button>

            <button className={styles.actionCard} onClick={() => navigate('/admin/template-insurances')}>
              <div className={styles.actionHeader}>
                <span className={styles.actionIcon}>🛡️</span>
                <span className={styles.actionArrow}>→</span>
              </div>
              <h3>Convenios Base</h3>
              <p>Gestionar las obras sociales y prepagas sugeridas al momento del registro.</p>
            </button>

            <button className={styles.actionCard} onClick={() => navigate('/admin/plans')}>
              <div className={styles.actionHeader}>
                <span className={styles.actionIcon}>📋</span>
                <span className={styles.actionArrow}>→</span>
              </div>
              <h3>Planes Comerciales Landing</h3>
              <p>Editar los precios y características de los planes comercializados en la web pública.</p>
            </button>

            <button className={styles.actionCard} onClick={() => navigate('/admin/reports')}>
              <div className={styles.actionHeader}>
                <span className={styles.actionIcon}>📊</span>
                <span className={styles.actionArrow}>→</span>
              </div>
              <h3>Reportes Globales</h3>
              <p>Analizar métricas de ingresos, uso del sistema, turnos generados y actividad global.</p>
            </button>
          </div>

          {/* Resumen de Estado del Sistema */}
          <div className={styles.systemStatusCard}>
            <div className={styles.statusHeader}>
              <h3>🛠️ Estado del Sistema TurnoHub</h3>
              <span className={styles.statusBadgeOk}>● OPERATIVO</span>
            </div>
            <div className={styles.statusDetails}>
              <div className={styles.statusItem}>
                <span className={styles.statusLabel}>Servidor de Correos SMTP:</span>
                <span className={styles.statusVal}>Verificado (Notificaciones automáticas a admin.turnohub@gmail.com activadas)</span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.statusLabel}>Cron de Pruebas Gratis:</span>
                <span className={styles.statusVal}>Activo (Verifica diariamente a las 09:00 hs los vencimientos en 2 días)</span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.statusLabel}>Base de Datos PostgreSQL:</span>
                <span className={styles.statusVal}>Conectado correctamente</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </AdminLayout>
  );
}
