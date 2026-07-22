import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { useAuth } from '../hooks/useAuth';
import styles from './LandingPage.module.css';

const carouselData = [
  {
    image: '/hero_doctor.png',
  },
  {
    image: '/hero_barber.png',
  },
  {
    image: '/hero_manicurist.png',
  }
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [currentBg, setCurrentBg] = useState(0);
  const [plans, setPlans] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    // Si ya está logueado, llevar al dashboard
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBg(prev => (prev + 1) % carouselData.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fallbackPlans = [
      {
        key: 'commission',
        name: 'Plan Comisión',
        description: 'Ideal para quienes recién comienzan',
        price: '3%',
        price_period: 'turno efectivo',
        features: ['Todas las funcionalidades', 'Pacientes ilimitados', 'Soporte estándar', 'Pagas solo si trabajas'],
        is_popular: false
      },
      {
        key: 'monthly',
        name: 'Plan Mensual',
        description: 'Para profesionales establecidos',
        price: 'Consultar',
        price_period: 'mes fijo',
        features: ['Turnos ilimitados', 'Pacientes ilimitados', 'Sin comisiones extras', 'Soporte prioritario'],
        is_popular: true
      }
    ];

    const fetchPlans = async () => {
      try {
        const baseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
        const res = await fetch(`${baseUrl}/api/admin/public/plans`);
        const data = await res.json();
        if (data.success && data.plans && data.plans.length > 0) {
          const sorted = [...data.plans].sort((a, b) => (b.is_popular ? 1 : 0) - (a.is_popular ? 1 : 0));
          setPlans(sorted);
        } else {
          const sortedFallback = [...fallbackPlans].sort((a, b) => (b.is_popular ? 1 : 0) - (a.is_popular ? 1 : 0));
          setPlans(sortedFallback);
        }
      } catch (err) {
        console.error('Error fetching dynamic plans, using fallback:', err);
        const sortedFallback = [...fallbackPlans].sort((a, b) => (b.is_popular ? 1 : 0) - (a.is_popular ? 1 : 0));
        setPlans(sortedFallback);
      }
    };
    fetchPlans();
  }, []);

  return (
    <div className={styles.container}>
      {/* Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navContent}>
          <Link to="/" className={styles.logo}>
            <span className={`material-symbols-outlined ${styles.logoIcon}`}>hub</span>
            <span>TurnoHub</span>
          </Link>
          
          <div className={`${styles.navLinks} ${isMenuOpen ? styles.navActive : ''}`}>
            <Link to="/patient" className={styles.navLink} onClick={() => setIsMenuOpen(false)}>Soy Paciente</Link>
            <Link to="/login" className={styles.navLink} onClick={() => setIsMenuOpen(false)}>Acceso Profesional</Link>
            <Link to="/admin/login" className={styles.navLink} onClick={() => setIsMenuOpen(false)}>Administración</Link>
            <Link to="/register" className={styles.primaryBtn} onClick={() => setIsMenuOpen(false)}>Prueba Gratis</Link>
          </div>
          
          <button className={styles.mobileMenuBtn} onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <Icon name={isMenuOpen ? "x" : "menu"} size={24} />
          </button>
        </div>
      </nav>

      {/* Hero / Banner principal */}
      <header 
        className={styles.hero}
        style={{ backgroundImage: `url('${carouselData[currentBg].image}')` }}
      >
        <div className={styles.heroOverlay}></div>
        <div className={styles.heroContent}>
          <span className={styles.badge}>GESTIÓN DE TURNOS PROFESIONAL</span>
          <h1>Impulsa tu negocio y agenda <br /><span>sin interrupciones</span></h1>
          <p>La plataforma definitiva para médicos, esteticistas, barberos y profesionales independientes. Automatiza tu agenda, sincroniza con Google Calendar y potencia tu rentabilidad.</p>
          
          <div className={styles.ctaGroup}>
            <Link to="/register" className={styles.heroPrimaryBtn}>
              Comenzar prueba gratis
              <Icon name="arrowRight" size={20} />
            </Link>
            <a href="#planes" className={styles.heroSecondaryBtn}>
              Ver Planes de Precios
            </a>
          </div>
          
          <div className={styles.trustBadges}>
            <span className={styles.badgeItem}>
              <Icon name="check" size={16} color="#10b981" />
              15 días de prueba <strong>gratis</strong>
            </span>
            <span className={styles.badgeItem}>
              <Icon name="check" size={16} color="#10b981" />
              Sin tarjeta de crédito
            </span>
            <span className={styles.badgeItem}>
              <Icon name="check" size={16} color="#10b981" />
              Configura en 2 min
            </span>
          </div>
        </div>
      </header>

      {/* Info Cards / Features */}
      <section id="caracteristicas" className={styles.features}>
        <div className={styles.sectionHeader}>
          <h2>Todo lo que necesitas en un solo lugar</h2>
          <p>Herramientas diseñadas exclusivamente para optimizar la gestión de tu consultorio o centro de estética.</p>
        </div>
        
        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.iconBox}>
              <Icon name="calendar" size={32} />
            </div>
            <h3>Agenda Inteligente 24/7</h3>
            <p>Permite que tus clientes y pacientes agenden citas a cualquier hora del día desde su celular, evitando llamadas fuera de horario.</p>
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
          {plans.map((plan) => (
            <div 
              key={plan.key} 
              className={`${styles.pricingCard} ${plan.is_popular ? styles.popular : ''}`}
            >
              {plan.is_popular && <span className={styles.popularBadge}>MÁS ELEGIDO</span>}
              <div className={styles.pricingIcon}>
                <Icon name={plan.key === 'commission' ? 'percent' : 'calendar'} size={28} />
              </div>
              <h3 className={styles.pricingTitle}>{plan.name}</h3>
              <p className={styles.pricingDesc}>{plan.description}</p>
              <div className={styles.pricingPrice}>
                {plan.price} <span>/ {plan.price_period}</span>
              </div>
              <ul className={styles.pricingFeatures}>
                {(plan.features || []).map((feat, index) => (
                  <li key={index}>
                    <Icon name="check" size={20} className={styles.checkIcon} /> {feat}
                  </li>
                ))}
              </ul>
              <Link 
                to="/register" 
                className={`${styles.pricingBtn} ${plan.is_popular ? styles.pricingBtnPrimary : styles.pricingBtnOutline}`}
              >
                Empezar prueba gratis
              </Link>
            </div>
          ))}
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
              <span className={`material-symbols-outlined ${styles.logoIcon}`}>hub</span>
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
