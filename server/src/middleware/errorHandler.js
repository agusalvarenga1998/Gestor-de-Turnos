import { sendErrorLogEmail } from '../services/emailService.js';

// Manejador centralizado de errores
export const errorHandler = (err, req, res, next) => {
  console.error('❌ Error capturado en errorHandler:', err);

  // Errores de validación
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Error de validación',
      errors: err.details
    });
  }

  // Errores de autenticación
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'No autorizado'
    });
  }

  // Errores de base de datos / conexión
  if (err.code === 'ECONNREFUSED') {
    sendErrorLogEmail({ error: err, req, source: 'DB Connection Error' })
      .catch(e => console.error('Error enviando mail de log de DB:', e));

    return res.status(503).json({
      success: false,
      message: 'No pudimos conectar con la base de datos. Por favor, comunícate con Soporte Técnico.',
      supportUrl: '/support'
    });
  }

  // Para errores 500 o no clasificados, notificar por email al admin automáticamente
  const statusCode = err.statusCode || 500;
  if (statusCode >= 500) {
    sendErrorLogEmail({ error: err, req, source: 'Backend Server Error (500)' })
      .catch(e => console.error('Error enviando mail de log de error al admin:', e));
  }

  // Error por defecto al cliente
  res.status(statusCode).json({
    success: false,
    message: 'Ocurrió un problema inesperado. El equipo técnico ha sido notificado automáticamente. Por favor, comunícate con Soporte Técnico si necesitas ayuda.',
    supportUrl: '/support',
    contactSupportMessage: 'Comunícate con Soporte Técnico a admin.turnohub@gmail.com o ingresa a /support'
  });
};

// Manejador de rutas no encontradas
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
};
