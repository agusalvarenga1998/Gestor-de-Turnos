import { google } from 'googleapis';

// Función para obtener el cliente OAuth2 configurado
const getOAuth2Client = () => {
  const redirectUri = process.env.GOOGLE_AUTH_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI;
  
  if (!redirectUri) {
    console.error('❌ ERROR: GOOGLE_AUTH_REDIRECT_URI no está definida en las variables de entorno.');
  } else {
    console.log('📡 Configuración Google -> Redirect URI:', redirectUri);
    console.log('📡 Configuración Google -> Client ID:', process.env.GOOGLE_CLIENT_ID?.substring(0, 10) + '...');
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
  // Usamos los scopes cortos y estándar
  const scopes = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    include_granted_scopes: true,
    prompt: 'consent'
  });
};

// Obtener información del usuario
export const getUserInfo = async (code) => {
  console.log('--- DIAGNOSTICO DE TOKENS GOOGLE ---');
  try {
    const oauth2Client = getOAuth2Client();
    
    // 1. Intercambiar código por tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    // LOG DE SEGURIDAD (Solo vemos qué campos vienen, no sus valores)
    console.log('Campos recibidos en tokens:', Object.keys(tokens).join(', '));

    if (!tokens.id_token && !tokens.access_token) {
      throw new Error('Google no devolvió ningún token válido');
    }

    let userData = {};

    // 2. Intentar usar ID Token si está disponible (es lo más rápido)
    if (tokens.id_token) {
      console.log('🔐 Usando ID Token para obtener identidad...');
      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      const payload = ticket.getPayload();
      userData = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture
      };
    } 
    // 3. Si no hay ID Token pero hay Access Token, intentamos People API (más moderna que UserInfo)
    else if (tokens.access_token) {
      console.log('📡 ID Token ausente. Usando Access Token con People API...');
      oauth2Client.setCredentials(tokens);
      const people = google.people({ version: 'v1', auth: oauth2Client });
      const res = await people.people.get({
        resourceName: 'people/me',
        personFields: 'names,emailAddresses,photos'
      });

      userData = {
        id: res.data.resourceName.split('/')[1],
        email: res.data.emailAddresses[0].value,
        name: res.data.names[0].displayName,
        picture: res.data.photos[0].url
      };
    }

    console.log('✓ Usuario identificado:', userData.email);

    return {
      ...userData,
      tokens: tokens
    };
  } catch (error) {
    console.error('❌ ERROR EN DIAGNOSTICO:', error.message);
    if (error.response) console.error('Detalle:', error.response.data);
    throw new Error('Error al conectar con Google. Revisa la configuración de la Consola de Google.');
  }
};
