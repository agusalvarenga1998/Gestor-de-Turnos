import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Icon from './Icon';
import styles from './Sidebar.module.css';

export default function Sidebar({ isMobile, isOpen, onClose }) {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { icon: 'home', label: 'Dashboard', path: '/dashboard' },
    { icon: 'calendar', label: 'Gestión de Turnos', path: '/appointments' },
    { icon: 'users', label: 'Clientes', path: '/patients' },
    { icon: 'briefcase', label: 'Mis Servicios', path: '/services' },
    { icon: 'shield', label: 'Convenios / Beneficios', path: '/insurance' },
    { icon: 'clock', label: 'Horarios de Trabajo', path: '/working-hours' },
    { icon: 'settings', label: 'Configuración', path: '/settings' },
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <aside className={`
      ${styles.sidebar} 
      ${isCollapsed ? styles.collapsed : ''} 
      ${isOpen ? styles.open : ''}
    `}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.logo}>
          <img src="/logo_turnohub.png" alt="TurnoHub" className={styles.sidebarLogo} />
          {(!isCollapsed || isOpen) && <span className={styles.logoText}>TurnoHub</span>}
        </div>
        
        {/* Botón colapsar (solo escritorio) */}
        {!isOpen && (
          <button
            className={styles.collapseBtn}
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expandir' : 'Contraer'}
          >
            {isCollapsed ? '›' : '‹'}
          </button>
        )}

        {/* Botón cerrar (solo móvil) */}
        {isOpen && (
          <button className={styles.closeBtn} onClick={onClose}>
            <Icon name="x" size={24} color="currentColor" />
          </button>
        )}
      </div>

      {/* Menu items */}
      <nav className={styles.nav}>
        {menuItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
            title={isCollapsed ? item.label : ''}
            onClick={isOpen ? onClose : undefined}
          >
            <Icon name={item.icon} size={20} color="currentColor" />
            {(!isCollapsed || isOpen) && <span className={styles.label}>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer con usuario */}
      <div className={styles.footer}>
        {(!isCollapsed || isOpen) && user && (
          <div className={styles.userInfo}>
            <div className={styles.userName}>{user.name || 'Profesional'}</div>
            <div className={styles.userEmail}>{user.email}</div>
          </div>
        )}
        <button
          className={styles.logoutBtn}
          onClick={handleLogout}
          title="Cerrar sesión"
        >
          <Icon name="logout" size={20} color="currentColor" />
          {(!isCollapsed || isOpen) && <span>Salir</span>}
        </button>
      </div>
    </aside>
  );
}
