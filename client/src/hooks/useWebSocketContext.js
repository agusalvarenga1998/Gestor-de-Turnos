import { useContext } from 'react';
import { WebSocketContext } from '../context/WebSocketContext.js';

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);

  if (!context) {
    throw new Error('useWebSocketContext debe ser usado dentro de WebSocketProvider');
  }

  return context;
};
