import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import styles from './BirthdayModal.module.css';

export default function BirthdayModal() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!user || !user.date_of_birth) return;

    // Verificar si la sesión ya cerró la tarjeta en el día de hoy
    const dismissedKey = `birthday_dismissed_${user.id}_${new Date().toDateString()}`;
    if (sessionStorage.getItem(dismissedKey)) {
      return;
    }

    try {
      const today = new Date();
      // Formato date_of_birth: 'YYYY-MM-DD' o ISO string
      const dobStr = user.date_of_birth.substring(0, 10);
      const [year, month, day] = dobStr.split('-').map(Number);

      const currentMonth = today.getMonth() + 1; // 1-indexed
      const currentDay = today.getDate();

      if (month === currentMonth && day === currentDay) {
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
            Que pases un día maravilloso, lleno de momentos felices junto a tus seres queridos y pacientes.
            ¡Gracias por formar parte de nuestra comunidad profesional!
          </p>
        </div>

        <button className={styles.closeBtn} onClick={handleClose}>
          ¡Muchas Gracias! 🎉
        </button>
      </div>
    </div>
  );
}
