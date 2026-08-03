import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import axios from 'axios';
import styles from './AdminSidebar.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export default function AdminSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { admin, token, logout } = useAdminAuth();
  const [isOpen, setIsOpen] = useState(true);
  const [pendingDoctorsCount, setPendingDoctorsCount] = useState(0);
  const [pendingTicketsCount, setPendingTicketsCount] = useState(0);

  useEffect(() => {
    if (token) {
      fetchSidebarCounters();
    }
  }, [token, location.pathname]);

  const fetchSidebarCounters = async () => {
    try {
      // 1. Obtener doctores pendientes
      const docsRes = await axios.get(`${API_BASE_URL}/api/admin/doctors`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (docsRes.data?.success && docsRes.data?.doctors) {
        const pending = docsRes.data.doctors.filter(d => d.status === 'pending').length;
        setPendingDoctorsCount(pending);
      }

      // 2. Obtener tickets pendientes
      try {
        const ticketsRes = await axios.get(`${API_BASE_URL}/api/admin/tickets`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (ticketsRes.data?.success && ticketsRes.data?.tickets) {
          const pendingT = ticketsRes.data.tickets.filter(t => t.status === 'pending').length;
          setPendingTicketsCount(pendingT);
        }
      } catch (e) {
        // Ignorar si el endpoint no existe o falla silenciosamente
      }
    } catch (error) {
      // Error silencioso para no romper renderizado de sidebar
    }
  };

  const menuItems = [
    {
      label: 'Dashboard',
      icon: '🏠',
      path: '/admin/dashboard'
    },
    {
      label: 'Profesionales',
      icon: '👥',
      path: '/admin/doctors',
      badge: pendingDoctorsCount > 0 ? pendingDoctorsCount : null,
      badgeColor: '#f59e0b'
    },
    {
      label: 'Planes y Pagos',
      icon: '💳',
      path: '/admin/subscriptions'
    },
    {
      label: 'Planes Landing',
      icon: '📋',
      path: '/admin/plans'
    },
    {
      label: 'Servicios Base',
      icon: '💼',
      path: '/admin/template-services'
    },
    {
      label: 'Convenios Base',
      icon: '🛡️',
      path: '/admin/template-insurances'
    },
    {
      label: 'Reportes',
      icon: '📊',
      path: '/admin/reports'
    },
    {
      label: 'Tickets de Soporte',
      icon: '📩',
      path: '/admin/support-tickets',
      badge: pendingTicketsCount > 0 ? pendingTicketsCount : null,
      badgeColor: '#ef4444'
    },
    {
      label: 'Transacciones y Actividad',
      icon: '📈',
      path: '/admin/activity'
    }
  ];

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    if (window.confirm('¿Deseas cerrar la sesión de administrador?')) {
      logout();
      navigate('/admin/login');
    }
  };

  return (
    <div className={`${styles.sidebar} ${!isOpen ? styles.collapsed : ''}`}>
      <div className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🔐</span>
          {isOpen && <span className={styles.logoText}>TurnoHub Admin</span>}
        </div>
        <button
          className={styles.toggleBtn}
          onClick={() => setIsOpen(!isOpen)}
          title={isOpen ? "Colapsar menú" : "Expandir menú"}
        >
          {isOpen ? '◀' : '▶'}
        </button>
      </div>

      <nav className={styles.nav}>
        {menuItems.map((item) => (
          <button
            key={item.path}
            className={`${styles.navItem} ${isActive(item.path) ? styles.active : ''}`}
            onClick={() => navigate(item.path)}
            title={item.label}
          >
            <span className={styles.icon}>{item.icon}</span>
            {isOpen && <span className={styles.label}>{item.label}</span>}
            {item.badge && (
              <span 
                className={styles.badge} 
                style={{ backgroundColor: item.badgeColor || '#ef4444' }}
                title={`${item.badge} pendientes`}
              >
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className={styles.footer}>
        {isOpen && (
          <div className={styles.userInfo}>
            <span className={styles.userRole}>SUPERADMIN</span>
            <span className={styles.userEmail} title={admin?.email || 'admin.turnohub@gmail.com'}>
              {admin?.email || 'admin.turnohub@gmail.com'}
            </span>
          </div>
        )}

        <button
          className={styles.logoutBtn}
          onClick={handleLogout}
          title="Cerrar Sesión"
        >
          <span className={styles.icon}>🚪</span>
          {isOpen && <span className={styles.label}>Cerrar Sesión</span>}
        </button>
      </div>
    </div>
  );
}
