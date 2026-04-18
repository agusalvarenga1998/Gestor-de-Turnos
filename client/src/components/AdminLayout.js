import React from 'react';
import AdminSidebar from './AdminSidebar';
import styles from './AdminLayout.module.css';

export default function AdminLayout({ children }) {
  return (
    <div className={styles.container}>
      <AdminSidebar />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
