import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

// Middleware para verificar JWT
export const verifyToken = (req, res, next) => {
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
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Token inválido o expirado'
    });
  }
};

// Middleware para verificar rol de doctor
export const verifyDoctorRole = (req, res, next) => {
  if (!req.user || req.user.role !== 'doctor') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Solo doctores pueden acceder a este recurso.'
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
      subscription_status: user.subscription_status || 'pending'
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
