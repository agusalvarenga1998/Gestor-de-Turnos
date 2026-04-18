// Manejador centralizado de errores
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

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

  // Errores de base de datos
  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({
      success: false,
      message: 'Error de conexión a la base de datos'
    });
  }

  // Error por defecto
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Error interno del servidor'
  });
};

// Manejador de rutas no encontradas
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
};
