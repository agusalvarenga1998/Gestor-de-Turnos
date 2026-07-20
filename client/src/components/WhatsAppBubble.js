import React from 'react';
import { useLocation } from 'react-router-dom';
import styles from './WhatsAppBubble.module.css';

export default function WhatsAppBubble() {
  const location = useLocation();
  const path = location.pathname;

  // Excluir el portal del paciente y el panel de administración
  if (
    path.startsWith('/patient') || 
    path.startsWith('/appointment') || 
    path.startsWith('/admin')
  ) {
    return null;
  }

  const phoneNumber = '5493765409032';
  const message = encodeURIComponent('Hola TurnoHub, tengo una consulta sobre la plataforma.');
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;

  return (
    <a
      href={whatsappUrl}
      className={styles.whatsappBubble}
      target="_blank"
      rel="noopener noreferrer"
      title="Contactar por WhatsApp"
    >
      <div className={styles.tooltip}>¿Necesitas ayuda?</div>
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
        alt="WhatsApp"
        className={styles.whatsappIcon}
      />
    </a>
  );
}
