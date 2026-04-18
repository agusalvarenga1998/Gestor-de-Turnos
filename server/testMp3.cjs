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
        success: 'http://localhost',
        failure: 'http://localhost',
        pending: 'http://localhost'
      },
      auto_return: 'approved'
    };
    console.log('Creando con localhost base...');
    const r = await pref.create({ body });
    console.log('OK, id =', r.id);
  } catch(e) {
    console.error('FAIL:', e.message);
  }
}
test();
