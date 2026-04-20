import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import styles from './HelpCenterPage.module.css';

export default function HelpCenterPage() {
  const [search, setSearch] = useState('');

  const categories = [
    {
      icon: 'users',
      title: 'Primeros Pasos',
      topics: ['Cómo crear tu cuenta', 'Configuración de perfil', 'Verificación de identidad']
    },
    {
      icon: 'calendar',
      title: 'Gestión de Turnos',
      topics: ['Configurar horarios', 'Bloquear días', 'Reprogramar clientes']
    },
    {
      icon: 'shield',
      title: 'Clientes y Privacidad',
      topics: ['Gestión de historias', 'Protección de datos', 'Consentimiento digital']
    },
    {
      icon: 'list',
      title: 'Suscripciones y Pagos',
      topics: ['Planes disponibles', 'Métodos de pago', 'Facturación']
    }
  ];

  return (
    <div className={styles.container}>
      {/* Header con Búsqueda */}
      <header className={styles.header}>
        <nav className={styles.navbar}>
          <Link to="/login" className={styles.logo}>
            <img src="/logo_turnohub.png" alt="T" />
            <span>TurnoHub Help</span>
          </Link>
          <Link to="/login" className={styles.backLink}>Volver al Login</Link>
        </nav>

        <div className={styles.hero}>
          <h1>¿Cómo podemos ayudarte?</h1>
          <div className={styles.searchBar}>
            <Icon name="search" size={20} color="#94a3b8" />
            <input 
              type="text" 
              placeholder="Busca tutoriales, artículos o guías..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* Categorías Principales */}
      <main className={styles.main}>
        <div className={styles.grid}>
          {categories.map((cat, i) => (
            <div key={i} className={styles.categoryCard}>
              <div className={styles.catHeader}>
                <div className={styles.iconBox}>
                  <Icon name={cat.icon} size={24} color="#2563eb" />
                </div>
                <h3>{cat.title}</h3>
              </div>
              <ul className={styles.topicList}>
                {cat.topics.map((topic, j) => (
                  <li key={j} className={styles.topicItem}>
                    <a href="#topic">{topic}</a>
                  </li>
                ))}
              </ul>
              <button className={styles.viewMore}>Ver todos los artículos</button>
            </div>
          ))}
        </div>

        {/* Sección de Soporte Directo */}
        <section className={styles.supportCta}>
          <div className={styles.ctaIcon}>
            <Icon name="mail" size={32} color="white" />
          </div>
          <div className={styles.ctaText}>
            <h2>¿No encuentras lo que buscas?</h2>
            <p>Nuestro equipo de soporte técnico está disponible para ayudarte en cualquier momento.</p>
          </div>
          <Link to="/support" className={styles.ctaBtn}>Contactar Soporte</Link>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>© 2026 TurnoHub Support System. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
