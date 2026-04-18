# 🏥 Sistema de Gestión de Turnos Médicos

Sistema web moderno para la gestión eficiente de turnos médicos, permitiendo que doctores administren sus citas y pacientes vean el estado de sus turnos en tiempo real.

## 📋 Tabla de Contenidos

- [Características](#características)
- [Requisitos Previos](#requisitos-previos)
- [Instalación](#instalación)
- [Desarrollo](#desarrollo)
- [Arquitectura](#arquitectura)
- [Seguridad](#seguridad)

## ✨ Características

### Panel Doctor
- Login seguro con JWT
- Dashboard con vista de turnos
- Gestión de citas (crear, editar, cancelar)
- Base de datos de pacientes
- Control en tiempo real
- Reportes y estadísticas

### Portal Paciente
- Acceso sin login (solo código del turno)
- Estado del turno en tiempo real
- Posición en la cola de espera
- Contador de demora automático
- Notificaciones automáticas

### Backend
- API REST completa
- WebSocket para sincronización en tiempo real
- Autenticación JWT
- Encriptación de datos sensibles
- Rate limiting
- HIPAA compliance

## 🔧 Requisitos Previos

- Node.js v18+
- PostgreSQL 13+
- npm o yarn
- Git

## 📦 Instalación

### 1. Clonar repositorio
```bash
git clone <repository-url>
cd ConsultorioMedico
```

### 2. Instalar dependencias

**Backend:**
```bash
cd server
npm install
```

**Frontend:**
```bash
cd ../client
npm install
```

### 3. Configurar variables de entorno

**Backend (.env):**
```bash
cp server/.env.example server/.env
# Editar server/.env con tus valores
```

**Frontend (.env):**
```bash
cp client/.env.example client/.env
# Editar client/.env con tus valores
```

### 4. Crear base de datos
```bash
cd server
npm run db:init
```

## 🚀 Desarrollo

### Ejecutar en modo desarrollo

**Backend (en terminal 1):**
```bash
cd server
npm run dev
# Servidor en http://localhost:5000
```

**Frontend (en terminal 2):**
```bash
cd client
npm start
# Aplicación en http://localhost:3000
```

## 🏗️ Arquitectura

```
ConsultorioMedico/
├── server/                    # Backend (Node.js + Express)
│   ├── src/
│   │   ├── controllers/      # Controladores
│   │   ├── models/           # Modelos de BD
│   │   ├── routes/           # Rutas API
│   │   ├── middleware/       # Middleware
│   │   ├── utils/            # Utilidades
│   │   ├── websocket/        # WebSocket handlers
│   │   └── app.js            # App principal
│   ├── .env.example
│   └── package.json
│
├── client/                    # Frontend (React)
│   ├── public/
│   ├── src/
│   │   ├── components/       # Componentes React
│   │   ├── pages/            # Páginas
│   │   ├── hooks/            # Custom hooks
│   │   ├── utils/            # Utilidades
│   │   ├── context/          # Context API
│   │   ├── App.js
│   │   └── index.js
│   ├── .env.example
│   └── package.json
│
├── .gitignore
└── README.md
```

## 🔐 Seguridad

- ✅ HTTPS/SSL obligatorio
- ✅ Autenticación JWT
- ✅ Contraseñas hasheadas (bcrypt)
- ✅ Validación de entrada
- ✅ Rate limiting
- ✅ HIPAA compliance
- ✅ Backups encriptados

## 📝 Licencia

Todos los derechos reservados.

---

**Estado:** 🚀 En desarrollo  
**Última actualización:** Abril 2026
