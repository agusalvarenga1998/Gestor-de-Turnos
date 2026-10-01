# Evaluación de TurnoHub — 30 de septiembre de 2026

## Mi opinión

TurnoHub tiene una propuesta útil y bastante más desarrollada que una agenda básica: integra pacientes, servicios, reservas públicas, historia clínica, convenios, caja, fila virtual, administración y ventas. La navegación es reconocible, la identidad visual es consistente y el portal directo del profesional reduce pasos.

El principal problema es la distancia entre la amplitud de funciones y la solidez de sus controles. Encontré fallos reproducibles de privacidad, autenticación, reservas, fechas, caja y concurrencia. Antes de incorporar funcionalidades o ampliar el uso con datos reales, dedicaría una etapa a estabilizar el producto y verificar estos controles.

## Alcance y método

- Revisión del código de frontend, API, autenticación, autorizaciones, disponibilidad, pacientes, registros clínicos, fila, pagos, notificaciones, esquema de datos y configuración de arranque.
- 65 comprobaciones registradas en tres archivos de resultados. Son observaciones de pruebas preparadas para esta revisión; no representan una suite de regresión completa ni 65 pruebas aprobadas.
- Entorno local con PostgreSQL: base independiente `turnohub_audit_20260930`, creada copiando exclusivamente el esquema de las 24 tablas locales. No se copiaron pacientes ni cuentas existentes.
- Profesionales A/B, administrador, vendedor y pacientes sintéticos para comprobar separación entre cuentas.
- Ejecución de comandos de tests, lint y compilación. Arranque local de backend y frontend.
- Recorrido visual de landing, acceso profesional, dashboard, agenda y formulario, pacientes, historia clínica, servicios, estadísticas, caja, convenios, horarios, notificaciones, configuración, fila y portal público. Login y recorrido de las ocho secciones administrativas. Login de vendedor.
- Reserva completada desde el navegador para un paciente sintético existente, con pago en el local. Inspección del portal a 390 × 844.
- Prueba aislada del webhook con respuesta simulada del SDK de Mercado Pago y prueba de distribución de mensajes WebSocket con conexiones simuladas.
- SMTP dirigido a un puerto local cerrado; integraciones externas sin credenciales operativas en el entorno de prueba. Sin cobros, mensajes, correos ni modificaciones de agendas externas reales.

No se modificó el código funcional. Se conservan scripts, esquema y resultados en la carpeta de auditoría para reproducir lo encontrado. Los scripts generan datos; no deben ejecutarse contra producción.

No se validaron de extremo a extremo Mercado Pago real, OAuth/Google Calendar/Meet, entrega de WhatsApp/email/push, restauración de backups, despliegue productivo, carga sostenida, todas las importaciones ni todos los dispositivos. Tampoco se certifica cumplimiento normativo. La revisión es amplia, pero no equivale a cobertura exhaustiva de cada combinación posible.

## Hallazgos prioritarios

P1 = corregir antes de ampliar el uso real. P2 = corregir durante la estabilización. Se distingue prueba ejecutada de inspección de código.

### 1. P1 — Datos personales accesibles sin verificar al paciente

**Reproducido por HTTP.** `GET /api/appointments/public/patient-details/:doctorId/:documentNumber` devolvió nombre, contacto, fecha de nacimiento, domicilio y datos de cobertura del paciente sintético sin sesión ni código de verificación. Conocer el profesional y el documento basta. El navegador también recuperó esos datos con el botón de búsqueda por DNI.

La reserva pública además actualiza datos de un paciente existente a partir de ese documento, sin una verificación adicional de identidad. Este segundo comportamiento se identificó en el código.

**Cambiaría:** verificación por un canal del paciente, respuestas públicas mínimas y límites de solicitudes. El DNI no debería actuar como contraseña.

Referencia: [appointments.js:263](C:/Users/usuario/Desktop/ConsultorioMedico/server/src/routes/appointments.js:263), [actualización pública:524](C:/Users/usuario/Desktop/ConsultorioMedico/server/src/routes/appointments.js:524).

### 2. P1 — Adjuntos clínicos descargables sin autenticación

**Reproducido por HTTP.** Subí un PDF sintético a la historia clínica; después descargué su URL sin token y recibí HTTP 200 con el contenido. Eliminé el archivo sintético mediante la propia API tras la prueba. Conocer una URL permite recuperar el documento; un nombre difícil de adivinar no reemplaza un permiso.

**Cambiaría:** almacenamiento privado y descarga mediante una ruta que compruebe usuario, profesional y paciente, o enlaces firmados de corta duración cuando corresponda.

Referencia: [app.js:172](C:/Users/usuario/Desktop/ConsultorioMedico/server/src/app.js:172).

### 3. P1 — El segundo factor no se exige en el login normal

**Reproducido por HTTP.** Activé `two_factor_enabled` en una cuenta sintética. El login con email y contraseña devolvió un token completo sin OTP; ese token permitió consultar pacientes. La existencia de una ruta separada para 2FA no protege el login principal.

**Cambiaría:** emitir únicamente un desafío temporal hasta verificar el segundo factor, y bloquear el acceso al resto de la API con ese desafío.

Referencia: [auth.js:255](C:/Users/usuario/Desktop/ConsultorioMedico/server/src/routes/auth.js:255).

### 4. P1 — Cerrar todas las sesiones impide usar nuevos logins

**Reproducido por HTTP.** Después de cerrar todas las sesiones, un nuevo login respondió 200 pero su token recibió 401 al consultar pacientes. El perfil utilizado para firmar el JWT no incluye `token_version`; la firma vuelve al valor 1 aunque la base ya avanzó a 2.

**Cambiaría:** transportar la versión actual en todos los caminos de emisión de tokens y probar login después de logout global y recuperación de contraseña.

Referencias: [perfil:17](C:/Users/usuario/Desktop/ConsultorioMedico/server/src/routes/auth.js:17), [logout global:782](C:/Users/usuario/Desktop/ConsultorioMedico/server/src/routes/auth.js:782), [firma y verificación](C:/Users/usuario/Desktop/ConsultorioMedico/server/src/middleware/auth.js).

### 5. P1 — Suspender al profesional no corta una sesión existente

**Reproducido por HTTP.** Suspendí al profesional B en la base de prueba y su token previo siguió obteniendo pacientes con HTTP 200. El login nuevo sí contempla la suspensión, pero el middleware de las peticiones no la aplica de forma equivalente.

**Cambiaría:** validación central del estado vigente y revocación efectiva de sesiones al suspender.

Referencia: [auth.js del middleware](C:/Users/usuario/Desktop/ConsultorioMedico/server/src/middleware/auth.js:8).

### 6. P1 — Separación incompleta entre profesionales

**Reproducido por HTTP.** La lectura directa de un paciente ajeno devolvió correctamente 404, pero el profesional A pudo crear una cita asociada al paciente del profesional B: HTTP 201. La relación entre IDs debe verificarse también al crear registros, no solo al leerlos.

**Cambiaría:** validar pertenencia de paciente, servicio, convenio, plan y turno en todas las mutaciones. Añadir pruebas sistemáticas entre dos profesionales.

Referencia: [appointmentController.js:99](C:/Users/usuario/Desktop/ConsultorioMedico/server/src/controllers/appointmentController.js:99).

### 7. P1 — Reservas públicas superpuestas, fuera de horario y en el pasado

**Reproducido por HTTP.** Con horario de atención 09:00–17:00 y consulta de 60 minutos a las 10:00, el portal aceptó otra a las 10:30. También aceptó una a las 23:30 y otra fechada en 2020. La creación privada rechazó correctamente el solapamiento, lo que muestra reglas distintas según el punto de entrada.

El índice local evita dos turnos activos con la misma hora de inicio, pero no impide superposición entre duraciones diferentes.

**Cambiaría:** un único servicio transaccional de reservas para ambas entradas, comprobación de fecha, vacaciones, duración y horario, y protección contra concurrencia en la base.

Referencia: [appointments.js:351](C:/Users/usuario/Desktop/ConsultorioMedico/server/src/routes/appointments.js:351), [availabilityService.js](C:/Users/usuario/Desktop/ConsultorioMedico/server/src/services/availabilityService.js:134).

### 8. P1 — El paciente no puede cancelar por la ruta pública

**Reproducido por HTTP.** La cancelación con un token de confirmación válido respondió 401 “Token no proporcionado”. La ruta pública está declarada después de `router.use(verifyToken)`.

**Cambiaría:** ordenar correctamente las rutas y autorizar esta acción mediante un token específico del turno, manteniendo sus reglas de cancelación.

Referencia: [middleware:1129](C:/Users/usuario/Desktop/ConsultorioMedico/server/src/routes/appointments.js:1129), [cancelación:1452](C:/Users/usuario/Desktop/ConsultorioMedico/server/src/routes/appointments.js:1452).

### 9. P1 — Validación insuficiente del webhook de pagos

**Reproducido en prueba aislada con SDK simulado, no con dinero real.** El SDK devolvió un pago aprobado de 1 USD cuya referencia era otra suscripción. El webhook aprobó igualmente la suscripción sintética objetivo de 99.999, guiándose por el ID de la URL y el estado aprobado.

Por inspección, no se observa comprobación de firma ni validación conjunta de referencia, monto y moneda. La rama de suscripciones vuelve a calcular el vencimiento desde la fecha del procesamiento, sin una protección explícita de idempotencia por pago.

**Cambiaría:** validar autenticidad, referencia, cuenta receptora, importe y moneda; guardar un identificador de pago único; procesar cambios en transacción y hacer los reintentos idempotentes.

Referencia: [webhooks.js:10](C:/Users/usuario/Desktop/ConsultorioMedico/server/src/routes/webhooks.js:10).

### 10. P1 — Mensajes privados distribuidos a otros clientes WebSocket

**Reproducido con conexiones simuladas.** Un aviso destinado a un ticket fue recibido por la conexión de otro profesional. `broadcastToAppointment` no utiliza su parámetro para seleccionar destinatarios: recorre todos los clientes autenticados. Además, el servidor real aceptó la suscripción de un profesional al ID de otro, aunque eso por sí solo no demuestra recepción de todos sus eventos.

**Cambiaría:** autorización de suscripciones y destinatarios por recurso, canal público mínimo separado del canal privado y revocación de sesiones también en WebSocket.

Referencia: [server.js:378](C:/Users/usuario/Desktop/ConsultorioMedico/server/src/websocket/server.js:378).

### 11. P1 — Credenciales de respaldo incrustadas en el código

**Inspección de código.** Hay valores de contraseña de base/SMTP, secreto JWT genérico y un token de Mercado Pago usados como respaldo. No se comprobó si esas credenciales externas siguen vigentes, ni se incluyen sus valores en este informe.

**Cambiaría:** eliminar secretos del código, exigir configuración válida al iniciar y rotar los que hayan sido reales. Revisar el historial del repositorio y limitar la exposición de logs con datos de pacientes.

Referencias: [config.js](C:/Users/usuario/Desktop/ConsultorioMedico/server/src/db/config.js), [emailService.js](C:/Users/usuario/Desktop/ConsultorioMedico/server/src/services/emailService.js), [webhooks.js](C:/Users/usuario/Desktop/ConsultorioMedico/server/src/routes/webhooks.js).

### 12. P1 — Fila virtual incompatible con el esquema local

**Reproducido por HTTP y navegador.** Obtener la fila respondió 500; llamar al siguiente respondió 400. El error es `uuid = integer`: `waiting_queue.service_id` es UUID y `services.id` es integer. La interfaz muestra un error junto a una sala aparentemente vacía.

**Cambiaría:** migración coherente de tipos y claves foráneas, prueba de actualización de instalaciones existentes y un estado de error que no se confunda con una fila vacía.

Referencia: [queueService.js:19](C:/Users/usuario/Desktop/ConsultorioMedico/server/src/services/queueService.js:19), esquema conservado en la carpeta de auditoría. El hallazgo describe esta instalación; no se inspeccionó la base productiva.

### 13. P1 — Números de fila duplicados bajo concurrencia

**Reproducido.** Ocho altas simultáneas devolvieron tickets `2, 3, 4, 5, 6, 6, 7, 7`. `MAX(ticket_number)+1` dentro de una transacción no serializa la asignación entre conexiones.

**Cambiaría:** contador bloqueado por profesional/día o mecanismo equivalente, restricción de unicidad y reintento seguro.

Referencia: [queueService.js:64](C:/Users/usuario/Desktop/ConsultorioMedico/server/src/services/queueService.js:64).

### 14. P2 — El mismo DNI no puede atenderse con dos profesionales

**Reproducido.** Crear el mismo documento con el profesional B después de A devuelve 500. El esquema tiene un índice único global sobre documento, mientras el código busca pacientes por documento y profesional.

**Cambiaría:** definir explícitamente el modelo: pacientes separados por profesional con unicidad compuesta, o identidad compartida con relaciones de acceso. Evitar un cambio de índice sin antes revisar los registros existentes.

### 15. P1 — Entradas inválidas contaminan caja y servicios

**Reproducido.** La API guardó un movimiento con `amount: "abc"` como `NaN` y un servicio con precio -100 y duración -30. El navegador mostró `$NaN` en caja y el total de transacciones del administrador también quedó en `NaN`.

**Cambiaría:** esquemas de validación en servidor, números finitos, rangos positivos donde corresponda, enumeraciones y restricciones de base. Un error de entrada debe ser 400 con explicación, no un registro válido.

Referencias: [movements.js:81](C:/Users/usuario/Desktop/ConsultorioMedico/server/src/routes/movements.js:81), [services.js:122](C:/Users/usuario/Desktop/ConsultorioMedico/server/src/routes/services.js:122).

### 16. P2 — Fechas desplazadas un día en la interfaz

**Reproducido visualmente.** Fecha de nacimiento guardada `1990-01-01` aparece `31/12/1989`; turno `2026-10-15` aparece `14/10/2026` en pacientes y caja. La conversión de una fecha sin hora mediante `new Date` produce el desplazamiento al mostrarla en la zona local.

**Cambiaría:** tratar fechas de calendario como fechas sin hora y usar una política de zona horaria explícita para instantes y recordatorios. Probar cambios de día y visualización argentina.

Referencia: [PatientsPage.js:566](C:/Users/usuario/Desktop/ConsultorioMedico/client/src/pages/PatientsPage.js:566), [última cita:605](C:/Users/usuario/Desktop/ConsultorioMedico/client/src/pages/PatientsPage.js:605).

### 17. P2 — Indicadores de disponibilidad y salud poco fiables

**Observado.** La agenda mostraba “Disponible” a las 08:00 y después de las 17:00, aunque el profesional de prueba atendía 09:00–17:00. La grilla se genera de 08:00 a 20:00. Además, el administrador mostró SMTP “Verificado” mientras el SMTP de prueba estaba deliberadamente desconectado; ese texto está fijo.

**Cambiaría:** agenda basada en horarios y duración reales; estados de salud obtenidos de verificaciones recientes con fecha, fallo y opción de diagnóstico.

Referencias: [AppointmentsPage.js:107](C:/Users/usuario/Desktop/ConsultorioMedico/client/src/pages/AppointmentsPage.js:107), [AdminDashboardPage.js:290](C:/Users/usuario/Desktop/ConsultorioMedico/client/src/pages/AdminDashboardPage.js:290).

### 18. P2 — CORS acepta dominios que solo contienen el nombre permitido

**Reproducido.** Una petición con origen `https://turnohub.com.ar.attacker.invalid` recibió ese mismo origen como permitido. El código usa `includes`. Esto no equivale por sí solo a saltarse la autenticación, pero rompe la lista de orígenes pretendida.

**Cambiaría:** comparación exacta de orígenes configurados.

Referencia: [app.js:109](C:/Users/usuario/Desktop/ConsultorioMedico/server/src/app.js:109).

### 19. P2 — Contraseñas débiles aceptadas y límites no conectados

**Reproducido.** El registro aceptó una contraseña de un carácter. Por inspección, no encontré uso de `express-rate-limit` en `server/src`, pese a figurar como dependencia y característica documentada. No se ejecutó fuerza bruta.

**Cambiaría:** política de contraseña aplicada en servidor, límites específicos para login, recuperación, búsqueda pública y reservas, y respuestas que no faciliten enumeración de cuentas.

### 20. P2 — Calidad y arranque no reproducibles mediante los comandos disponibles

| Comprobación | Resultado |
|---|---|
| Tests backend | No encuentra tests; salida 1 |
| Tests frontend sin modo interactivo | No encuentra tests; salida 1 |
| Lint backend | Falla: falta configuración de ESLint |
| Build con `CI=true` | Falla porque las advertencias se tratan como errores |
| Build normal | Compila con advertencias; JS principal aproximado 315 kB gzip y CSS 79 kB gzip |
| `node serve-frontend.js` | Falla por `app.get('*')` con Express 5 instalado en la raíz |

Se utilizó un servidor estático temporal para poder seguir con el recorrido visual, sin corregir el archivo del proyecto.

**Cambiaría:** un comando de arranque local consistente, pruebas de humo, lint configurado y un pipeline que compile y ejecute pruebas de los controles anteriores. Consolidar migraciones: hoy hay cambios en varios scripts y también al arrancar la API.

## Otros riesgos identificados por inspección

- Los códigos de cita se construyen con iniciales, parte del ID, fecha y hora; la consulta pública los acepta y devuelve datos del paciente. Conviene usar tokens aleatorios de alta entropía para acceso y separar el código legible del secreto de autorización.
- La pantalla pública de fila reutiliza el servicio privado que devuelve `q.*`, incluyendo más datos que los necesarios para un llamador. Su exposición por HTTP no pudo comprobarse porque antes falla el JOIN de tipos. Revisar la respuesta pública al reparar la fila.
- La importación del catálogo de convenios usa `query('BEGIN')` y consultas sucesivas a través del pool. Eso no garantiza la misma conexión. Ya existe un helper transaccional con cliente dedicado que debería utilizarse allí.
- Hay rutas duplicadas de recuperación de contraseña; consolidarlas para evitar implementaciones que parecen activas pero quedan detrás de otra ruta.
- Los listados amplios y las consultas secuenciales por convenio merecen paginación y revisión de tiempos con volumen representativo. No se realizó una prueba de escala.
- El service worker pasa las solicitudes directamente a la red; no observé una experiencia offline preparada. No prometer funcionamiento sin conexión sin implementarlo y probarlo.
- Las afirmaciones de seguridad, backups y cumplimiento del README no constituyen evidencia de implementación ni certificación.

## Qué conservaría y qué mejoraría en la experiencia

**Conservaría:** enlace directo de reservas, separación de módulos, catálogo de servicios con duración y precio, historia clínica vinculada al paciente, horarios por franjas y dashboard orientado a tareas. Los accesos básicos de doctor/admin/vendedor funcionaron; las rutas privadas rechazaron falta de token y el token de doctor fue rechazado en administración. El alta de paciente, registro clínico, servicio válido, convenio y cita privada normal funcionó. El solapamiento privado fue rechazado correctamente.

**Cambios concretos:**

1. Hacer que el dashboard permita resolver pendientes con un clic: aprobar turnos, registrar llegada, cobrar y crear reserva. Reducir espacio de bienvenida e instalación para dar prioridad a la operación diaria.
2. Unificar vocabulario según rubro. En una cuenta médica aparecieron “Clientes”, “Paciente”, “Convenios” y “Obras sociales” mezclados. Mantener consistencia en botones, errores y mensajes.
3. Simplificar la reserva: servicio → horario → datos imprescindibles → confirmación. El formulario actual pide mucha información antes de elegir fecha y, en móvil, coloca un mapa grande antes de avanzar. Para un profesional ya elegido, su ubicación puede ir como detalle secundario.
4. Revisar modo oscuro y accesibilidad: etiquetas oscuras sobre fondo oscuro, título casi blanco sobre panel blanco del mapa, foco de teclado y controles representados por contenedores. El portal no mostró desbordamiento horizontal en la medición móvil realizada, pero necesita más pruebas de interacción y lectores de pantalla.
5. Mostrar confirmación útil: estado solicitado/aprobado, profesional, domicilio real, fecha, hora y enlace para consultar/cancelar. En la reserva de navegador se mostró una dirección genérica y la promesa de email, aunque el canal no estaba disponible en este entorno.
6. Distinguir claramente turno, pago y atención. Crear una cita, recibir una seña, cobrar el saldo y completar atención son eventos diferentes que deben reflejarse consistentemente en caja y reportes.
7. Sustituir métricas promocionales absolutas y estados fijos por información respaldada. Ejemplos observados: “0%” de ausencias, “100%” de uptime y SMTP verificado sin comprobación dinámica.
8. Agregar estados vacíos con una siguiente acción y estados de error con reintento. Una fila que no se pudo cargar no debería parecer simplemente vacía.

## Orden de trabajo recomendado

**Primera etapa — controles indispensables:** privacidad de pacientes/adjuntos, 2FA, sesiones, suspensión, pertenencia entre profesionales, webhook y WebSocket, eliminación de secretos de respaldo.

**Segunda etapa — operación confiable:** único motor de reservas, cancelación pública, tipos y concurrencia de fila, validación de importes/duraciones, fechas, modelo de DNI y consistencia de cobros/reportes.

**Tercera etapa — mantenimiento y experiencia:** pruebas de regresión con dos profesionales, migraciones versionadas, CI/lint, arranque reproducible, monitoreo real, mejoras móviles/accesibilidad y simplificación del portal.

No reescribiría toda la aplicación. Aprovecharía lo existente y centralizaría primero las reglas que hoy están duplicadas. La mejora de mayor valor sería que reservar, atender, cobrar y proteger la información funcionen de manera predecible en todos los caminos.

## Evidencias locales

- [Resultados HTTP y módulos — 57 observaciones](C:/Users/usuario/Desktop/ConsultorioMedico/scratch/audit-2026-09-30/results.json)
- [Pruebas adicionales — 6 observaciones](C:/Users/usuario/Desktop/ConsultorioMedico/scratch/audit-2026-09-30/extra-results.json)
- [Pruebas aisladas WebSocket y webhook — 2 observaciones](C:/Users/usuario/Desktop/ConsultorioMedico/scratch/audit-2026-09-30/isolated-results.json)
- [Preparación de base aislada](C:/Users/usuario/Desktop/ConsultorioMedico/scratch/audit-2026-09-30/setup.cjs)
- [Arranque de backend de prueba](C:/Users/usuario/Desktop/ConsultorioMedico/scratch/audit-2026-09-30/start.cjs)
- [Recorrido de API](C:/Users/usuario/Desktop/ConsultorioMedico/scratch/audit-2026-09-30/probe.cjs)
- [Pruebas adicionales](C:/Users/usuario/Desktop/ConsultorioMedico/scratch/audit-2026-09-30/extra.cjs)
- [Pruebas aisladas](C:/Users/usuario/Desktop/ConsultorioMedico/scratch/audit-2026-09-30/isolated.mjs)

La base sintética se conserva para reproducir los hallazgos. El arranque vuelve a usar el esquema y los datos de prueba; los scripts de carga no son idempotentes y no deberían repetirse sin preparar una base vacía. La configuración normal de la aplicación y los registros originales permanecen sin cambios.
