# Revisión de producción — 5 de noviembre de 2026

Revisión estática de rutas, autenticación, suscripciones, pagos, cola virtual, acceso a pacientes y adjuntos, migraciones y cliente. Se ejecutaron pruebas unitarias, comprobación de sintaxis de JavaScript del servidor y compilación del cliente. No equivale a una certificación de todos los flujos: no se conectó a la base productiva ni se hicieron cobros, envíos o despliegues.

## Problemas corregidos en esta revisión

| Problema | Cambio |
| --- | --- |
| Retornos de OAuth aceptaban el ID del profesional o administrador como estado sin autenticarlo | Estado firmado, con vencimiento y cookie HttpOnly vinculada al navegador; separación de proveedor y destino |
| Google login no tenía comprobación de estado | Validación del retorno antes de intercambiar códigos; distinguir login de vinculación del calendario incluso con callback compartido |
| Inicio de vinculación admitía JWT de otros propósitos y sesiones revocadas | Reutilizar validación de sesión del profesional, incluyendo estado y versión de token |
| Renovación podía seguir bloqueada por el estado viejo del JWT | Consultar la suscripción actual; reutilizar la comprobación dentro de cada petición |
| Algunas rutas solo revisaban el vencimiento que decía el token | Verificación de suscripción en DB desde verifyDoctorRole |
| Comprobación de vencimiento podía sobrescribir una renovación concurrente | UPDATE condicionado a que la cuenta siga vencida en DB |
| Aprobación manual hacía cambios separados y podía competir con otra aprobación o pago | Transacción y bloqueo de la solicitud pendiente; extensión de 30 días conservando vigencia remanente, como el pago automático |
| WebSocket terminaba conexiones sanas | Registrar respuestas pong para el heartbeat |
| Fallo de DB permitía acceder a funciones restringidas por plan | Responder 503 al no poder verificar permisos |
| Un vendedor desactivado podía seguir operando con un JWT anterior | Consultar is_active en cada petición autenticada |
| Lectura privada de planes de obra social sin comprobar propietario | Comprobar doctor_id antes de devolver planes |
| Se podía solicitar un plan deshabilitado conociendo su ID | Filtrar is_enabled en ambas rutas de suscripción |

Se conserva también la corrección previa del importe: `$24.999` se guarda como `24999`; los formatos inválidos se rechazan y el importe normalizado se usa en Mercado Pago.

## Puntos pendientes de validación y decisiones

1. **Integración de OAuth:** probar login Google, vinculación del calendario, Mercado Pago del profesional y del administrador en un entorno de prueba con el mismo dominio y callbacks que producción. Los flujos iniciados antes del despliegue deben reiniciarse porque el estado antiguo se rechaza. Las cuentas ya vinculadas no requieren migración por estos cambios.
2. **Base de datos:** falta verificar con PostgreSQL aislado la aprobación concurrente, rollback ante fallos, renovaciones simultáneas y los scripts de integración existentes. No ejecutar estos scripts apuntando a producción para esta verificación.
3. **Plan por comisión:** el catálogo contiene precio `3%`, que no es un importe fijo. El parser lo rechaza deliberadamente; falta definir el importe y la vigencia de su activación manual. No convertir `3%` en un cobro de tres pesos ni asumir importe cero sin definir la regla comercial.
4. **Solicitudes repetidas:** la ruta manual permite crear varias solicitudes pendientes del mismo plan. Antes de imponer unicidad conviene distinguir reintentos, cambios de plan y preferencias de Mercado Pago fallidas, ya que comparten tabla y estado.
5. **Arranque:** app.js ejecuta DDL y carga de catálogo después de abrir el puerto HTTP. Esto permite servir peticiones mientras termina esa preparación y solo registra el error si falla. Su traslado a migraciones versionadas requiere probar un arranque limpio y una actualización desde el esquema real.
6. **Push:** si faltan las claves VAPID persistentes, el servidor genera otras. En un entorno con disco efímero un reinicio puede invalidar suscripciones existentes. Verificar las variables configuradas en Render; no se inspeccionaron secretos.
7. **Carga de archivos:** hay importaciones XLSX con multer.memoryStorage sin límite explícito de archivo. Conviene definir un límite conforme al tamaño real de los catálogos antes de aplicarlo para evitar rechazar importaciones válidas.
8. **Cliente:** la compilación termina con advertencias de hooks, variables sin usar, dependencia dinámica y datos antiguos de Browserslist. No se cambiaron masivamente dependencias ni hooks por el riesgo de alterar comportamiento sin pruebas de interfaz.

## Verificación realizada

- 11 pruebas unitarias aprobadas: importes, firma de pagos, fechas, duración, estado OAuth y acceso después de renovar/vencer. Las pruebas de suscripción sustituyen la DB; no prueban SQL real.
- Comprobación de sintaxis de los archivos JavaScript del servidor; repetir sobre los últimos archivos modificados antes de entregar.
- Compilación de producción del cliente completada con advertencias.
- Sin nuevas dependencias ni cambios de esquema para las correcciones aplicadas.
- Se respetaron las modificaciones previas del dashboard de vendedores; en seller.js solo se añadió la comprobación de cuenta activa.

Antes de publicar, validar las integraciones anteriores en una instancia de prueba. Esta revisión no incluye una auditoría completa de dependencias, pruebas de carga o verificación de la configuración de infraestructura productiva.
