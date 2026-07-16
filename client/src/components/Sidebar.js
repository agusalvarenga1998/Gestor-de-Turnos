import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Icon from './Icon';
import WebSocketStatus from './WebSocketStatus';
import TrialCounter from './TrialCounter';
import styles from './Sidebar.module.css';

export default function Sidebar({ isMobile, isOpen, onClose, onOpenTour }) {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const menuItems = [
    { icon: 'home', label: 'Dashboard', path: '/dashboard' },
    { icon: 'reports', label: 'Guía de Inicio', path: '/onboarding' },
    { icon: 'calendar', label: 'Gestión de Turnos', path: '/appointments' },
    { icon: 'users', label: 'Clientes', path: '/patients' },
    { icon: 'briefcase', label: 'Mis Servicios', path: '/services' },
    { icon: 'shield', label: 'Convenios', path: '/insurance' },
    { icon: 'clock', label: 'Horarios de Trabajo', path: '/working-hours' },
    { icon: 'settings', label: 'Configuración', path: '/settings' },
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <>
      <aside className={`
        ${styles.sidebar} 
        ${isCollapsed ? styles.collapsed : ''} 
        ${isOpen ? styles.open : ''}
      `}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logo}>
            <span className={`material-symbols-outlined ${styles.logoIcon}`}>hub</span>
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
            <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar menú">
              <Icon name="x" size={24} color="currentColor" />
            </button>
          )}
        </div>

        {/* Menu items */}
        <nav className={styles.nav}>
          {menuItems.map(item => {
            const isLocked = item.path === '/insurance' && user?.plan && user.plan.allow_insurance === false;
            return (
              <NavLink
                key={item.path}
                to={isLocked ? '#' : item.path}
                className={({ isActive }) => 
                  `${styles.navItem} ${isActive && !isLocked ? styles.active : ''} ${isLocked ? styles.lockedItem : ''}`
                }
                title={isCollapsed ? item.label : ''}
                onClick={(e) => {
                  if (isLocked) {
                    e.preventDefault();
                    setShowUpgradeModal(true);
                  } else if (isOpen) {
                    onClose();
                  }
                }}
              >
                <Icon name={item.icon} size={20} color="currentColor" />
                {(!isCollapsed || isOpen) && <span className={styles.label}>{item.label}</span>}
                {isLocked && (!isCollapsed || isOpen) && <span className={styles.lockBadge}>🔒</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Mobile Tutorial Button */}
        {isOpen && onOpenTour && (
          <div className={styles.mobileTourContainer}>
            <button 
              onClick={() => {
                onOpenTour();
                onClose();
              }}
              className={styles.mobileTourBtn}
            >
              <span className="material-symbols-outlined">explore</span>
              <span>Tutorial de TurnoHub</span>
            </button>
          </div>
        )}

        {/* Mobile Status Section */}
        <div className={styles.sidebarStatus}>
          <WebSocketStatus />
          <TrialCounter />
        </div>

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

      {/* Upgrade Modal overlay */}
      {showUpgradeModal && (
        <div className={styles.modalOverlay} onClick={() => setShowUpgradeModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={`material-symbols-outlined ${styles.modalLockIcon}`}>lock</span>
              <h3>Funcionalidad Exclusiva</h3>
            </div>
            <div className={styles.modalBody}>
              <p>El acceso al módulo de <strong>Convenios y Obras Sociales</strong> no está habilitado en tu plan actual (<strong>{user?.plan?.name || 'Plan Básico'}</strong>).</p>
              <p className={styles.modalInstruction}>Contacta al administrador del sistema para solicitar un ascenso de plan.</p>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.upgradeBtn} onClick={() => setShowUpgradeModal(false)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
