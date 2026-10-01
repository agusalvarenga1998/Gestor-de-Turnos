# Mejoras implementadas — 1 de octubre de 2026

Cambios locales sobre TurnoHub, priorizando que reservar y atender requiera pocos pasos. No se desplegaron en producción. Las pruebas se hicieron en una base aislada con pacientes ficticios; no se modificaron los registros de la base original.

## Experiencia del paciente y profesional

- Reserva por servicio, día y horario, y luego datos personales. No exige cuenta ni fecha de nacimiento; el domicilio es opcional.
- Recuperación opcional de datos mediante código por correo. Conocer un DNI ya no permite consultar ni sobrescribir información personal.
- Comprobante con enlace privado, estados en español y código completo legible en móvil. Se retiró el teléfono ficticio del consultorio.
- Agenda basada en los horarios configurados por el profesional.
- Registro del saldo cobrado con selección del medio de pago.
- Descarga autenticada de archivos clínicos desde la historia del paciente.
- Inicio de sesión con segundo factor sin perder la pantalla al introducir la contraseña.

## Integridad y privacidad

- Reservas transaccionales y protección contra turnos superpuestos ante solicitudes simultáneas.
- Validaciones de fechas, duración, importes y pertenencia de pacientes, servicios y coberturas al profesional.
- Numeración diaria de sala de espera protegida frente a concurrencia; pantalla pública sin datos personales.
- Archivos clínicos fuera del acceso público directo; WebSocket limitado al profesional y turnos autorizados.
- Revocación de sesiones y verificación efectiva del segundo factor. Tokens separados por propósito y límites de solicitudes en accesos sensibles.
- Eliminación de credenciales incrustadas en los archivos modificados y CORS por orígenes exactos.
- Pagos contrastados con referencia, moneda e importe; recibos idempotentes para evitar duplicaciones.
- Una seña deja el pago parcial cuando existe saldo. Cancelar no registra una devolución inexistente.
- Migración maestra 001 transaccional e idempotente; migraciones 002, 003 y 004 de estabilización. Ejecutar `npm run db:migrate --prefix server` para aplicar el conjunto. El inicializador antiguo se bloquea sobre bases versionadas.
- Cola persistente para confirmaciones, retrasos y rechazos de turnos, con reintentos, vencimiento y contadores administrativos.

## Verificación realizada

| Comprobación | Resultado |
| --- | --- |
| Pruebas unitarias | 4 aprobadas |
| Suite de integración repetible | 29 comprobaciones aprobadas |
| Cola persistente de correos | 10 comprobaciones aprobadas |
| Regresión adicional | 19 comprobaciones aprobadas |
| Flujos adicionales de reserva, recuperación y archivos | 15 comprobaciones aprobadas |
| Pagos simulados y concurrencia | 5 comprobaciones aprobadas |
| Autorización de WebSocket | 4 comprobaciones aprobadas |
| Navegador | Reserva sin cuenta, comprobante privado, segundo factor y agenda comprobados |
| Comprobante móvil | Revisado a 390 × 844, en temas claro y oscuro |
| Compilación del cliente | Correcta, con advertencias pendientes |
| Lint del servidor | Sin errores ni advertencias |
| Revisión de espacios del diff | Sin errores |

Comandos repetibles desde la raíz:

```powershell
npm test --prefix server
npm run lint --prefix server
# Exclusivamente una base de pruebas con el esquema preparado.
$env:TEST_DB_NAME = 'turnohub_audit_20260930'
npm run test:integration --prefix server
npm run test:outbox --prefix server
npm run integrations:check --prefix server
npm run build --prefix client
```

La suite de integración admite únicamente bases con prefijo `turnohub_test_` o `turnohub_audit_`, crea sus propios registros y limpia esos registros al terminar. Los errores SMTP son esperados: se utiliza un puerto local inactivo para impedir envíos reales.

## Pendiente antes de publicar

1. Configurar y validar credenciales y URLs reales: JWT, SMTP, Mercado Pago y secreto de webhook, `BACKEND_URL` y orígenes permitidos. Rotar las credenciales anteriormente incrustadas; retirarlas del código no revoca sus copias históricas.
2. Probar correo, checkout/webhooks, Google y WhatsApp con cuentas de prueba. Las verificaciones locales de pagos usaron respuestas simuladas; no acreditan entrega de correo ni cobros reales.
3. Respaldar la base de destino y revisar datos históricos incompatibles antes de migrar. Se preservaron las filas heredadas; no se conciliaron importes antiguos automáticamente.
4. Los enlaces antiguos basados en identificadores internos o códigos predecibles dejan de ser válidos. Usar los nuevos enlaces privados o la recuperación verificada.
5. Resolver advertencias del cliente antes de exigir compilación con `CI=true`. La compilación normal pasa, pero quedan advertencias de hooks, variables sin uso, dependencia dinámica y Browserslist.

## Desarrollo posterior

- Completar la consolidación del esquema inicial y del DDL heredado del arranque. El inicializador antiguo ya está bloqueado en bases versionadas; la instalación desde una base completamente vacía todavía requiere trabajo y pruebas específicas.
- Extender la cola persistente a recordatorios, avisos al profesional y otros canales. Los códigos de acceso y recuperación siguen por el envío directo para respetar su caducidad.
- Ampliar la automatización de recorridos visuales e integraciones externas e incorporarla al proceso de publicación.

Estos pendientes distinguen la estabilización local comprobada de una validación completa de producción.

## Segunda etapa: operación y publicación

La migración maestra ahora utiliza una transacción y el mismo bloqueo de las migraciones de estabilización. Registra su versión únicamente al finalizar y detecta el tipo real de `services.id` para crear la cobertura compatible. Se comprobó su ejecución repetida sin cambios duplicados y el rechazo de `db:init` sobre una base versionada.

Los avisos de confirmación, retraso y rechazo se guardan en PostgreSQL. El procesador toma cada aviso con bloqueo, reintenta errores temporales con espera creciente y recupera trabajos abandonados al vencer su concesión. Hay un máximo de ocho intentos; los rechazos permanentes de destinatario no se reintentan. Los avisos de retraso vencen en una hora; el resto, en 24 horas. Se elimina el cuerpo privado al enviar, agotar intentos o vencer, y se retira el registro terminal después de siete días. `EMAIL_WORKER_ENABLED=false` pausa el procesador de ese servidor y se muestra en administración.

La cola distingue «guardado para enviar» de «enviado». Como SMTP no ofrece una transacción compartida con PostgreSQL, una caída entre la aceptación del correo y su registro puede producir un duplicado: se conserva un Message-ID estable, pero no se promete entrega exactamente una vez. Algunos productores todavía llaman a la función después del commit; la cola protege el aviso una vez persistido, no el intervalo anterior a su inserción.

El diagnóstico local de configuración, sin contactar proveedores ni revelar secretos, encontró:

- SMTP y Google: variables presentes; autenticidad, conectividad y recorridos externos sin verificar.
- Mercado Pago: falta `MP_WEBHOOK_SECRET`.
- Falta `BACKEND_URL`; `FRONTEND_URL` apunta a una dirección local o sin HTTPS.
- WhatsApp: ningún proveedor completamente configurado.

No se hicieron cobros ni se enviaron mensajes reales. Para la siguiente etapa, completar esas variables en el entorno de pruebas y ejecutar los recorridos con cuentas de prueba antes de publicar.
