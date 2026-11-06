import React from 'react';
import { Link } from 'react-router-dom';
import styles from '../pages/ReceptionPage.module.css';

export default function SettingsNavigation({ activeTab, onSelect }) {
  const groups = [
    { name: 'Consultorio', buttons: [['profile', 'Perfil y dirección']], links: [['/services', 'Servicios y precios'], ['/insurance', 'Convenios'], ['/team', 'Equipo y recepción']] },
    { name: 'Agenda', buttons: [['google', 'Google Calendar']], links: [['/working-hours', 'Horarios y vacaciones'], ['/operations?tab=waitlist', 'Lista de espera']] },
    { name: 'Cobros', buttons: [['mercadopago', 'Cuenta de Mercado Pago']], links: [['/movements', 'Caja'], ['/operations?tab=payments', 'Conciliar pagos']] },
    { name: 'Notificaciones', buttons: [['push', 'Avisos en el celular']], links: [['/notifications', 'Preferencias'], ['/operations?tab=notifications', 'Seguimiento de correos']] },
    { name: 'Plan', buttons: [['subscription', 'Plan y renovación']], links: [] },
    { name: 'Seguridad', buttons: [['security', 'Sesiones y datos'], ['onboarding', 'Guía de inicio']], links: [] }
  ];
  return <nav className={styles.card} aria-label="Secciones de configuración" style={{ alignSelf: 'start' }}>
    {groups.map(group => <section key={group.name}><h3>{group.name}</h3><div style={{ display: 'grid', gap: 8 }}>{group.buttons.map(([tab, label]) => <button type="button" aria-pressed={activeTab === tab} key={tab} onClick={() => onSelect(tab)}>{label}</button>)}{group.links.map(([url, label]) => <Link key={url} to={url}>{label}</Link>)}</div></section>)}
  </nav>;
}
