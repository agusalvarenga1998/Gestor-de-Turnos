import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import styles from './WhyTurnoHubPage.module.css';

export default function WhyTurnoHubPage() {
  const features = [
    {
      icon: 'calendar',
      title: 'Gestión Inteligente',
      desc: 'Organiza tus turnos con una interfaz intuitiva que se adapta a tu ritmo de trabajo.'
    },
    {
      icon: 'users',
      title: 'Portal de Clientes',
      desc: 'Tus clientes pueden ver sus turnos, recibir recordatorios y cancelar con un clic.'
    },
    {
      icon: 'shield',
      title: 'Seguridad de Datos',
      desc: 'Encriptación de punta a punta para que la información de tus clientes esté siempre segura.'
    },
    {
      icon: 'mail',
      title: 'Notificaciones Automáticas',
      desc: 'Envío automático de correos para confirmación y recordatorio de citas.'
    },
    {
      icon: 'list',
      title: 'Historial / Info',
      desc: 'Accede rápidamente a la información relevante de cada cliente antes de la cita.'
    },
    {
      icon: 'lock',
      title: 'Control total',
      desc: 'Tú decides tus horarios, prepagas aceptadas y márgenes de cancelación.'
    }
  ];

  return (
    <div className={styles.container}>
      {/* Mini Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navContent}>
          <Link to="/login" className={styles.logo}>
            <img src="/logo_turnohub.png" alt="T" />
            <span>TurnoHub</span>
          </Link>
          <Link to="/login" className={styles.backBtn}>Volver al Login</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.badge}>MÁS QUE UN GESTOR DE TURNOS</span>
          <h1>Lleva tu consultorio <br /><span>al siguiente nivel</span></h1>
          <p>TurnoHub es la herramienta definitiva para profesionales que buscan eficiencia, orden y una mejor experiencia para sus clientes.</p>
          <div className={styles.ctaGroup}>
            <Link to="/register" className={styles.primaryBtn}>Empezar ahora gratis</Link>
            <a href="#features" className={styles.secondaryBtn}>Ver características</a>
          </div>
        </div>
      </header>

      {/* Features Grid */}
      <section id="features" className={styles.featuresSection}>
        <div className={styles.sectionHeader}>
          <h2>Todo lo que necesitas en un solo lugar</h2>
          <p>Diseñado por profesionales para profesionales. Simplicidad y potencia sin compromisos.</p>
        </div>
        
        <div className={styles.grid}>
          {features.map((f, i) => (
            <div key={i} className={styles.card}>
              <div className={styles.iconBox}>
                <Icon name={f.icon} size={24} color="#2563eb" />
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust Section */}
      <section className={styles.trustSection}>
        <div className={styles.trustContent}>
          <h2>Únete a la comunidad TurnoHub</h2>
          <p>Cientos de profesionales ya transformaron su forma de trabajar. Únete hoy y recupera el control de tu tiempo.</p>
          <Link to="/register" className={styles.finalCta}>Crear mi cuenta profesional</Link>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>© 2026 TurnoHub Portal. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
