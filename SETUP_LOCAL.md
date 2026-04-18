# 🚀 Guía de Setup Local - Sistema de Gestión de Turnos Médicos

## ✅ Requisitos Previos

Antes de comenzar, verifica que tengas instalado:

### 1. Node.js y npm
```bash
node --version  # Debe ser v18+
npm --version
```
**Si no lo tienes:** https://nodejs.org/

### 2. PostgreSQL
```bash
psql --version  # Debe ser PostgreSQL 13+
```
**Si no lo tienes:** https://www.postgresql.org/download/

## 📋 Pasos de Instalación

### Paso 1: Instalar Dependencias del Backend

```bash
cd server
npm install
```

### Paso 2: Instalar Dependencias del Frontend

```bash
cd ../client
npm install
```

### Paso 3: Configurar Base de Datos PostgreSQL

Abre pgAdmin o ejecuta en terminal:

```bash
psql -U postgres
```

Luego crea la base de datos:

```sql
CREATE DATABASE consultorio_medico;
\c consultorio_medico
```

**Opcional:** Crear usuario específico
```sql
CREATE USER doctor_app WITH PASSWORD 'tu_contraseña';
ALTER ROLE doctor_app WITH CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE consultorio_medico TO doctor_app;
```

### Paso 4: Configurar Variables de Entorno

#### Backend (server/.env)

```bash
# Configuración del Servidor
NODE_ENV=development
PORT=5000
HOST=localhost

# Base de Datos PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=consultorio_medico
DB_USER=postgres
DB_PASSWORD=tu_contraseña_postgres

# JWT Authentication
JWT_SECRET=tu_clave_secreta_super_segura_cambiar_en_produccion
JWT_EXPIRES_IN=24h

# WebSocket
WS_PORT=5001

# CORS
CORS_ORIGIN=http://localhost:3000

# Email (opcional por ahora)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASSWORD=tu_app_password

# Encriptación
ENCRYPTION_KEY=01234567890123456789012345678901

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=debug
```

#### Frontend (client/.env)

```bash
REACT_APP_API_BASE_URL=http://localhost:5000/api
REACT_APP_WS_URL=ws://localhost:5001
```

### Paso 5: Inicializar la Base de Datos

```bash
cd server
npm run db:init
npm run db:seed
```

Esto creará las tablas y cargará datos de prueba.

## 🎯 Credenciales de Prueba (después del seed)

**Doctor:**
- Email: `doctor@example.com`
- Contraseña: `password123`

**Paciente (Portal):**
- Código de turno: `TURNO001` (o similar, lo ves en los datos de prueba)

## 🚀 Ejecutar el Sistema

### En Terminal 1 - Backend

```bash
cd server
npm run dev
```

Deberías ver:
```
✅ Servidor ejecutándose en http://localhost:5000
✅ WebSocket en ws://localhost:5001
✅ Base de datos conectada
```

### En Terminal 2 - Frontend

```bash
cd client
npm start
```

Esto abrirá automáticamente http://localhost:3000 en tu navegador.

## 🧪 Prueba Rápida

1. **Panel Doctor:**
   - Ve a http://localhost:3000/login
   - Ingresa: `doctor@example.com` / `password123`
   - Deberías ver el dashboard

2. **Portal Paciente:**
   - Ve a http://localhost:3000/patient
   - Ingresa un código de turno (ej: `TURNO001`)
   - Verás el estado en tiempo real

## 📊 Verificar Conexiones

### ✅ Backend está corriendo
```bash
curl http://localhost:5000/api/health
```

### ✅ Frontend está corriendo
```bash
curl http://localhost:3000
```

### ✅ WebSocket está corriendo
```bash
# En consola del navegador, en http://localhost:3000
# Deberías ver el estado de conexión WebSocket
```

## 🛠️ Troubleshooting

### "Error: connect ECONNREFUSED 127.0.0.1:5432"
- PostgreSQL no está corriendo
- Solución: Abre pgAdmin o ejecuta `pg_ctl start`

### "Error: password authentication failed"
- Contraseña de PostgreSQL incorrecta
- Solución: Verifica tu contraseña en server/.env

### "Port 5000 already in use"
- Otro proceso usa el puerto 5000
- Solución: `netstat -ano | findstr :5000` (Windows) y mata el proceso

### "Port 3000 already in use"
- Otro React está corriendo
- Solución: Mata el proceso anterior o usa un puerto diferente

### "CORS error en consola"
- Frontend y backend en puertos diferentes es normal
- Verifica CORS_ORIGIN en server/.env = http://localhost:3000

## 📁 Estructura de Carpetas

```
ConsultorioMedico/
├── server/              # Backend Express + PostgreSQL
│   ├── src/
│   ├── .env
│   └── package.json
├── client/              # Frontend React
│   ├── src/
│   ├── .env
│   └── package.json
└── SETUP_LOCAL.md       # Este archivo
```

## 🎓 Comandos Útiles

```bash
# Backend
cd server
npm run dev              # Modo desarrollo
npm run db:init        # Crear tablas
npm run db:seed        # Cargar datos de prueba
npm run db:reset       # Limpiar y recrear BD (⚠️ borra datos)

# Frontend
cd client
npm start               # Modo desarrollo
npm run build           # Build para producción
npm test                # Ejecutar tests
```

## 📝 Notas Importantes

- **Desarrollo:** Usa `npm run dev` para que se recompile automáticamente
- **Hot Reload:** React y Node.js tienen hot reload habilitado
- **Base de datos:** Los datos de prueba se cargan solo la primera vez
- **WebSocket:** Se reconecta automáticamente si se pierde la conexión
- **JWT:** Token válido por 24 horas, se guarda en localStorage

## ✨ ¿Todo funcionando?

Si ves:
- ✅ Dashboard del doctor con datos
- ✅ Portal de paciente cargando turno
- ✅ Actualizaciones en tiempo real
- ✅ Sin errores en consola

**¡Felicidades! 🎉 Tu sistema está corriendo perfectamente.**

---

**¿Necesitas ayuda?** Revisa los logs en la terminal del backend y la consola del navegador (F12).
