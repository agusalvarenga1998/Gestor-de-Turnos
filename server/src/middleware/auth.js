import jwt from 'jsonwebtoken';
import { query } from '../db/config.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

// Middleware para verificar JWT
export const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token no proporcionado'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    // Validar versión del token contra la base de datos
    const result = await query('SELECT token_version FROM doctors WHERE id = $1', [decoded.id]);
    if (result.rows.length === 0 || result.rows[0].token_version !== decoded.token_version) {
      return res.status(401).json({
        success: false,
        message: 'Sesión inválida o expirada. Inicia sesión nuevamente.'
      });
    }

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Token inválido o expirado'
    });
  }
};

// Middleware para verificar rol de doctor y suscripción activa
export const verifyDoctorRole = async (req, res, next) => {
  if (!req.user || req.user.role !== 'doctor') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Solo doctores pueden acceder a este recurso.'
    });
  }

  // Si ya sabemos que está expirada por el token, bloqueamos
  if (req.user.subscription_status === 'expired') {
    return res.status(403).json({
      success: false,
      subscriptionExpired: true,
      message: 'Debes pagar para seguir usando la app'
    });
  }

  next();
};

// Middleware específico para verificar suscripción consultando la DB (más seguro)
export const checkSubscription = async (req, res, next) => {
  try {
    const { query } = await import('../db/config.js');
    
    const result = await query(
      'SELECT status, subscription_status, trial_ends_at, subscription_expires_at FROM doctors WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Doctor no encontrado' });
    }

    const doctor = result.rows[0];
    const now = new Date();
    let isExpired = false;

    if (doctor.subscription_status === 'trial' && doctor.trial_ends_at && new Date(doctor.trial_ends_at) < now) {
      isExpired = true;
    } else if (doctor.subscription_status === 'active' && doctor.subscription_expires_at && new Date(doctor.subscription_expires_at) < now) {
      isExpired = true;
    } else if (doctor.subscription_status === 'expired') {
      isExpired = true;
    }

    if (isExpired) {
      return res.status(403).json({
        success: false,
        subscriptionExpired: true,
        message: 'Debes pagar para seguir usando la app'
      });
    }

    next();
  } catch (error) {
    console.error('Error verificando suscripción:', error);
    next(); // En caso de error, permitimos pasar para no bloquear la app por error de DB
  }
};

// Middleware para verificar API Key de integraciones externas (n8n)
export const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== process.env.N8N_API_KEY) {
    return res.status(401).json({
      success: false,
      message: 'API key inválida o no proporcionada'
    });
  }

  next();
};

// Generar JWT
export const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: 'doctor', // Los que hacen login son siempre doctores
      name: user.name,
      status: user.status || 'pending',
      subscription_status: user.subscription_status || 'pending',
      token_version: user.token_version || 1
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// Verificar y decodificar token
export const verifyAndDecodeToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};
