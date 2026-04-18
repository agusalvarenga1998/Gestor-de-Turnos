import React, { useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import styles from './TrialCounter.module.css';

export default function TrialCounter() {
  const { user } = useAuth();

  const daysRemaining = useMemo(() => {
    if (!user?.trial_ends_at && !user?.subscription_expires_at) {
      return null;
    }

    const endDate = new Date(user.trial_ends_at || user.subscription_expires_at);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    const timeDiff = endDate - today;
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    return daysDiff > 0 ? daysDiff : 0;
  }, [user?.trial_ends_at, user?.subscription_expires_at]);

  // No mostrar si no está en trial o si no hay días restantes válidos
  if (user?.subscription_status !== 'trial' || daysRemaining === null) {
    return null;
  }

  const isWarning = daysRemaining <= 3;

  return (
    <div className={`${styles.counter} ${isWarning ? styles.warning : ''}`}>
      <div className={styles.icon}>⏳</div>
      <div className={styles.content}>
        <p className={styles.label}>Período de Prueba</p>
        <p className={styles.days}>
          {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'} restantes
        </p>
      </div>
    </div>
  );
}
