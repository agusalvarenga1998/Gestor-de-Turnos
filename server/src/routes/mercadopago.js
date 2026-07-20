import express from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/config.js';
import axios from 'axios';
import dotenv from 'dotenv';
import { verifyToken } from '../middleware/auth.js';

dotenv.config();

const router = express.Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const getPlatformToken = async () => {
  try {
    const result = await query('SELECT mp_access_token FROM admins WHERE mp_connected = true LIMIT 1');
    if (result.rows.length > 0 && result.rows[0].mp_access_token) {
      return result.rows[0].mp_access_token;
    }
  } catch (error) {
    console.error('Error fetching admin token from database:', error);
  }
  return process.env.MP_ACCESS_TOKEN || 'APP_USR-3334296268871714-041414-dcbc9a327d0a87b9e037764d80e95f57-161301647';
};

const getClientId = async () => {
  const token = await getPlatformToken();
  return process.env.MP_CLIENT_ID || (token.includes('-') ? token.split('-')[1] : '') || '3334296268871714';
};

const getClientSecret = () => {
  return process.env.MP_CLIENT_SECRET || 'OB3Ug95wFOdoRxF6f4xdqU3dXy8xlkZe';
};

const getRedirectUri = (req) => {
  if (process.env.MP_REDIRECT_URI) return process.env.MP_REDIRECT_URI;
  const host = req.get('host');
  const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
  return `${protocol}://${host}/api/mercadopago/oauth/callback`;
};

const verifyAdmin = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// 1. Redirigir al portal de autorización de Mercado Pago para Médicos
router.get('/oauth/auth', async (req, res) => {
  try {
    const token = req.query.token;

    console.log('=== MP OAuth Redirect Request ===');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token no proporcionado'
      });
    }

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

    const doctorPlanResult = await query(
      'SELECT p.allow_mercadopago FROM doctors d LEFT JOIN pricing_plans p ON d.pricing_plan_id = p.id WHERE d.id = $1',
      [doctorId]
    );

    if (doctorPlanResult.rows.length > 0 && doctorPlanResult.rows[0].allow_mercadopago === false) {
      return res.status(403).json({
        success: false,
        planRestricted: true,
        message: 'Tu plan actual no incluye la integración con Mercado Pago.'
      });
    }

    const clientId = await getClientId();
    const redirectUri = getRedirectUri(req);

    console.log(`OAuth Info: ClientID = ${clientId}, RedirectURI = ${redirectUri}`);

    if (!clientId) {
      console.error('❌ MP_CLIENT_ID no configurado en el servidor.');
      return res.status(500).json({
        success: false,
        message: 'El ID de Cliente de Mercado Pago no está configurado.'
      });
    }

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

// 1b. Redirigir al portal de autorización de Mercado Pago para el Administrador
router.get('/oauth/admin/auth', async (req, res) => {
  try {
    const token = req.query.token;

    console.log('=== MP Admin OAuth Redirect Request ===');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token no proporcionado'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    } catch (jwtError) {
      console.error('Error verificado JWT:', jwtError.message);
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    if (decoded.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acceso restringido a administradores'
      });
    }

    const adminId = decoded.id;
    const clientId = await getClientId();
    const redirectUri = getRedirectUri(req);

    console.log(`Admin OAuth Info: ClientID = ${clientId}, RedirectURI = ${redirectUri}`);

    const authUrl = `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=admin:${adminId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    console.log(`Redirigiendo a Mercado Pago para vincular el admin: ${adminId}`);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error generando redirección de MP OAuth para admin:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 2. Callback de Mercado Pago
router.get('/oauth/callback', async (req, res) => {
  try {
    console.log('=== CALLBACK MP OAUTH RECIBIDO ===');
    console.log('Query:', req.query);

    const { code, state } = req.query;

    if (!code || !state) {
      console.error('❌ Falta code o state');
      return res.redirect(`${FRONTEND_URL}/settings?mp_connected=error`);
    }

    const isAdmin = state.startsWith('admin:');
    const targetId = isAdmin ? state.split(':')[1] : state;

    const clientId = await getClientId();
    const clientSecret = getClientSecret();
    const redirectUri = getRedirectUri(req);
    const platformToken = await getPlatformToken();

    console.log(`Exchanging code for token. Client ID: ${clientId}, Redirect: ${redirectUri}`);

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
          'accept': 'application/json',
          'Authorization': `Bearer ${platformToken}`
        }
      }
    );

    const data = tokenResponse.data;
    console.log('✓ Token obtenido de MP:', data.user_id);

    if (isAdmin) {
      await query(
        `UPDATE admins 
         SET mp_access_token = $1, 
             mp_refresh_token = $2, 
             mp_connected = TRUE 
         WHERE id = $3`,
        [data.access_token, data.refresh_token, targetId]
      );

      console.log('✓ Credenciales de MP del admin guardadas en BD. Redirigiendo...');
      res.redirect(`${FRONTEND_URL}/admin/subscriptions?mp_connected=true`);
    } else {
      await query(
        `UPDATE doctors 
         SET mp_access_token = $1, 
             mp_refresh_token = $2, 
             mp_connected = TRUE 
         WHERE id = $3`,
        [data.access_token, data.refresh_token, targetId]
      );

      console.log('✓ Credenciales de MP del doctor guardadas en BD. Redirigiendo...');
      res.redirect(`${FRONTEND_URL}/settings?mp_connected=true`);
    }
  } catch (error) {
    console.error('❌ Error en callback de Mercado Pago OAuth:', error.response?.data || error.message);
    const isAdmin = req.query.state?.startsWith('admin:');
    if (isAdmin) {
      res.redirect(`${FRONTEND_URL}/admin/subscriptions?mp_connected=error`);
    } else {
      res.redirect(`${FRONTEND_URL}/settings?mp_connected=error`);
    }
  }
});

// 3. Obtener detalles de la cuenta de Mercado Pago vinculada (Médico)
router.get('/oauth/account', verifyToken, async (req, res) => {
  try {
    const doctorId = req.user.id;

    const result = await query(
      'SELECT mp_access_token, mp_connected FROM doctors WHERE id = $1',
      [doctorId]
    );

    if (result.rows.length === 0 || !result.rows[0].mp_connected || !result.rows[0].mp_access_token) {
      return res.json({
        success: true,
        connected: false
      });
    }

    const mpAccessToken = result.rows[0].mp_access_token;

    try {
      const response = await axios.get('https://api.mercadolibre.com/users/me', {
        headers: {
          'Authorization': `Bearer ${mpAccessToken}`
        }
      });

      const { email, nickname, first_name, last_name, id } = response.data;

      return res.json({
        success: true,
        connected: true,
        account: {
          id,
          email,
          nickname,
          name: `${first_name || ''} ${last_name || ''}`.trim() || nickname
        }
      });
    } catch (apiError) {
      console.error('Error fetching details from Mercado Pago API:', apiError.response?.data || apiError.message);
      
      if (apiError.response?.status === 401) {
        return res.json({
          success: true,
          connected: true,
          error: 'Token inválido o expirado'
        });
      }

      return res.json({
        success: true,
        connected: true,
        account: {
          nickname: 'Cuenta vinculada'
        }
      });
    }
  } catch (error) {
    console.error('Error getting Mercado Pago account status:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estado de Mercado Pago'
    });
  }
});

// 3b. Obtener detalles de la cuenta de Mercado Pago vinculada al administrador
router.get('/oauth/admin/account', verifyAdmin, async (req, res) => {
  try {
    const adminId = req.admin.id;

    const result = await query(
      'SELECT mp_access_token, mp_connected FROM admins WHERE id = $1',
      [adminId]
    );

    if (result.rows.length === 0 || !result.rows[0].mp_connected || !result.rows[0].mp_access_token) {
      return res.json({
        success: true,
        connected: false
      });
    }

    const mpAccessToken = result.rows[0].mp_access_token;

    try {
      const response = await axios.get('https://api.mercadolibre.com/users/me', {
        headers: {
          'Authorization': `Bearer ${mpAccessToken}`
        }
      });

      const { email, nickname, first_name, last_name, id } = response.data;

      return res.json({
        success: true,
        connected: true,
        account: {
          id,
          email,
          nickname,
          name: `${first_name || ''} ${last_name || ''}`.trim() || nickname
        }
      });
    } catch (apiError) {
      console.error('Error fetching admin details from MP API:', apiError.response?.data || apiError.message);
      return res.json({
        success: true,
        connected: true,
        account: {
          nickname: 'Cuenta Administrador'
        }
      });
    }
  } catch (error) {
    console.error('Error getting Admin Mercado Pago account status:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estado de Mercado Pago del Administrador'
    });
  }
});

export default router;
