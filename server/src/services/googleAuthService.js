import { google } from 'googleapis';

// Función para obtener el cliente OAuth2 configurado
const getOAuth2Client = () => {
  // Priorizamos GOOGLE_AUTH_REDIRECT_URI para evitar conflictos con otras variables
  const redirectUri = process.env.GOOGLE_AUTH_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI;
  
  if (!redirectUri) {
    console.error('❌ ERROR CRÍTICO: No se ha configurado la URL de redirección de Google.');
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

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent' // Forzar el consentimiento para asegurar que recibimos el refresh_token
  });

  return url;
};

// Obtener información del usuario desde el código de autorización
export const getUserInfo = async (code) => {
  try {
    const oauth2Client = getOAuth2Client();
    
    // Intercambiar código por tokens
    console.log('🔐 Solicitando tokens a Google...');
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens || !tokens.access_token) {
      console.error('❌ Google नहीं devolvió un access_token válido');
      throw new Error('No se recibió el token de acceso');
    }

    oauth2Client.setCredentials(tokens);

    // Obtener información del usuario
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: 'v2'
    });

    const userInfo = await oauth2.userinfo.get();

    return {
      id: userInfo.data.id,
      email: userInfo.data.email,
      name: userInfo.data.name,
      picture: userInfo.data.picture,
      tokens: tokens // Devolvemos los tokens para guardarlos si es necesario (calendario)
    };
  } catch (error) {
    console.error('❌ Error en el proceso de autenticación de Google:', error.message);
    if (error.response) {
      console.error('Detalle del error:', error.response.data);
    }
    throw error;
  }
};
