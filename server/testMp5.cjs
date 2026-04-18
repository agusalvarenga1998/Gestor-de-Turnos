const { MercadoPagoConfig, Preference } = require('mercadopago');
async function test() {
  try {
    const client = new MercadoPagoConfig({ 
      accessToken: 'APP_USR-3576382034842744-041414-dcbc9a327d0a87b9e037764d80e95f57-1532497447' 
    });
    const pref = new Preference(client);
    const bridgeUrl = (target) => `https://httpbin.org/redirect-to?url=${encodeURIComponent(target)}`;
    const body = {
      items: [{ id: '1', title: 'Test', quantity: 1, unit_price: 100 }],
      back_urls: {
        success: bridgeUrl('http://localhost:3000/patient/appointment/1'),
        failure: bridgeUrl('http://localhost:3000/patient/appointment/1'),
        pending: bridgeUrl('http://localhost:3000/patient/appointment/1')
      },
      auto_return: 'approved'
    };
    await pref.create({ body });
    console.log('OK - HTTPBIN FUNCIONA');
  } catch(e) {
    console.log('ERROR:', e.message);
  }
}
test();
