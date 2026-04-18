import axios from 'axios';

// Usa ruta relativa para que funcione con proxy
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
  }
});

// Configurar axios globalmente para las llamadas directas que no usan apiClient
axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';

// Interceptor para agregar token a las solicitudes
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Servicios de Autenticación
export const authAPI = {
  login: async (email, password) => {
    const response = await apiClient.post('/api/auth/login', {
      email,
      password
    });
    return response.data;
  },

  register: async (data) => {
    const response = await apiClient.post('/api/auth/register', data);
    return response.data;
  },

  verify: async (token) => {
    const response = await apiClient.get('/api/auth/verify', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  },

  logout: async (token) => {
    const response = await apiClient.post('/api/auth/logout', {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }
};

// Servicios de Doctor (próximamente)
export const doctorAPI = {
  getProfile: async () => {
    const response = await apiClient.get('/api/doctor/profile');
    return response.data;
  },

  updateProfile: async (data) => {
    const response = await apiClient.patch('/api/doctor/profile', data);
    return response.data;
  },

  getDashboard: async () => {
    const response = await apiClient.get('/api/doctor/dashboard');
    return response.data;
  },

  getWorkingHours: async () => {
    const response = await apiClient.get('/api/doctor/working-hours');
    return response.data;
  },

  updateWorkingHours: async (workingHours) => {
    const response = await apiClient.post('/api/doctor/working-hours', { availability: workingHours });
    return response.data;
  }
};

// Servicios de Appointments (próximamente)
export const appointmentAPI = {
  getAppointments: async () => {
    const response = await apiClient.get('/api/appointments');
    return response.data;
  },

  createAppointment: async (data) => {
    const response = await apiClient.post('/api/appointments', data);
    return response.data;
  },

  updateAppointment: async (appointmentId, data) => {
    const response = await apiClient.patch(`/api/appointments/${appointmentId}`, data);
    return response.data;
  },

  getAvailableSlots: async (date) => {
    const response = await apiClient.get(`/api/appointments/available-slots?date=${date}`);
    return response.data;
  },

  getByToken: async (token) => {
    // Esta llamada no requiere autenticación
    const response = await axios.get(`${API_BASE_URL}/api/appointments/public/${token}`);
    return response.data;
  },

  searchByPatientData: async (searchData) => {
    // Esta llamada no requiere autenticación - busca por datos del paciente
    const response = await axios.post(`${API_BASE_URL}/api/appointments/public/search`, searchData);
    return response.data;
  },

  getPublicSpecializations: async () => {
    // Obtener especialidades disponibles (sin autenticación)
    const response = await axios.get(`${API_BASE_URL}/api/appointments/public/specializations`);
    return response.data;
  },

  getPublicDoctors: async (specialization) => {
    // Obtener médicos por especialidad (sin autenticación)
    const response = await axios.get(`${API_BASE_URL}/api/appointments/public/doctors/${encodeURIComponent(specialization)}`);
    return response.data;
  },

  getPublicAvailableSlots: async (doctorId, date, duration = 30) => {
    // Obtener horarios disponibles (sin autenticación)
    const response = await axios.get(`${API_BASE_URL}/api/appointments/public/available-slots/${doctorId}/${date}?duration=${duration}`);
    return response.data;
  },
  getPublicServices: async (doctorId) => {
    // Obtener servicios de un doctor (sin autenticación)
    const response = await axios.get(`${API_BASE_URL}/api/services/doctor/${doctorId}`);
    return response.data;
  },
  getDoctorAvailability: async (doctorId) => {
    // Obtener días de atención y vacaciones (sin autenticación)
    const response = await axios.get(`${API_BASE_URL}/api/appointments/public/doctor/${doctorId}/availability`);
    return response.data;
  },

  updateDelay: async (appointmentId, data) => {
    const response = await apiClient.patch(`/api/appointments/${appointmentId}/delay`, data);
    return response.data;
  },

  createPublicAppointment: async (data) => {
    // Esta llamada no requiere autenticación - crea un turno desde el portal público
    const response = await axios.post(`${API_BASE_URL}/api/appointments/public/create`, data);
    return response.data;
  },

  cancelPublic: async (token) => {
    // Esta llamada no requiere autenticación - permite al paciente cancelar su turno
    const response = await axios.post(`${API_BASE_URL}/api/appointments/public/${token}/cancel`);
    return response.data;
  },

  acceptAppointment: async (appointmentId) => {
    const response = await apiClient.patch(`/api/appointments/${appointmentId}/accept`);
    return response.data;
  },

  rejectAppointment: async (appointmentId, reason = '') => {
    const response = await apiClient.patch(`/api/appointments/${appointmentId}/reject`, {
      reason
    });
    return response.data;
  }
};

// Servicios de Patients (próximamente)
export const patientAPI = {
  getPatients: async () => {
    const response = await apiClient.get('/api/patients');
    return response.data;
  },

  createPatient: async (data) => {
    const response = await apiClient.post('/api/patients', data);
    return response.data;
  },

  getPatient: async (patientId) => {
    const response = await apiClient.get(`/api/patients/${patientId}`);
    return response.data;
  },

  updatePatient: async (patientId, data) => {
    const response = await apiClient.patch(`/api/patients/${patientId}`, data);
    return response.data;
  },

  deletePatient: async (patientId) => {
    const response = await apiClient.delete(`/api/patients/${patientId}`);
    return response.data;
  }
};

// Google Calendar Integration
export const googleAPI = {
  getStatus: async () => {
    const response = await apiClient.get('/api/google/status');
    return response.data;
  },

  connect: () => {
    window.location.href = `${API_BASE_URL}/api/google/auth`;
  },

  disconnect: async () => {
    const response = await apiClient.post('/api/google/disconnect');
    return response.data;
  }
};

// Servicios de Obras Sociales
export const insuranceAPI = {
  getInsurances: async () => {
    const response = await apiClient.get('/api/insurance');
    return response.data;
  },

  createInsurance: async (data) => {
    const response = await apiClient.post('/api/insurance', data);
    return response.data;
  },

  updateInsurance: async (id, data) => {
    const response = await apiClient.patch(`/api/insurance/${id}`, data);
    return response.data;
  },

  deleteInsurance: async (id) => {
    const response = await apiClient.delete(`/api/insurance/${id}`);
    return response.data;
  },

  getPatientInsurances: async (patientId) => {
    const response = await apiClient.get(`/api/insurance/patient/${patientId}`);
    return response.data;
  },

  setPatientInsurances: async (patientId, insuranceIds) => {
    const response = await apiClient.put(`/api/insurance/patient/${patientId}`, {
      insuranceIds
    });
    return response.data;
  },

  getPublicInsurances: async (doctorId) => {
    // Usamos axios directamente para rutas públicas sin token
    const response = await axios.get(`${API_BASE_URL}/api/insurance/public/doctor/${doctorId}`);
    return response.data;
  }
};

export default apiClient;
