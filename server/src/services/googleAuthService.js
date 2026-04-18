import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_AUTH_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI
);

// Generar URL de autorización para Login/Registro con Google
export const getAuthUrl = () => {
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

  console.log('🔗 URL de autenticación generada:', url);

  return url;
};

// Obtener información del usuario desde el código de autorización
export const getUserInfo = async (code) => {
  try {
    console.log('🔐 Intercambiando code por tokens...');

    // Intercambiar código por tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    console.log('✓ Tokens obtenidos');

    // Obtener información del usuario
    console.log('👤 Obteniendo información del usuario...');
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: 'v2'
    });

    const userInfo = await oauth2.userinfo.get();

    console.log('✓ Información obtenida');

    return {
      id: userInfo.data.id,
      email: userInfo.data.email,
      name: userInfo.data.name,
      picture: userInfo.data.picture
    };
  } catch (error) {
    console.error('❌ Error obteniendo información de Google:', error);
    throw new Error('No se pudo autenticar con Google');
  }
};
