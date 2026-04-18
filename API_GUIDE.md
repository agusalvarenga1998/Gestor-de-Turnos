# 📚 Guía de API - Sistema de Gestión de Turnos Médicos

## 🚀 Inicio Rápido

### Requisitos Previos
1. **PostgreSQL** debe estar instalado y corriendo
2. **Node.js** v18+
3. **npm** o **yarn**

### Instalación y Setup

#### 1. Instalar dependencias
```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

#### 2. Crear base de datos
```bash
cd server
npm run db:init
```

#### 3. Cargar datos de prueba (Opcional)
```bash
npm run db:seed
```

Esto crea:
- **Doctor de prueba:**
  - Email: `doctor@example.com`
  - Contraseña: `password123`
- **3 pacientes de prueba**
- **Disponibilidades:** Lunes a Viernes 09:00-17:00
- **Citas de prueba:** Para hoy

#### 4. Ejecutar en desarrollo
```bash
# Terminal 1 - Backend
cd server
npm run dev
# Escuchará en http://localhost:5000

# Terminal 2 - Frontend
cd client
npm start
# Abrirá http://localhost:3000
```

---

## 🔐 Autenticación

### Login
```http
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "doctor@example.com",
  "password": "password123"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Login exitoso",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "doctor": {
    "id": "doctor-001",
    "email": "doctor@example.com",
    "name": "Dr. Juan Pérez",
    "specialization": "Cardiología",
    "clinic_name": "Clínica La Salud"
  }
}
```

### Registrar Doctor
```http
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "email": "nuevo@example.com",
  "password": "segura123",
  "name": "Dra. María González",
  "specialization": "Pediatría",
  "clinic_name": "Clínica Nueva"
}
```

### Verificar Token
```http
GET http://localhost:5000/api/auth/verify
Authorization: Bearer {token}
```

---

## 📅 Endpoints de Citas

### Crear Cita
```http
POST http://localhost:5000/api/appointments
Authorization: Bearer {token}
Content-Type: application/json

{
  "patientId": "patient-001",
  "appointment_date": "2024-04-20",
  "appointment_time": "14:30",
  "end_time": "15:00",
  "reason_for_visit": "Chequeo de control"
}
```

### Obtener Todas las Citas
```http
GET http://localhost:5000/api/appointments
Authorization: Bearer {token}
```

**Con filtros:**
```http
GET http://localhost:5000/api/appointments?date=2024-04-20&status=scheduled
Authorization: Bearer {token}
```

### Obtener Citas de Hoy
```http
GET http://localhost:5000/api/appointments/today
Authorization: Bearer {token}
```

### Obtener Detalle de Cita
```http
GET http://localhost:5000/api/appointments/{appointmentId}
Authorization: Bearer {token}
```

### Actualizar Cita
```http
PATCH http://localhost:5000/api/appointments/{appointmentId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "completed",
  "delay_minutes": 10,
  "notes": "Paciente controlado, todo bien"
}
```

### Cancelar Cita
```http
DELETE http://localhost:5000/api/appointments/{appointmentId}
Authorization: Bearer {token}
```

### Obtener Slots Disponibles
```http
GET http://localhost:5000/api/appointments/available-slots?date=2024-04-20
Authorization: Bearer {token}
```

### Estadísticas de Citas
```http
GET http://localhost:5000/api/appointments/statistics?startDate=2024-04-01&endDate=2024-04-30
Authorization: Bearer {token}
```

---

## 👥 Endpoints de Pacientes

### Crear Paciente
```http
POST http://localhost:5000/api/patients
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Juan López García",
  "email": "juan@example.com",
  "phone": "+56912345678",
  "date_of_birth": "1990-05-15",
  "gender": "M",
  "address": "Calle Principal 456"
}
```

### Obtener Pacientes
```http
GET http://localhost:5000/api/patients
Authorization: Bearer {token}
```

**Con búsqueda:**
```http
GET http://localhost:5000/api/patients?search=juan
Authorization: Bearer {token}
```

### Buscar Pacientes
```http
GET http://localhost:5000/api/patients/search?q=lopez
Authorization: Bearer {token}
```

### Obtener Detalle de Paciente
```http
GET http://localhost:5000/api/patients/{patientId}
Authorization: Bearer {token}
```

Incluye:
- Datos del paciente
- Historial de citas
- Estadísticas

### Actualizar Paciente
```http
PATCH http://localhost:5000/api/patients/{patientId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Juan López García",
  "phone": "+56912345679",
  "medical_history": "Hipertensión controlada"
}
```

### Eliminar Paciente
```http
DELETE http://localhost:5000/api/patients/{patientId}
Authorization: Bearer {token}
```

### Obtener Pacientes Inactivos
```http
GET http://localhost:5000/api/patients/inactive?daysThreshold=90
Authorization: Bearer {token}
```

---

## ⏰ Endpoints de Disponibilidad

### Crear Disponibilidad
```http
POST http://localhost:5000/api/availability
Authorization: Bearer {token}
Content-Type: application/json

{
  "day_of_week": 1,
  "start_time": "08:00",
  "end_time": "18:00"
}
```

**Días:**
- 0 = Domingo
- 1 = Lunes
- 2 = Martes
- 3 = Miércoles
- 4 = Jueves
- 5 = Viernes
- 6 = Sábado

### Obtener Disponibilidades
```http
GET http://localhost:5000/api/availability
Authorization: Bearer {token}
```

### Actualizar Disponibilidad
```http
PATCH http://localhost:5000/api/availability/{availabilityId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "start_time": "09:00",
  "end_time": "17:00",
  "is_available": true
}
```

### Eliminar Disponibilidad
```http
DELETE http://localhost:5000/api/availability/{availabilityId}
Authorization: Bearer {token}
```

---

## 🏖️ Endpoints de Vacaciones

### Agregar Vacación
```http
POST http://localhost:5000/api/availability/vacations
Authorization: Bearer {token}
Content-Type: application/json

{
  "start_date": "2024-07-01",
  "end_date": "2024-07-15",
  "reason": "Vacaciones de verano"
}
```

### Obtener Vacaciones
```http
GET http://localhost:5000/api/availability/vacations
Authorization: Bearer {token}
```

### Obtener Vacaciones Activas
```http
GET http://localhost:5000/api/availability/vacations/active
Authorization: Bearer {token}
```

### Eliminar Vacación
```http
DELETE http://localhost:5000/api/availability/vacations/{vacationId}
Authorization: Bearer {token}
```

---

## 🏥 Endpoints del Doctor

### Obtener Perfil
```http
GET http://localhost:5000/api/doctor/profile
Authorization: Bearer {token}
```

### Actualizar Perfil
```http
PATCH http://localhost:5000/api/doctor/profile
Authorization: Bearer {token}
Content-Type: application/json

{
  "phone": "+56912345678",
  "clinic_name": "Clínica Nueva Salud",
  "clinic_address": "Calle Nueva 789"
}
```

### Dashboard
```http
GET http://localhost:5000/api/doctor/dashboard
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "stats": {
    "total_appointments": 45,
    "total_patients": 20,
    "appointments_today": 5,
    "pending_appointments": 3,
    "completed_appointments": 35,
    "cancelled_appointments": 7
  }
}
```

---

## 🧪 Pruebas con cURL

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor@example.com",
    "password": "password123"
  }'
```

### Obtener Citas
```bash
TOKEN="tu_token_aqui"
curl -X GET http://localhost:5000/api/appointments \
  -H "Authorization: Bearer $TOKEN"
```

### Crear Cita
```bash
TOKEN="tu_token_aqui"
curl -X POST http://localhost:5000/api/appointments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "patientId": "patient-001",
    "appointment_date": "2024-04-20",
    "appointment_time": "14:30",
    "end_time": "15:00",
    "reason_for_visit": "Control de salud"
  }'
```

---

## 📊 Estructura de Datos

### Doctor
```json
{
  "id": "uuid",
  "email": "string",
  "name": "string",
  "specialization": "string",
  "phone": "string",
  "clinic_name": "string",
  "clinic_address": "string",
  "profile_image_url": "string",
  "is_active": boolean,
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### Paciente
```json
{
  "id": "uuid",
  "doctor_id": "uuid",
  "name": "string",
  "email": "string",
  "phone": "string",
  "date_of_birth": "date",
  "gender": "M|F|O",
  "address": "string",
  "medical_history": "text",
  "is_active": boolean,
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### Cita
```json
{
  "id": "uuid",
  "doctor_id": "uuid",
  "patient_id": "uuid",
  "appointment_date": "date",
  "appointment_time": "time",
  "end_time": "time",
  "status": "scheduled|completed|cancelled",
  "reason_for_visit": "string",
  "notes": "text",
  "delay_minutes": "integer",
  "queue_position": "integer",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

---

## ✅ Errores Comunes

### 401 - Unauthorized
```json
{
  "success": false,
  "message": "Token inválido o expirado"
}
```
**Solución:** Verifica que el token sea válido y esté en el header `Authorization: Bearer {token}`

### 403 - Forbidden
```json
{
  "success": false,
  "message": "Acceso denegado. Solo doctores pueden acceder a este recurso."
}
```
**Solución:** El usuario no tiene rol de doctor

### 404 - Not Found
```json
{
  "success": false,
  "message": "Paciente no encontrado"
}
```
**Solución:** Verifica que el ID sea correcto

### 400 - Bad Request
```json
{
  "success": false,
  "message": "Ya existe una cita en ese horario"
}
```
**Solución:** Verifica los datos enviados

---

## 🔗 Próximos Pasos

1. **WebSocket para Tiempo Real** - Actualizaciones automáticas de citas
2. **Panel Doctor Frontend** - Interfaz para gestionar turnos
3. **Portal Paciente** - Visualización sin login
4. **Testing y Optimizaciones**
5. **Deploy a Producción**

¡Listo para probar! 🚀
