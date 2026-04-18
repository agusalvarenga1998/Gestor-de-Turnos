import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import styles from './AdminSidebar.module.css';

export default function AdminSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAdminAuth();
  const [isOpen, setIsOpen] = useState(true);

  const menuItems = [
    {
      label: 'Dashboard',
      icon: '🏠',
      path: '/admin/dashboard'
    },
    {
      label: 'Profesionales',
      icon: '👥',
      path: '/admin/doctors'
    },
    {
      label: 'Planes y Pagos',
      icon: '💳',
      path: '/admin/subscriptions'
    },
    {
      label: 'Reportes',
      icon: '📊',
      path: '/admin/reports'
    }
  ];

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    if (window.confirm('¿Deseas cerrar sesión?')) {
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
          </button>
        ))}
      </nav>

      <div className={styles.footer}>
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
