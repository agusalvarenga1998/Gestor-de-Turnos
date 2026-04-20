import { google } from 'googleapis';

// Función para obtener el cliente OAuth2 configurado
const getOAuth2Client = () => {
  const redirectUri = process.env.GOOGLE_AUTH_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI;
  
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
  console.log('--- AUTENTICACION VIA ID_TOKEN ---');
  try {
    const oauth2Client = getOAuth2Client();
    
    // 1. Intercambiar código por tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens || !tokens.id_token) {
      console.error('❌ No se recibió id_token de Google');
      throw new Error('No se pudo verificar la identidad con Google');
    }

    // 2. Decodificar el id_token (contiene la info del usuario sin hacer otra petición)
    console.log('🔐 Verificando ID Token...');
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    console.log('✓ Usuario verificado:', payload.email);

    return {
      id: payload.sub, // 'sub' es el ID único de Google
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      tokens: tokens // Seguimos devolviendo los tokens para el calendario
    };
  } catch (error) {
    console.error('❌ ERROR CRITICO GOOGLE:', error.message);
    throw new Error('Error de autenticación con Google. Por favor, intenta de nuevo.');
  }
};
