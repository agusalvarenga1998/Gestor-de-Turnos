import React from 'react';
import { useTheme } from '../context/ThemeContext';
import Icon from './Icon';
import styles from './ThemeToggle.module.css';

export default function ThemeToggle({ floating = false, showLabel = false, className = '' }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      className={`${styles.toggleBtn} ${floating ? styles.floatingBtn : ''} ${className}`}
      onClick={toggleTheme}
      title={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
      aria-label="Cambiar tema"
    >
      <div className={styles.toggleIconWrapper}>
        {isDark ? (
          <Icon name="sun" size={floating ? 22 : 18} color="#f59e0b" />
        ) : (
          <Icon name="moon" size={floating ? 22 : 18} color="#6366f1" />
        )}
      </div>
      {showLabel && !floating && (
        <span className={styles.labelText}>
          {isDark ? 'Modo Claro' : 'Modo Oscuro'}
        </span>
      )}
    </button>
  );
}
