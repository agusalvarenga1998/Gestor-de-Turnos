import { query } from './config.js';

const extraPlans = [
  {
    key: 'mensual_pro',
    name: 'Plan Mensual Pro + Consultas Online',
    description: 'Para profesionales de la salud, medicina, psicología y estética que buscan automatización total.',
    price: '$24.999',
    price_period: 'mes fijo',
    is_popular: true,
    is_enabled: true,
    allow_google_calendar: true,
    allow_mercadopago: true,
    allow_telemedicine: true,
    allow_reminders: true,
    allow_insurance: true,
    allow_patient_booking: true,
    max_patients: null,
    max_appointments_monthly: null,
    features: [
      'Portal de Reservas Online para Pacientes 24/7 (Link personalizado)',
      'Consultas Online y Telemedicina (Google Meet Automático)',
      'Cobro Automático de Señas y Consultas con Mercado Pago',
      'Sincronización Bidireccional Automática con Google Calendar',
      'Recordatorios y Confirmaciones de Citas por WhatsApp y Email',
      'Notificaciones Web Push en Tiempo Real en Celular o PC',
      'Historia Clínica Digital Completa y Expedientes de Pacientes',
      'Subida de Estudios Médicos, Imágenes y Archivos Adjuntos',
      'Gestión de Obras Sociales, Prepagas, Coberturas y Coseguros',
      'Módulo de Caja y Finanzas (Ingresos, Señas, Gastos y Balance)',
      'Estadísticas Avanzadas e Indicadores de Gestión y Ausentismo',
      'Exportación de Turnos, Pacientes y Reportes a Excel (.xlsx)',
      'Envíos Automáticos de Saludos de Cumpleaños por Email',
      'Soporte Técnico Preferencial y Asistencia Directa por WhatsApp'
    ]
  },
  {
    key: 'odontologia',
    name: 'Plan Odontología & Clínicas Dentales',
    description: 'Diseñado especialmente para Odontólogos, Dentistas y Centros Odontológicos.',
    price: '$29.999',
    price_period: 'mes fijo',
    is_popular: false,
    is_enabled: true,
    allow_google_calendar: true,
    allow_mercadopago: true,
    allow_telemedicine: true,
    allow_reminders: true,
    allow_insurance: true,
    allow_patient_booking: true,
    max_patients: null,
    max_appointments_monthly: null,
    features: [
      'Odontograma Digital Interactivo por Pieza Dental y Tratamientos',
      'Historia Clínica Odontológica con Radiografías y Adjuntos',
      'Cobro Automático de Señas y Consultas con Mercado Pago',
      'Recordatorios y Confirmaciones de Turnos por WhatsApp y Email',
      'Sincronización Bidireccional Automática con Google Calendar',
      'Gestión de Obras Sociales, Prepagas, Coberturas y Coseguros',
      'Módulo de Caja, Finanzas y Balance en Tiempo Real',
      'Estadísticas de Ausentismo y Exportación a Excel (.xlsx)',
      'Notificaciones Web Push en Tiempo Real (PWA)',
      'Soporte Técnico Preferencial y Asistencia Directa por WhatsApp'
    ]
  },
  {
    key: 'orden_llegada',
    name: 'Plan Fila Virtual & Orden de Llegada',
    description: 'Ideal para guardias, atención espontánea, barberías, estética y laboratorios sin cita previa.',
    price: '$18.999',
    price_period: 'mes fijo',
    is_popular: false,
    is_enabled: true,
    allow_google_calendar: false,
    allow_mercadopago: true,
    allow_telemedicine: false,
    allow_reminders: true,
    allow_insurance: true,
    allow_patient_booking: false,
    max_patients: null,
    max_appointments_monthly: null,
    features: [
      'Gestión de Fila en Vivo y Turnero Virtual por Orden de Llegada',
      'Pantalla Llamadora de Pacientes / Clientes en tiempo real',
      'Ingreso Autónomo a Fila mediante Código QR en Sala de Espera',
      'Seguimiento del Lugar en Fila en vivo en celular del Paciente',
      'Notificaciones Web Push y Avisos por WhatsApp cuando es su turno',
      'Módulo de Caja y Registro de Cobros de Servicios',
      'Estadísticas de Tiempos de Espera y Flujo de Clientes',
      'Exportación de Reportes e Historial a Excel (.xlsx)',
      'Aplicación Web y Móvil Instalable (PWA)',
      'Soporte Técnico Preferencial por WhatsApp'
    ]
  },
  {
    key: 'commission',
    name: 'Plan Comisión Inicial',
    description: 'Ideal para profesionales que recién comienzan y no desean costo fijo mensual.',
    price: '3%',
    price_period: 'por turno efectivo',
    is_popular: false,
    is_enabled: true,
    allow_google_calendar: true,
    allow_mercadopago: true,
    allow_telemedicine: false,
    allow_reminders: true,
    allow_insurance: true,
    allow_patient_booking: true,
    max_patients: null,
    max_appointments_monthly: null,
    features: [
      'Portal de Reservas Online para Pacientes 24/7 (Link personalizado)',
      'Cobro de Señas con Mercado Pago',
      'Notificaciones y Confirmaciones por WhatsApp y Email',
      'Historia Clínica Digital y Expedientes de Pacientes',
      'Configuración de Horarios Flexibles de Atención',
      'Módulo de Caja e Ingresos Básico',
      'Aplicación Web y Móvil Instalable (PWA)',
      'Sin costo de mantenimiento mensual (Pagas solo si trabajas)'
    ]
  }
];

async function seedExtraPlans() {
  try {
    console.log('🌱 Poblando planes especializados...');
    
    // Deshabilitar clave 'monthly' obsoleta
    await query("UPDATE pricing_plans SET is_enabled = false, is_popular = false WHERE key = 'monthly'");

    for (const plan of extraPlans) {
      await query(
        `INSERT INTO pricing_plans 
          (key, name, description, price, price_period, is_popular, is_enabled, allow_google_calendar, allow_mercadopago, allow_telemedicine, allow_reminders, allow_insurance, allow_patient_booking, max_patients, max_appointments_monthly, features)
         VALUES 
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (key) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          price = EXCLUDED.price,
          price_period = EXCLUDED.price_period,
          is_popular = EXCLUDED.is_popular,
          is_enabled = EXCLUDED.is_enabled,
          allow_google_calendar = EXCLUDED.allow_google_calendar,
          allow_mercadopago = EXCLUDED.allow_mercadopago,
          allow_telemedicine = EXCLUDED.allow_telemedicine,
          allow_reminders = EXCLUDED.allow_reminders,
          allow_insurance = EXCLUDED.allow_insurance,
          allow_patient_booking = EXCLUDED.allow_patient_booking,
          max_patients = EXCLUDED.max_patients,
          max_appointments_monthly = EXCLUDED.max_appointments_monthly,
          features = EXCLUDED.features`,
        [
          plan.key,
          plan.name,
          plan.description,
          plan.price,
          plan.price_period,
          plan.is_popular,
          plan.is_enabled,
          plan.allow_google_calendar,
          plan.allow_mercadopago,
          plan.allow_telemedicine,
          plan.allow_reminders,
          plan.allow_insurance,
          plan.allow_patient_booking,
          plan.max_patients,
          plan.max_appointments_monthly,
          plan.features
        ]
      );
      console.log(`✓ Plan "${plan.name}" (${plan.key}) registrado.`);
    }
    console.log('\n✅ Todos los planes especializados han sido poblados correctamente!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error registrando planes:', err);
    process.exit(1);
  }
}

seedExtraPlans();
