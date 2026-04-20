import { google } from 'googleapis';
import axios from 'axios';

// Función para obtener el cliente OAuth2 configurado
const getOAuth2Client = () => {
  const redirectUri = process.env.GOOGLE_AUTH_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI;
  
  if (!redirectUri) {
    console.error('❌ ERROR: GOOGLE_AUTH_REDIRECT_URI no configurada.');
  }

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
};

// Generar URL de autorización
export const getAuthUrl = () => {
  const oauth2Client = getOAuth2Client();
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'openid'
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
};

// Obtener información del usuario
export const getUserInfo = async (code) => {
  console.log('--- NUEVO INTENTO DE AUTENTICACION ---');
  try {
    const oauth2Client = getOAuth2Client();
    
    console.log('1. Intercambiando code por tokens...');
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens || !tokens.access_token) {
      console.error('❌ No se recibió access_token de Google');
      throw new Error('Token de Google no recibido');
    }

    console.log('2. Token de acceso recibido correctamente');

    // MÉTODO ALTERNATIVO: Usamos axios directamente para pedir la info del usuario
    // Esto es más robusto si el cliente de Google falla al adjuntar headers
    console.log('3. Solicitando información de usuario vía Axios...');
    const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`
      }
    });

    const userData = response.data;
    console.log('✓ Información de usuario obtenida exitosamente');

    return {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      picture: userData.picture,
      tokens: tokens
    };
  } catch (error) {
    console.error('❌ FALLO EN LA AUTENTICACION:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data));
    } else {
      console.error('Mensaje:', error.message);
    }
    throw new Error('Error al conectar con Google. Por favor, intenta de nuevo.');
  }
};
