import React from 'react';
import Sidebar from './Sidebar';
import WebSocketStatus from './WebSocketStatus';
import TrialCounter from './TrialCounter';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import styles from './DoctorLayout.module.css';

export default function DoctorLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    navigate('/login');
  };

  return (
    <div className={styles.layout}>
      <Sidebar />

      <div className={styles.mainContent}>
        <header className={styles.topbar}>
          <div className={styles.topbarContent}>
            <div className={styles.breadcrumb}>
              {/* Breadcrumb irá aquí */}
            </div>

            <div className={styles.topbarRight}>
              <WebSocketStatus />
              <TrialCounter />

              <div className={styles.userMenu}>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{user?.name}</span>
                  <span className={styles.userRole}>{user?.specialization || 'Profesional'}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
