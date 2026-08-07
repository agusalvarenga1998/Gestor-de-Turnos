import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import styles from './BirthdayModal.module.css';

export default function BirthdayModal() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!user || !user.date_of_birth) return;

    const today = new Date();
    // Verificar si la sesión ya cerró la tarjeta en el día de hoy
    const dismissedKey = `birthday_dismissed_${user.id}_${today.toDateString()}`;
    if (sessionStorage.getItem(dismissedKey)) {
      return;
    }

    try {
      let dobMonth = null;
      let dobDay = null;

      if (typeof user.date_of_birth === 'string') {
        const cleanStr = user.date_of_birth.substring(0, 10);
        if (cleanStr.includes('-')) {
          const parts = cleanStr.split('-').map(Number);
          if (parts.length === 3 && !isNaN(parts[1]) && !isNaN(parts[2])) {
            dobMonth = parts[1];
            dobDay = parts[2];
          }
        }
      }

      if (!dobMonth || !dobDay) {
        const dobDate = new Date(user.date_of_birth);
        if (!isNaN(dobDate.getTime())) {
          dobMonth = dobDate.getUTCMonth() + 1;
          dobDay = dobDate.getUTCDate();
        }
      }

      const currentMonth = today.getMonth() + 1; // 1-indexed (1..12)
      const currentDay = today.getDate();

      if (dobMonth === currentMonth && dobDay === currentDay) {
        setShowModal(true);
      }
    } catch (err) {
      console.error('Error al verificar fecha de cumpleaños:', err);
    }
  }, [user]);

  const handleClose = () => {
    if (user?.id) {
      const dismissedKey = `birthday_dismissed_${user.id}_${new Date().toDateString()}`;
      sessionStorage.setItem(dismissedKey, 'true');
    }
    setShowModal(false);
  };

  if (!showModal || !user) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modalCard}>
        <div className={styles.headerDecoration}>
          <span className={styles.emojiBalloon}>🎈</span>
          <span className={styles.emojiCake}>🎂</span>
          <span className={styles.emojiSparkles}>✨</span>
        </div>

        <h2 className={styles.title}>¡Feliz Cumpleaños!</h2>
        <h3 className={styles.doctorName}>{user.name}</h3>

        <div className={styles.messageBox}>
          <p>
            ¡En <strong>TurnoHub</strong> te deseamos un excelente cumpleaños! 🥳
          </p>
          <p>
            Que pases un día maravilloso, lleno de momentos felices junto a tus seres queridos.
            ¡Gracias por tu dedicación constante y por formar parte de nuestra comunidad profesional!
          </p>
        </div>

        <button className={styles.closeBtn} onClick={handleClose}>
          ¡Muchas Gracias! 🎉
        </button>
      </div>
    </div>
  );
}
