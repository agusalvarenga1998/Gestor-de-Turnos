import express from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/config.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Funciones auxiliares para obtener las credenciales con valores de contingencia
const getClientId = () => {
  return process.env.MP_CLIENT_ID || 
         (process.env.MP_ACCESS_TOKEN ? process.env.MP_ACCESS_TOKEN.split('-')[1] : null) || 
         '3334296268871714';
};

const getClientSecret = () => {
  return process.env.MP_CLIENT_SECRET || 'OB3Ug95wFOdoRxF6f4xdqU3dXy8xIkZe';
};

const getRedirectUri = (req) => {
  if (process.env.MP_REDIRECT_URI) return process.env.MP_REDIRECT_URI;
  const host = req.get('host');
  // Determinar si es conexión local (http) o producción (https)
  const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
  return `${protocol}://${host}/api/mercadopago/oauth/callback`;
};

// 1. Redirigir al portal de autorización de Mercado Pago
router.get('/oauth/auth', (req, res) => {
  try {
    const token = req.query.token;

    console.log('=== MP OAuth Redirect Request ===');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token no proporcionado'
      });
    }

    // Verificar token JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.error('Error verificado JWT:', jwtError.message);
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    const doctorId = decoded.id;
    const clientId = getClientId();
    const redirectUri = getRedirectUri(req);

    console.log(`OAuth Info: ClientID = ${clientId}, RedirectURI = ${redirectUri}`);

    if (!clientId) {
      console.error('❌ MP_CLIENT_ID no configurado en el servidor.');
      return res.status(500).json({
        success: false,
        message: 'El ID de Cliente de Mercado Pago no está configurado.'
      });
    }

    // Construir URL de autorización de Mercado Pago
    const authUrl = `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${doctorId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    console.log(`Redirigiendo a Mercado Pago para vincular el médico: ${doctorId}`);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error generando redirección de MP OAuth:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al iniciar vinculación con Mercado Pago: ' + error.message
    });
  }
});

// 2. Callback de Mercado Pago
router.get('/oauth/callback', async (req, res) => {
  try {
    console.log('=== CALLBACK MP OAUTH RECIBIDO ===');
    console.log('Query:', req.query);

    const { code, state } = req.query;
    const doctorId = state; // El doctorId que guardamos en state

    if (!code || !doctorId) {
      console.error('❌ Falta code o state');
      return res.redirect(`${FRONTEND_URL}/settings?mp_connected=error`);
    }

    const clientId = getClientId();
    const clientSecret = getClientSecret();
    const redirectUri = getRedirectUri(req);

    console.log(`Exchanging code for token. Client ID: ${clientId}, Redirect: ${redirectUri}`);

    // Realizar la solicitud POST a Mercado Pago para obtener el access token
    const tokenResponse = await axios.post(
      'https://api.mercadopago.com/oauth/token',
      new URLSearchParams({
        client_secret: clientSecret,
        client_id: clientId,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'accept': 'application/json'
        }
      }
    );

    const data = tokenResponse.data;
    console.log('✓ Token obtenido de MP:', data.user_id);

    // Guardar tokens en BD
    await query(
      `UPDATE doctors 
       SET mp_access_token = $1, 
           mp_refresh_token = $2, 
           mp_connected = TRUE 
       WHERE id = $3`,
      [data.access_token, data.refresh_token, doctorId]
    );

    console.log('✓ Credenciales de MP guardadas en base de datos. Redirigiendo...');
    res.redirect(`${FRONTEND_URL}/settings?mp_connected=true`);
  } catch (error) {
    console.error('❌ Error en callback de Mercado Pago OAuth:', error.response?.data || error.message);
    res.redirect(`${FRONTEND_URL}/settings?mp_connected=error`);
  }
});

export default router;
