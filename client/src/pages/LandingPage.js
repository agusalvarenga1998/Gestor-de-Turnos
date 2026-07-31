import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import ThemeToggle from '../components/ThemeToggle';
import styles from './LandingPage.module.css';

const rubrosData = [
  {
    id: 'medicina',
    label: 'Salud & Médicos',
    icon: 'stethoscope',
    badge: 'Historial Clínico Integrado',
    title: 'Gestión médica integral y turnos de consultorio',
    description: 'Centraliza las fichas de tus pacientes, registros de evolución, orden de atención y recepción con fila virtual en tiempo real.',
    features: [
      'Historia clínica digital por paciente',
      'Fila virtual en sala de espera',
      'Sincronización bidireccional con Google Calendar',
      'Notificaciones y avisos automáticos'
    ],
    highlightText: 'Fila virtual activa • 4 pacientes aguardando'
  },
  {
    id: 'odontologia',
    label: 'Odontología',
    icon: 'smile',
    badge: 'Odontograma Digital',
    title: 'Control gráfico de tratamientos y piezas dentales',
    description: 'Lleva el control de cada pieza dental con un odontograma visual interactivo, registro de prestaciones y liquidación de señas.',
    features: [
      'Odontograma digital en pantalla',
      'Planes de tratamiento y presupuestos',
      'Cobro anticipado de señas con Mercado Pago',
      'Recordatorio de turnos para limpieza y control'
    ],
    highlightText: 'Odontograma digital actualizado • Mercado Pago vinculado'
  },
  {
    id: 'estetica',
    label: 'Estética & Spa',
    icon: 'sparkles',
    badge: 'Cobro de Señas Antiacusentismo',
    title: 'Reserva de gabinetes, servicios y señas online',
    description: 'Evita espacios vacíos cobrando una seña por Mercado Pago al momento de reservar. Organiza profesionales y aparatología.',
    features: [
      'Cobro de señas automático por Mercado Pago',
      'Catálogo visual de tratamientos',
      'Gestión de gabinetes y equipamiento',
      'Link de reserva directa para Instagram y WhatsApp'
    ],
    highlightText: 'Señas del 50% acreditadas al instante'
  },
  {
    id: 'barberia',
    label: 'Barberías & Salones',
    icon: 'scissors',
    badge: 'Multi-Profesional 24/7',
    title: 'Agendamiento por barbero y sillón sin llamadas',
    description: 'Permite que tus clientes elijan a su profesional preferido y el horario que más les convenga desde su celular.',
    features: [
      'Agenda individual por sillón o barbero',
      'App móvil instalable sin descargas en App Store',
      'Notificaciones automáticas antes de cada corte',
      'Sincronización con calendario en el smartphone'
    ],
    highlightText: 'App Móvil PWA activa en Android & iOS'
  },
  {
    id: 'kinesiologia',
    label: 'Kinesiología & Salud',
    icon: 'activity',
    badge: 'Control de Sesiones',
    title: 'Planificación de sesiones y seguimiento corporal',
    description: 'Registra la evolución de tratamientos kinesiologicos, fisioterapia y entrenamientos personalizados en cada sesión.',
    features: [
      'Seguimiento por paquetes de sesiones',
      'Reporte de asistencia y ausentismo',
      'Ficha de evaluación y notas de evolución',
      'Confirmaciones instantáneas por WhatsApp'
    ],
    highlightText: 'Sincronizado con Google Calendar'
  }
];

const faqs = [
  {
    q: '¿Cómo funciona la sincronización con Google Calendar?',
    a: 'TurnoHub se conecta en dos vías con tu cuenta de Google. Cada turno agendado en la plataforma se refleja inmediatamente en tu Google Calendar. Además, si agendas una cita personal en tu Google Calendar, TurnoHub bloqueará automáticamente ese horario para evitar solapamientos.'
  },
  {
    q: '¿Cómo cobro señas o turnos con Mercado Pago?',
    a: 'Vinculas tu cuenta de Mercado Pago en solo 2 clics desde la configuración. Puedes exigir una seña (monto fijo o porcentaje) al momento de reservar. El paciente abona con tarjeta, débito o dinero en cuenta y el importe va directo a tu Mercado Pago.'
  },
  {
    q: '¿En qué consiste la Fila Virtual en tiempo real?',
    a: 'Es una pantalla dinámica para el profesional y para el paciente. Los pacientes que están en la sala de espera (o aproximándose) escanean un QR o ingresan a un link y ven su posición exacta en la fila, reduciendo las dudas y la impaciencia.'
  },
  {
    q: '¿Los pacientes tienen que descargar alguna app pesada?',
    a: 'No. El portal para pacientes y la app para profesionales son Progressive Web Apps (PWA). Funcionan directamente en cualquier navegador web o se pueden instalar con 1 clic en la pantalla de inicio del teléfono sin ocupar memoria.'
  },
  {
    q: '¿Puedo probar el sistema gratis?',
    a: '¡Sí! Tienes 30 días de prueba gratuita completa con todas las funcionalidades habilitadas, sin necesidad de ingresar ninguna tarjeta de crédito.'
  }
];

const heroBackgrounds = [
  '/hero_doctor.png',
  '/hero_barber.png',
  '/hero_manicurist.png',
  '/hero_dashboard.png'
];

export default function LandingPage() {
  const [plans, setPlans] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeRubro, setActiveRubro] = useState(rubrosData[0]);
  const [openFaq, setOpenFaq] = useState(null);
  const [currentBg, setCurrentBg] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBg(prev => (prev + 1) % heroBackgrounds.length);
    }, 5500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fallbackPlans = [
      {
        key: 'commission',
        name: 'Plan Comisión',
        description: 'Ideal para profesionales independientes o que recién comienzan',
        price: '3%',
        price_period: 'por turno asistido',
        features: [
          'Todas las funcionalidades desbloqueadas',
          'Sincronización con Google Calendar',
          'Cobro de señas por Mercado Pago',
          'Fila virtual en tiempo real',
          'Portal autónomo para pacientes 24/7',
          'Sin costos fijos: pagas si trabajas'
        ],
        is_popular: false
      },
      {
        key: 'monthly',
        name: 'Plan Mensual Fijo',
        description: 'Para consultorios, centros de estética y equipos establecidos',
        price: 'Fijo',
        price_period: 'mensual sin comisiones',
        features: [
          'Turnos y pacientes ilimitados',
          'Sincronización con Google Calendar 2-Way',
          'Integración total con Mercado Pago',
          'Fila virtual multi-pantalla',
          'Notificaciones automáticas',
          'Soporte técnico prioritario 24/7'
        ],
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
          setPlans(fallbackPlans);
        }
      } catch (err) {
        setPlans(fallbackPlans);
      }
    };
    fetchPlans();
  }, []);

  return (
    <div className={styles.container}>
      {/* Dynamic Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navContent}>
          <Link to="/" className={styles.logo}>
            <div className={styles.logoIconBg}>
              <span className="material-symbols-outlined">hub</span>
            </div>
            <span className={styles.logoText}>Turno<span className={styles.logoAccent}>Hub</span></span>
          </Link>
          
          <div className={`${styles.navLinks} ${isMenuOpen ? styles.navActive : ''}`}>
            <a href="#caracteristicas" className={styles.navLink} onClick={() => setIsMenuOpen(false)}>Funcionalidades</a>
            <a href="#rubros" className={styles.navLink} onClick={() => setIsMenuOpen(false)}>Rubros</a>
            <a href="#fila-virtual" className={styles.navLink} onClick={() => setIsMenuOpen(false)}>Fila Virtual</a>
            <a href="#planes" className={styles.navLink} onClick={() => setIsMenuOpen(false)}>Planes</a>
            <Link to="/patient" className={styles.navLinkHighlight} onClick={() => setIsMenuOpen(false)}>
              <Icon name="users" size={18} />
              Soy Paciente
            </Link>
            <Link to="/login" className={styles.navLink} onClick={() => setIsMenuOpen(false)}>Acceso Profesional</Link>
            <ThemeToggle showLabel />
            <Link to="/register" className={styles.primaryBtn} onClick={() => setIsMenuOpen(false)}>
              <Icon name="sparkles" size={18} />
              Prueba Gratis
            </Link>
          </div>
          
          <button className={styles.mobileMenuBtn} onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Menú">
            <Icon name={isMenuOpen ? "x" : "menu"} size={26} color="#0f172a" />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className={styles.hero}>
        <div 
          className={styles.heroBgImage} 
          style={{ backgroundImage: `url('${heroBackgrounds[currentBg]}')` }}
        />
        <div className={styles.heroOverlay}></div>
        <div className={styles.heroGlowLeft}></div>
        <div className={styles.heroGlowRight}></div>
        
        <div className={styles.heroContentGrid}>
          <div className={styles.heroText}>
            <div className={styles.pillBadge}>
              <span className={styles.pillDot}></span>
              <Icon name="zap" size={16} color="#60a5fa" />
              <span>PLATAFORMA DE GESTIÓN DE TURNOS TODO EN UNO</span>
            </div>
            
            <h1 className={styles.heroTitle}>
              Impulsa tu agenda con <br />
              <span className={styles.gradientText}>Google Calendar, Mercado Pago</span> <br />
              y Fila Virtual en tiempo real
            </h1>
            
            <p className={styles.heroSub}>
              La solución definitiva para profesionales y centros de salud, estética o servicios.
              Automatiza tus cobros de señas, permite que tus pacientes reserven 24/7 y elimina ausencias.
            </p>

            <div className={styles.ctaGroup}>
              <Link to="/register" className={styles.heroPrimaryBtn}>
                <span>Comenzar prueba gratis</span>
                <Icon name="arrowRight" size={20} />
              </Link>
              <a href="#fila-virtual" className={styles.heroSecondaryBtn}>
                <Icon name="clock" size={20} color="#38bdf8" />
                <span>Ver Fila Virtual en vivo</span>
              </a>
            </div>

            <div className={styles.trustRow}>
              <div className={styles.trustBadge}>
                <Icon name="check" size={16} color="#10b981" />
                <span>30 días de prueba <strong>sin costo</strong></span>
              </div>
              <div className={styles.trustBadge}>
                <Icon name="check" size={16} color="#10b981" />
                <span>Sin tarjeta de crédito</span>
              </div>
              <div className={styles.trustBadge}>
                <Icon name="check" size={16} color="#10b981" />
                <span>Configuración en 2 minutos</span>
              </div>
            </div>
          </div>

          {/* Interactive Live Hero Showcase Widget */}
          <div className={styles.heroWidgetContainer}>
            <div className={styles.heroCardGlass}>
              <div className={styles.widgetHeader}>
                <div className={styles.widgetDots}>
                  <span className={styles.dotRed}></span>
                  <span className={styles.dotYellow}></span>
                  <span className={styles.dotGreen}></span>
                </div>
                <span className={styles.widgetTitle}>Panel en Vivo TurnoHub</span>
                <span className={styles.liveTag}>LIVE</span>
              </div>

              <div className={styles.widgetBody}>
                {/* Feature Chip 1: Google Calendar */}
                <div className={styles.featureChip}>
                  <div className={`${styles.chipIcon} ${styles.chipCalendar}`}>
                    <Icon name="calendar" size={20} color="#3b82f6" />
                  </div>
                  <div className={styles.chipText}>
                    <strong>Google Calendar Sincronizado</strong>
                    <span>Actualización bidireccional inmediata</span>
                  </div>
                  <span className={styles.chipBadgeSuccess}>Sincronizado</span>
                </div>

                {/* Feature Chip 2: Mercado Pago */}
                <div className={styles.featureChip}>
                  <div className={`${styles.chipIcon} ${styles.chipPayment}`}>
                    <Icon name="creditCard" size={20} color="#10b981" />
                  </div>
                  <div className={styles.chipText}>
                    <strong>Seña por Mercado Pago</strong>
                    <span>Reserva confirmada con seña de $5.000</span>
                  </div>
                  <span className={styles.chipBadgeAmount}>+$5,000</span>
                </div>

                {/* Feature Chip 3: Live Queue Tracker */}
                <div className={styles.featureChip}>
                  <div className={`${styles.chipIcon} ${styles.chipQueue}`}>
                    <Icon name="clock" size={20} color="#f59e0b" />
                  </div>
                  <div className={styles.chipText}>
                    <strong>Fila Virtual en Tiempo Real</strong>
                    <span>Turno #04 en atención • Espera: ~5 min</span>
                  </div>
                  <span className={styles.chipBadgeLive}>En Llamado</span>
                </div>

                {/* Feature Chip 4: Whatsapp / Email Notification */}
                <div className={styles.featureChip}>
                  <div className={`${styles.chipIcon} ${styles.chipNotify}`}>
                    <Icon name="whatsapp" size={20} color="#25d366" />
                  </div>
                  <div className={styles.chipText}>
                    <strong>Recordatorio Automático Enviado</strong>
                    <span>WhatsApp previo 2 hs antes del turno</span>
                  </div>
                  <Icon name="check" size={18} color="#10b981" />
                </div>
              </div>

              <div className={styles.widgetFooter}>
                <div className={styles.widgetMetric}>
                  <span className={styles.metricVal}>99.4%</span>
                  <span className={styles.metricLabel}>Asistencia</span>
                </div>
                <div className={styles.widgetMetricDivider}></div>
                <div className={styles.widgetMetric}>
                  <span className={styles.metricVal}>24/7</span>
                  <span className={styles.metricLabel}>Autoreserva</span>
                </div>
                <div className={styles.widgetMetricDivider}></div>
                <div className={styles.widgetMetric}>
                  <span className={styles.metricVal}>0 min</span>
                  <span className={styles.metricLabel}>Solapamiento</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Highlights Section / Bento Grid */}
      <section id="caracteristicas" className={styles.featuresSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.subHeaderBadge}>FUNCIONALIDADES DESTACADAS</span>
          <h2>Todo lo que tu agenda necesita para funcionar sola</h2>
          <p>Potencia la productividad de tu consultorio o centro con automatizaciones de vanguardia.</p>
        </div>

        <div className={styles.bentoGrid}>
          {/* Card 1: Google Calendar */}
          <div className={`${styles.bentoCard} ${styles.bentoCardLarge}`}>
            <div className={styles.bentoIconWrapper}>
              <Icon name="calendar" size={32} color="#2563eb" />
            </div>
            <span className={styles.bentoTag}>CONEXIÓN DIRECTA</span>
            <h3>Sincronización 2-Way con Google Calendar</h3>
            <p>
              Conecta tu agenda personal y profesional. Si agregas un compromiso en tu Google Calendar, TurnoHub bloqueará ese espacio automáticamente para que ningún paciente reserve encima.
            </p>
            <div className={styles.bentoPreviewMock}>
              <div className={styles.gCalRow}>
                <Icon name="check" size={18} color="#10b981" />
                <span>Turnos sincronizados en ambas direcciones</span>
              </div>
              <div className={styles.gCalRow}>
                <Icon name="check" size={18} color="#10b981" />
                <span>Sin descargas extras ni configuraciones complejas</span>
              </div>
            </div>
          </div>

          {/* Card 2: Mercado Pago */}
          <div className={styles.bentoCard}>
            <div className={styles.bentoIconWrapper}>
              <Icon name="creditCard" size={32} color="#10b981" />
            </div>
            <span className={styles.bentoTagGreen}>PAGOS EN LÍNEA</span>
            <h3>Señas por Mercado Pago</h3>
            <p>
              Reduce el ausentismo a 0%. Exige una seña previa para confirmar el turno y recibe el dinero directo en tu cuenta.
            </p>
          </div>

          {/* Card 3: Fila Virtual */}
          <div className={styles.bentoCard}>
            <div className={styles.bentoIconWrapper}>
              <Icon name="clock" size={32} color="#f59e0b" />
            </div>
            <span className={styles.bentoTagOrange}>TIEMPO REAL</span>
            <h3>Fila Virtual para Pacientes</h3>
            <p>
              Tus clientes siguen su posición en la cola desde el teléfono y saben exactamente cuándo ingresar.
            </p>
          </div>

          {/* Card 4: Patients Self Booking 24/7 */}
          <div className={styles.bentoCard}>
            <div className={styles.bentoIconWrapper}>
              <Icon name="users" size={32} color="#8b5cf6" />
            </div>
            <span className={styles.bentoTagPurple}>AUTONOMÍA TOTAL</span>
            <h3>Portal de Pacientes 24/7</h3>
            <p>
              Tus pacientes pueden agendar, modificar o cancelar sus citas en cualquier horario mediante un link personalizado con tu marca.
            </p>
          </div>

          {/* Card 5: Automated Notifications */}
          <div className={styles.bentoCard}>
            <div className={styles.bentoIconWrapper}>
              <Icon name="bell" size={32} color="#ec4899" />
            </div>
            <span className={styles.bentoTagPink}>SIN FALTAS</span>
            <h3>Recordatorios Automatizados</h3>
            <p>
              Alertas por Email y WhatsApp previas a la cita para recordar fecha, horario e instrucciones de llegada.
            </p>
          </div>

          {/* Card 6: App Móvil PWA */}
          <div className={`${styles.bentoCard} ${styles.bentoCardFullWidth}`}>
            <div className={styles.bentoIconWrapper}>
              <Icon name="smartphone" size={32} color="#0284c7" />
            </div>
            <div className={styles.bentoContentFlex}>
              <div>
                <span className={styles.bentoTagBlue}>ACCESO INSTANTÁNEO</span>
                <h3>App Móvil PWA (Android & iOS)</h3>
                <p>
                  Tanto tú como tus pacientes pueden instalar TurnoHub directamente en la pantalla de inicio del teléfono como una app nativa, rápida y liviana sin depender de Google Play o App Store.
                </p>
              </div>
              <div className={styles.pwaBadgeGroup}>
                <div className={styles.pwaBadgeItem}>
                  <Icon name="check" size={18} color="#10b981" />
                  <span>Sin ocupar memoria en el celular</span>
                </div>
                <div className={styles.pwaBadgeItem}>
                  <Icon name="check" size={18} color="#10b981" />
                  <span>Acceso en 1 tap</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Industry Interactive Section */}
      <section id="rubros" className={styles.rubrosSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.subHeaderBadge}>VERSATILIDAD</span>
          <h2>Adaptable a todos los rubros y especialidades</h2>
          <p>TurnoHub ofrece herramientas específicas diseñadas a la medida de tu actividad profesional.</p>
        </div>

        <div className={styles.rubrosContainer}>
          {/* Tabs header */}
          <div className={styles.rubrosTabs}>
            {rubrosData.map((rubro) => (
              <button
                key={rubro.id}
                className={`${styles.rubroTabBtn} ${activeRubro.id === rubro.id ? styles.rubroTabActive : ''}`}
                onClick={() => setActiveRubro(rubro)}
              >
                <Icon name={rubro.icon} size={20} />
                <span>{rubro.label}</span>
              </button>
            ))}
          </div>

          {/* Active Tab Panel Showcase */}
          <div className={styles.rubroPanel}>
            <div className={styles.rubroTextContent}>
              <span className={styles.rubroBadge}>{activeRubro.badge}</span>
              <h3>{activeRubro.title}</h3>
              <p>{activeRubro.description}</p>

              <ul className={styles.rubroList}>
                {activeRubro.features.map((feat, idx) => (
                  <li key={idx}>
                    <Icon name="check" size={18} color="#10b981" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <Link to="/register" className={styles.rubroCtaBtn}>
                Probar TurnoHub para {activeRubro.label}
                <Icon name="arrowRight" size={18} />
              </Link>
            </div>

            <div className={styles.rubroVisualCard}>
              <div className={styles.rubroCardHeader}>
                <Icon name={activeRubro.icon} size={28} color="#2563eb" />
                <div>
                  <strong>{activeRubro.label}</strong>
                  <span className={styles.rubroCardSub}>{activeRubro.highlightText}</span>
                </div>
              </div>
              <div className={styles.rubroMockBox}>
                <div className={styles.mockBar}>
                  <span>Horarios disponibles hoy</span>
                  <span className={styles.mockStatus}>🟢 En línea</span>
                </div>
                <div className={styles.mockSlots}>
                  <div className={styles.mockSlot}>09:00 HS</div>
                  <div className={styles.mockSlot}>10:30 HS</div>
                  <div className={`${styles.mockSlot} ${styles.mockSlotBooked}`}>14:00 (Ocupado)</div>
                  <div className={styles.mockSlot}>16:15 HS</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Queue Special Highlight Section */}
      <section id="fila-virtual" className={styles.liveQueueSection}>
        <div className={styles.queueInner}>
          <div className={styles.queueText}>
            <span className={styles.queueBadge}>NUEVA EXPERIENCIA</span>
            <h2>Fila Virtual en Tiempo Real</h2>
            <p>
              Revoluciona la sala de espera. Tus pacientes pueden escanear un código QR al ingresar o consultar su link de turno para saber exactamente su lugar en la lista de atención.
            </p>
            <div className={styles.queueMetricsGrid}>
              <div className={styles.qMetric}>
                <strong>-80%</strong>
                <span>Consultas de "cuánto falta"</span>
              </div>
              <div className={styles.qMetric}>
                <strong>100%</strong>
                <span>Tranquilidad para el paciente</span>
              </div>
            </div>
          </div>

          <div className={styles.queueMockupPhone}>
            <div className={styles.phoneFrame}>
              <div className={styles.phoneScreen}>
                <div className={styles.queueAppHeader}>
                  <span className={styles.queueAppLogo}>TurnoHub Fila</span>
                  <span className={styles.queueAppDot}></span>
                </div>
                <div className={styles.queueCardBody}>
                  <span className={styles.qTurnNum}>Tu Turno: #04</span>
                  <h3>Dr. Alejandro Martínez</h3>
                  <div className={styles.qStatusBox}>
                    <span className={styles.qStatusIcon}>⌛</span>
                    <div>
                      <strong>2 personas adelante</strong>
                      <p>Tiempo estimado: ~10 minutos</p>
                    </div>
                  </div>
                  <div className={styles.qProgressBg}>
                    <div className={styles.qProgressBar}></div>
                  </div>
                  <p className={styles.qNotice}>Te avisaremos cuando sea momento de ingresar al consultorio.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dynamic Pricing Section */}
      <section id="planes" className={styles.pricingSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.subHeaderBadge}>PLANES A TU MEDIDA</span>
          <h2>Planes Simples y Sin Sorpresas</h2>
          <p>Elige el esquema que mejor se adapte a tu volumen de trabajo. Todos los planes incluyen 30 días de prueba gratis.</p>
        </div>

        <div className={styles.pricingGrid}>
          {plans.map((plan) => (
            <div 
              key={plan.key} 
              className={`${styles.pricingCard} ${plan.is_popular ? styles.popularCard : ''}`}
            >
              {plan.is_popular && <span className={styles.popularRibbon}>MÁS ELEGIDO</span>}
              
              <div className={styles.pricingHeader}>
                <div className={styles.pricingIconBg}>
                  <Icon name={plan.key === 'commission' ? 'percent' : 'calendar'} size={24} color="#2563eb" />
                </div>
                <h3>{plan.name}</h3>
                <p>{plan.description}</p>
              </div>

              <div className={styles.pricingPrice}>
                <span className={styles.priceVal}>{plan.price}</span>
                <span className={styles.pricePeriod}>/ {plan.price_period}</span>
              </div>

              <ul className={styles.pricingFeatures}>
                {(plan.features || []).map((feat, index) => (
                  <li key={index}>
                    <Icon name="check" size={18} color="#10b981" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <Link 
                to="/register" 
                className={`${styles.pricingBtn} ${plan.is_popular ? styles.pricingBtnPrimary : styles.pricingBtnOutline}`}
              >
                Comenzar 30 Días Gratis
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQs Section */}
      <section className={styles.faqSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.subHeaderBadge}>PREGUNTAS FRECUENTES</span>
          <h2>¿Tienes dudas? Te respondemos aquí</h2>
        </div>

        <div className={styles.faqList}>
          {faqs.map((faq, index) => (
            <div 
              key={index} 
              className={`${styles.faqItem} ${openFaq === index ? styles.faqOpen : ''}`}
              onClick={() => setOpenFaq(openFaq === index ? null : index)}
            >
              <div className={styles.faqQuestion}>
                <h3>{faq.q}</h3>
                <Icon name={openFaq === index ? "x" : "plus"} size={20} color="#64748b" />
              </div>
              {openFaq === index && (
                <div className={styles.faqAnswer}>
                  <p>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Call To Action Banner */}
      <section className={styles.ctaBanner}>
        <div className={styles.ctaBannerContent}>
          <h2>¿Listo para profesionalizar la gestión de tus turnos?</h2>
          <p>Comienza hoy mismo tu prueba gratuita de 30 días. Sin compromisos ni requerimiento de tarjeta de crédito.</p>
          <Link to="/register" className={styles.ctaBannerBtn}>
            <span>Crear mi cuenta gratis en 2 min</span>
            <Icon name="arrowRight" size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerBrand}>
            <Link to="/" className={styles.logo}>
              <div className={styles.logoIconBg}>
                <span className="material-symbols-outlined">hub</span>
              </div>
              <span className={styles.logoText}>Turno<span className={styles.logoAccent}>Hub</span></span>
            </Link>
            <p>La solución inteligente para la gestión de turnos, cobros integrados, sincronización de agenda y fila virtual.</p>
          </div>
          
          <div className={styles.footerCol}>
            <h4>Navegación</h4>
            <ul>
              <li><Link to="/login">Acceso Profesional</Link></li>
              <li><Link to="/patient">Portal de Pacientes</Link></li>
              <li><a href="#planes">Planes y Precios</a></li>
              <li><Link to="/register">Registro Gratis</Link></li>
            </ul>
          </div>
          
          <div className={styles.footerCol}>
            <h4>Contacto & Soporte</h4>
            <ul>
              <li><Link to="/help-center">Centro de Ayuda</Link></li>
              <li><a href="mailto:soporte@turnohub.com.ar">soporte@turnohub.com.ar</a></li>
              <li><Link to="/admin/login">Acceso Administración</Link></li>
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
