import React from 'react';
import { useWebSocketContext } from '../hooks/useWebSocketContext.js';
import styles from './WebSocketStatus.module.css';

export default function WebSocketStatus() {
  const { isConnected, wsState, error } = useWebSocketContext();

  if (error) {
    return (
      <div className={`${styles.status} ${styles.error}`}>
        <span className={styles.indicator}>●</span>
        <span className={styles.text}>Error WebSocket: {error}</span>
      </div>
    );
  }

  const statusClass = isConnected ? styles.connected : styles.disconnected;
  const statusText = isConnected ? 'Conectado' : 'Desconectado';

  return (
    <div className={`${styles.status} ${statusClass}`}>
      <span className={styles.indicator}>●</span>
      <span className={styles.text}>{statusText}</span>
    </div>
  );
}
