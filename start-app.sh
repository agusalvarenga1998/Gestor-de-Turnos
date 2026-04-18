#!/bin/bash

echo "🚀 Iniciando Sistema de Gestión de Turnos Médicos"
echo ""
echo "Este script inicia el backend y frontend"
echo "Para detener, presiona Ctrl+C"
echo ""

# Iniciar backend en una subshell
echo "🔧 Iniciando Backend en puerto 5002..."
(cd server && npm run dev) &
BACKEND_PID=$!

# Esperar a que el backend esté listo
sleep 5

# Iniciar frontend en otra subshell
echo "⚛️  Iniciando Frontend en puerto 3000..."
(cd client && npm start) &
FRONTEND_PID=$!

echo ""
echo "✅ Sistema iniciado:"
echo "   Backend:  http://localhost:5002"
echo "   Frontend: http://localhost:3000"
echo "   WebSocket: ws://localhost:5001"
echo ""
echo "Presiona Ctrl+C para detener todo"
echo ""

# Esperar a que se presione Ctrl+C
wait
