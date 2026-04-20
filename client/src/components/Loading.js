import React from 'react';
import styles from './Loading.module.css';

export default function Loading() {
  const brand = "TurnoHub".split("");

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div className={styles.spinner}></div>
        <div className={styles.brand}>
          {brand.map((letter, index) => (
            <span 
              key={index} 
              className={styles.letter} 
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {letter}
            </span>
          ))}
        </div>
      </div>
      <p className={styles.subtext}>Preparando todo para vos...</p>
    </div>
  );
}
