import axios from 'axios';

const testLogin = async () => {
  try {
    console.log('🔐 Probando login...\n');
    
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'doctor@example.com',
      password: 'password123'
    });

    console.log('✅ Login exitoso!');
    console.log('Respuesta:', {
      success: response.data.success,
      message: response.data.message,
      token: response.data.token ? response.data.token.substring(0, 20) + '...' : 'NO TOKEN',
      doctor: response.data.doctor
    });
  } catch (error) {
    console.error('❌ Error en login:');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.response?.data?.message);
    console.error('Data:', error.response?.data);
  }
};

testLogin();
