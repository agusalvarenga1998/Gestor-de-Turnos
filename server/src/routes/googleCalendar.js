import express from 'express';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../middleware/auth.js';
import * as googleCalendarService from '../services/googleCalendarService.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Generar URL de autenticación (requiere token en query string)
router.get('/auth', (req, res) => {
  try {
    // Obtener token de query string
    const token = req.query.token;

    console.log('=== Google Auth Request ===');
    console.log('Token recibido:', token ? 'Sí' : 'No');
    console.log('JWT_SECRET existe:', !!process.env.JWT_SECRET);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token no proporcionado'
      });
    }

    // Verificar token manualmente
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token verificado. Doctor ID:', decoded.id);
    } catch (jwtError) {
      console.error('Error verificando JWT:', jwtError.message);
      return res.status(401).json({
        success: false,
        message: 'Token inválido: ' + jwtError.message
      });
    }

    const doctorId = decoded.id;

    const authUrl = googleCalendarService.getAuthUrl(doctorId);
    console.log('Redirigiendo a Google...');
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error generando URL de autenticación:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error al conectar con Google Calendar: ' + error.message
    });
  }
});

// Callback de Google
router.get('/callback', async (req, res) => {
  try {
    console.log('\n📍 === GOOGLE CALLBACK RECIBIDO ===');
    console.log('Query params:', req.query);

    const { code, state } = req.query;
    const doctorId = state;

    console.log('Code recibido:', code ? `${code.substring(0, 20)}...` : 'NO');
    console.log('State (doctorId):', doctorId);

    if (!code || !doctorId) {
      console.error('❌ Falta code o state');
      return res.status(400).json({
        success: false,
        message: 'Código o estado faltante'
      });
    }

    console.log('🔄 Llamando a handleCallback...');
    // Guardar tokens en la BD
    await googleCalendarService.handleCallback(code, doctorId);

    console.log('✓ Callback completado, redirigiendo...\n');
    // Redirigir al frontend con success
    res.redirect(`${FRONTEND_URL}/settings?connected=true`);
  } catch (error) {
    console.error('\n❌ Error en callback de Google:', error.message);
    console.error('Stack:', error.stack, '\n');
    res.redirect(`${FRONTEND_URL}/settings?error=true`);
  }
});

// Obtener estado de conexión
router.get('/status', verifyToken, async (req, res) => {
  try {
    const doctorId = req.user.id;
    console.log('GET /status - Doctor ID:', doctorId);

    const status = await googleCalendarService.getConnectionStatus(doctorId);
    console.log('Status obtenido:', status);

    res.json({
      success: true,
      connected: status.connected || false
    });
  } catch (error) {
    console.error('Error obteniendo estado:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estado de Google Calendar: ' + error.message
    });
  }
});

// Desconectar Google Calendar
router.post('/disconnect', verifyToken, async (req, res) => {
  try {
    const doctorId = req.user.id;
    const result = await googleCalendarService.disconnectCalendar(doctorId);

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Error desconectando:', error);
    res.status(500).json({
      success: false,
      message: 'Error al desconectar Google Calendar'
    });
  }
});

export default router;
