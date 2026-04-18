import React, { useEffect, useState } from 'react';
import styles from './SplashLoader.module.css';

const SplashLoader = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Iniciar fade out un poco antes de terminar
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 2500);

    const completeTimer = setTimeout(() => {
      setIsVisible(false);
      if (onComplete) onComplete();
    }, 3000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  if (!isVisible) return null;

  return (
    <div className={`${styles.splashContainer} ${isFadingOut ? styles.fadeOut : ''}`}>
      <div className={styles.content}>
        <div className={styles.logoWrapper}>
          <h1 className={styles.logoText}>
            <span>T</span><span>u</span><span>r</span><span>n</span><span>o</span>
            <span className={styles.highlight}>H</span><span>u</span><span>b</span>
          </h1>
          <div className={styles.underline}></div>
        </div>
        <p className={styles.subtitle}>Gestión inteligente de turnos</p>
      </div>
    </div>
  );
};

export default SplashLoader;
