import { MercadoPagoConfig, Preference } from 'mercadopago';

// Configuración inicial (se actualizará con el access token del doctor para cobros directos)
export const createMPPreference = async (appointmentData, doctorMPAccessToken) => {
  try {
    const client = new MercadoPagoConfig({ 
      accessToken: doctorMPAccessToken, // Usamos el token del doctor
      options: { timeout: 5000 }
    });

    const preference = new Preference(client);

    const { total_amount, system_fee, appointmentId, doctorName } = appointmentData;

    const baseReturnUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/patient/appointment/${appointmentId}`;
    const isLocalhost = baseReturnUrl.includes('localhost') || baseReturnUrl.includes('127.0.0.1');
    const bridgeUrl = (target) => `https://httpbin.org/redirect-to?url=${encodeURIComponent(target)}`;

    const body = {
      items: [
        {
          id: appointmentId,
          title: `Reserva de Turno - Dr. ${doctorName}`,
          quantity: 1,
          unit_price: Number(total_amount),
          currency_id: 'ARS'
        }
      ],
      // marketplace_fee: Number(system_fee), // La comisión que se queda la plataforma
      external_reference: appointmentId,

      back_urls: {
        success: isLocalhost ? bridgeUrl(baseReturnUrl) : baseReturnUrl,
        failure: isLocalhost ? bridgeUrl(baseReturnUrl) : baseReturnUrl,
        pending: isLocalhost ? bridgeUrl(baseReturnUrl) : baseReturnUrl
      },
      auto_return: 'approved', // Reactivado con éxito gracias al puente HTTPS
      notification_url: `${process.env.BACKEND_WEBHOOK_URL}/mercadopago?appointmentId=${appointmentId}`
    };

    console.log('📦 Enviando preferencia a Mercado Pago:', JSON.stringify(body, null, 2));
    const response = await preference.create({ body });
    return response;
  } catch (error) {
    console.error('Error creando preferencia MP:', error);
    throw error;
  }
};
