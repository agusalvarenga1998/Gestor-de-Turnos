import { query } from './config.js';

const allFeatures = [
  'Portal de Reservas Online para Pacientes 24/7 (Link personalizado)',
  'Cobro Automático de Señas y Consultas con Mercado Pago',
  'Sincronización Bidireccional Automática con Google Calendar',
  'Recordatorios y Confirmaciones de Citas por WhatsApp',
  'Notificaciones y Confirmaciones de Turnos por Email',
  'Notificaciones Web Push en Tiempo Real en Celular o PC',
  'Gestión de Fila en Vivo (Turnero Virtual y Pantalla Llamadora)',
  'Ingreso Autónomo de Pacientes a Fila mediante Código QR',
  'Gestión de Obras Sociales, Prepagas, Coberturas y Coseguros',
  'Historia Clínica Digital Completa y Expedientes de Pacientes',
  'Subida de Estudios Médicos, Imágenes y Archivos Adjuntos',
  'Odontograma Digital Interactivo por Pieza Dental',
  'Módulo de Caja y Finanzas (Ingresos, Señas, Gastos y Balance)',
  'Estadísticas Avanzadas e Indicadores de Gestión y Ausentismo',
  'Exportación de Turnos, Pacientes y Reportes a Excel (.xlsx)',
  'Consultas Online y Telemedicina (Google Meet Automático)',
  'Configuración de Horarios Flexibles y Bloqueo de Vacaciones',
  'Envíos Automáticos de Saludos de Cumpleaños por Email',
  'Aplicación Web y Móvil Instalable (PWA) sin tiendas',
  'Soporte Técnico Preferencial y Asistencia Directa por WhatsApp'
];

async function updateFeatures() {
  try {
    await query('UPDATE pricing_plans SET features = $1', [allFeatures]);
    console.log('✓ Planes actualizados exitosamente con', allFeatures.length, 'funcionalidades.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error actualizando planes:', err);
    process.exit(1);
  }
}

updateFeatures();
