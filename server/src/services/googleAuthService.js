import { google } from 'googleapis';

// Función para obtener el cliente OAuth2 configurado
const getOAuth2Client = () => {
  const redirectUri = process.env.GOOGLE_AUTH_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI;
  
  if (!redirectUri) {
    console.error('❌ ERROR CRÍTICO: No se ha configurado GOOGLE_AUTH_REDIRECT_URI o GOOGLE_REDIRECT_URI en las variables de entorno.');
  } else {
    console.log(`📡 Usando Redirect URI: ${redirectUri.substring(0, 20)}...`);
  }

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
};

// Generar URL de autorización para Login/Registro con Google
export const getAuthUrl = () => {
  const oauth2Client = getOAuth2Client();
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
    const oauth2Client = getOAuth2Client();
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
