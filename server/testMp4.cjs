const { MercadoPagoConfig, Preference } = require('mercadopago');
async function test() {
  try {
    const client = new MercadoPagoConfig({ 
      accessToken: 'APP_USR-3576382034842744-041414-dcbc9a327d0a87b9e037764d80e95f57-1532497447' 
    });
    const pref = new Preference(client);
    const body = {
      items: [{ id: '1', title: 'Test', quantity: 1, unit_price: 100 }],
      back_urls: {
        success: 'http://127.0.0.1:3000/patient/appointment/1',
        failure: 'http://127.0.0.1:3000/patient/appointment/1',
        pending: 'http://127.0.0.1:3000/patient/appointment/1'
      },
      auto_return: 'approved'
    };
    await pref.create({ body });
    console.log('OK');
  } catch(e) {
    console.log('ERROR:', e.message);
  }
}
test();
