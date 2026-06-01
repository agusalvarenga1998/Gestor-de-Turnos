import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { useAuth } from '../hooks/useAuth';
import styles from './LandingPage.module.css';

const carouselData = [
  {
    image: '/hero_dashboard.png',
  },
  {
    image: '/patient_booking.png',
  }
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [currentBg, setCurrentBg] = useState(0);

  useEffect(() => {
    // Si ya está logueado, llevar al dashboard
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBg(prev => (prev + 1) % carouselData.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.container}>
      {/* Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navContent}>
          <Link to="/" className={styles.logo}>
            <img src="/logo_turnohub.png" alt="T" />
            <span>TurnoHub</span>
          </Link>
          
          <div className={styles.navLinks}>
            <Link to="/patient" className={styles.navLink}>Soy Paciente</Link>
            <Link to="/login" className={styles.navLink}>Acceso Profesional</Link>
            <Link to="/admin/login" className={styles.navLink}>Administración</Link>
            <Link to="/register" className={styles.primaryBtn}>Prueba Gratis</Link>
          </div>
          
          <button className={styles.mobileMenuBtn}>
            <Icon name="menu" size={24} />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header 
        className={styles.hero}
        style={{ backgroundImage: `url('${carouselData[currentBg].image}')` }}
      >
        <div className={styles.heroOverlay}></div>
        <div className={styles.heroContent}>
          <span className={styles.badge}>MÁS QUE UN GESTOR DE TURNOS</span>
          <h1>
            Moderniza tu consultorio y <br />
            <span>recupera tu tiempo</span>
          </h1>
          <p>
            TurnoHub es la plataforma integral para profesionales de la salud y estética. 
            Gestiona turnos, historias clínicas, y ofrece a tus pacientes un portal 
            de reservas 24/7 sin complicaciones.
          </p>
          <div className={styles.ctaGroup}>
            <Link to="/register" className={styles.heroPrimaryBtn}>
              Comenzar prueba gratis
            </Link>
            <a href="#planes" className={styles.heroSecondaryBtn}>
              Ver planes
            </a>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section id="caracteristicas" className={styles.features}>
        <div className={styles.sectionHeader}>
          <h2>Todo lo que necesitas en un solo lugar</h2>
          <p>Diseñado para que te enfoques en tus pacientes, nosotros nos encargamos del resto.</p>
        </div>
        
        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.iconBox}>
              <Icon name="calendar" size={32} />
            </div>
            <h3>Agenda Inteligente</h3>
            <p>Sincronización automática con Google Calendar. Evita solapamientos y gestiona tus horarios con total libertad y facilidad.</p>
          </div>
          <div className={styles.card}>
            <div className={styles.iconBox}>
              <Icon name="users" size={32} />
            </div>
            <h3>Portal para Pacientes</h3>
            <p>Tus clientes pueden agendar, modificar o cancelar sus citas de manera autónoma las 24 horas del día, los 7 días de la semana.</p>
          </div>
          <div className={styles.card}>
            <div className={styles.iconBox}>
              <Icon name="list" size={32} />
            </div>
            <h3>Historia Clínica Única</h3>
            <p>Centraliza los datos, alergias, antecedentes y estudios de cada paciente de forma segura y accesible desde cualquier dispositivo.</p>
          </div>
          <div className={styles.card}>
            <div className={styles.iconBox}>
              <Icon name="mail" size={32} />
            </div>
            <h3>Recordatorios Automáticos</h3>
            <p>Reduce drásticamente el ausentismo mediante notificaciones automáticas vía email previas a la cita programada.</p>
          </div>
        </div>
      </section>

      {/* Trust / Visual Section */}
      <section className={styles.visualSection}>
        <div className={styles.visualImageContainer}>
          <img src="/patient_booking.png" alt="Paciente agendando desde su teléfono" className={styles.visualImage} />
        </div>
        <div className={styles.visualText}>
          <h2>La experiencia que tus pacientes esperan</h2>
          <p>Ofrece una experiencia de agendamiento fluida, moderna y 100% digital. Tus pacientes podrán reservar sus turnos desde la comodidad de su hogar en cualquier momento.</p>
          <ul className={styles.visualList}>
            <li><Icon name="check" size={20} color="#10b981" /> Reservas 24/7 sin llamadas</li>
            <li><Icon name="check" size={20} color="#10b981" /> Recordatorios por email</li>
            <li><Icon name="check" size={20} color="#10b981" /> Reprogramación simple</li>
          </ul>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planes" className={styles.pricing}>
        <div className={styles.sectionHeader}>
          <h2>Planes Simples y Transparentes</h2>
          <p>Elige la opción que mejor se adapte a tu volumen de trabajo. Todos los planes incluyen 15 días de prueba sin cargo.</p>
        </div>
        
        <div className={styles.pricingGrid}>
          {/* Plan Comisión */}
          <div className={styles.pricingCard}>
            <div className={styles.pricingIcon}>
              <Icon name="percent" size={28} />
            </div>
            <h3 className={styles.pricingTitle}>Plan Comisión</h3>
            <p className={styles.pricingDesc}>Ideal para quienes recién comienzan</p>
            <div className={styles.pricingPrice}>
              3% <span>/ turno efectivo</span>
            </div>
            <ul className={styles.pricingFeatures}>
              <li><Icon name="check" size={20} className={styles.checkIcon} /> Todas las funcionalidades</li>
              <li><Icon name="check" size={20} className={styles.checkIcon} /> Pacientes ilimitados</li>
              <li><Icon name="check" size={20} className={styles.checkIcon} /> Soporte estándar</li>
              <li><Icon name="check" size={20} className={styles.checkIcon} /> Pagas solo si trabajas</li>
            </ul>
            <Link to="/register" className={`${styles.pricingBtn} ${styles.outline}`}>
              Empezar prueba gratis
            </Link>
          </div>

          {/* Plan Mensualidad */}
          <div className={`${styles.pricingCard} ${styles.popular}`}>
            <span className={styles.popularBadge}>MÁS ELEGIDO</span>
            <div className={styles.pricingIcon}>
              <Icon name="calendar" size={28} />
            </div>
            <h3 className={styles.pricingTitle}>Plan Mensual</h3>
            <p className={styles.pricingDesc}>Para profesionales establecidos</p>
            <div className={styles.pricingPrice}>
              Consultar <span>/ mes fijo</span>
            </div>
            <ul className={styles.pricingFeatures}>
              <li><Icon name="check" size={20} className={styles.checkIcon} /> Turnos ilimitados</li>
              <li><Icon name="check" size={20} className={styles.checkIcon} /> Pacientes ilimitados</li>
              <li><Icon name="check" size={20} className={styles.checkIcon} /> Sin comisiones extras</li>
              <li><Icon name="check" size={20} className={styles.checkIcon} /> Soporte prioritario</li>
            </ul>
            <Link to="/register" className={`${styles.pricingBtn} ${styles.primary}`}>
              Empezar prueba gratis
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.trust}>
        <div className={styles.trustContent}>
          <h2>¿Listo para transformar tu consultorio?</h2>
          <p>Únete a la comunidad de profesionales que ya han modernizado su forma de trabajar con TurnoHub.</p>
          <Link to="/register" className={styles.trustBtn}>
            Crea tu cuenta ahora
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerBrand}>
            <Link to="/" className={styles.logo}>
              <img src="/logo_turnohub.png" alt="T" />
              <span>TurnoHub</span>
            </Link>
            <p>La plataforma moderna para gestionar tus turnos médicos y estéticos con eficiencia y seguridad.</p>
          </div>
          
          <div className={styles.footerCol}>
            <h4>Plataforma</h4>
            <ul>
              <li><Link to="/login">Acceso Profesional</Link></li>
              <li><Link to="/patient">Portal de Pacientes</Link></li>
              <li><a href="#planes">Precios y Planes</a></li>
              <li><Link to="/register">Prueba Gratis</Link></li>
            </ul>
          </div>
          
          <div className={styles.footerCol}>
            <h4>Soporte</h4>
            <ul>
              <li><Link to="/help-center">Centro de Ayuda</Link></li>
              <li><a href="mailto:soporte@turnohub.com.ar">soporte@turnohub.com.ar</a></li>
              <li><Link to="/admin/login">Administración</Link></li>
            </ul>
          </div>
        </div>
        
        <div className={styles.footerBottom}>
          <p>© 2026 TurnoHub. Todos los derechos reservados.</p>
          <div className={styles.legalLinks}>
            <Link to="/privacy">Política de Privacidad</Link>
            <Link to="/terms">Términos de Servicio</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
