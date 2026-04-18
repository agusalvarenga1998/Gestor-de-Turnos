const WebSocket = require('ws');

const url = 'ws://127.0.0.1:5002';
console.log(`🔍 Probando conexión a ${url}...`);

const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('✅ ¡ÉXITO! Conexión directa establecida al backend.');
  ws.close();
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('❌ ERROR FATAL en conexión directa:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('⏳ Tiempo de espera agotado (10s)');
  process.exit(1);
}, 10000);
