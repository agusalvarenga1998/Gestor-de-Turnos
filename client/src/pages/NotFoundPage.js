import React from 'react';
import { Link } from 'react-router-dom';
import styles from './NotFoundPage.module.css';

export default function NotFoundPage() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.code}>404</h1>
        <h2 className={styles.title}>Página no encontrada</h2>
        <p className={styles.message}>
          Lo sentimos, la página que buscas no existe.
        </p>
        <Link to="/dashboard" className={styles.button}>
          Volver al Dashboard
        </Link>
      </div>
    </div>
  );
}
