# Mejoras operativas

## Pantallas

- Profesional: **Operaciones y seguimiento** (`/operations`), con pendientes, lista de espera, correos y conciliación de pagos de turnos.
- Administración: **Correos y respaldos** (`/admin/operations`), con seguimiento global de correos, conciliación de suscripciones y estado del respaldo.
- Inicio: turnos próximos, solicitudes por confirmar, atenciones por cerrar, fila actual, saldos pendientes y avisos fallidos.
- Configuración: navegación única agrupada en Consultorio, Agenda, Cobros, Notificaciones, Plan y Seguridad. Se conservan las URLs `settings?tab=...` existentes.

## Lista de espera por cancelaciones

El profesional anota pacientes existentes, con email válido, que hayan pedido recibir avisos. Puede elegir un servicio y rango de fechas. Cancelar, rechazar o reprogramar un turno dispara una comprobación del horario liberado; también hay una acción para avisar manualmente de un horario libre.

Se comprueba duración, disponibilidad, vacaciones y habilitación del profesional. Se preparan hasta veinte avisos por comprobación. La combinación de interesado, fecha y horario no se notifica dos veces. El mensaje aclara que no reserva el turno: el paciente elige y reserva con la validación habitual. El profesional puede marcar al paciente como ya reservado o retirarlo.

La comprobación automática se hace después de confirmar el cambio del turno. Si falla por un problema de infraestructura, se registra en el log del servidor y el profesional puede usar “Avisar de un horario libre”. No existe una reserva exclusiva ni garantía de que un horario siga libre cuando se lea el correo.

## Seguimiento de correos

Los avisos transaccionales de turnos, demoras, rechazos, recordatorios, reprogramaciones, listas de espera y solicitudes de plan pasan por la cola. Cada profesional ve solo los asociados a su cuenta; administración puede ver también los registros antiguos sin asociación. No se muestra el contenido privado del correo y el destinatario aparece parcialmente oculto.

- “Aceptado por el servidor de correo” representa la aceptación SMTP; no confirma lectura ni entrega en bandeja.
- Los fallidos conservan su contenido solo hasta el vencimiento original, para permitir hasta tres reintentos manuales. En cada ciclo automático hay un máximo de ocho intentos.
- Al enviarse o vencer se elimina el contenido privado. El historial final se purga después de siete días.
- Los avisos vinculados a turnos guardan fecha, hora y estado de referencia. Antes de enviar se comprueba ese contexto; si el turno ya cambió, el aviso queda obsoleto y se descarta.
- Códigos de acceso, recuperación de contraseña y verificación de identidad siguen siendo envíos directos y no aparecen como mensajes reenviables.
- El seguimiento detallado de esta versión corresponde a correo; WhatsApp y push conservan sus mecanismos actuales.
- `EMAIL_WORKER_ENABLED=false` detiene los envíos. El panel muestra esa condición.

## Conciliación y devoluciones

La consulta busca pagos de Mercado Pago por referencia externa y comprueba importe y moneda antes de aplicar un pago aprobado. Reutiliza el registro idempotente de recibos para evitar duplicaciones. La administración consulta los pagos de suscripciones con las credenciales de plataforma, y el profesional consulta sus turnos con sus propias credenciales.

Un pago tardío sobre una cita cancelada o solicitud rechazada se marca para revisión; no se reactiva automáticamente. Los reembolsos contables registrados en Caja se muestran aparte. El estado real y el importe devuelto se consultan en la API de devoluciones del proveedor. Esta funcionalidad **no ejecuta devoluciones ni modifica el dinero de la cuenta**. Las devoluciones confirmadas no alteran automáticamente el libro contable: deben conciliarse con los movimientos de Caja.

Referencias usadas: [consulta de devoluciones de Mercado Pago](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-api-payments/get-refunds/get), [pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html).

## Respaldo cifrado y prueba de restauración

El servidor incluye dos comandos. No fueron ejecutados contra producción durante el desarrollo:

```text
npm run backup:create
npm run backup:restore-check -- DIRECTORIO_DEL_RESPALDO
```

Requisitos:

1. Clientes `pg_dump` y `pg_restore` compatibles con la versión del servidor PostgreSQL; pueden definirse sus ejecutables con `PG_DUMP_BIN` y `PG_RESTORE_BIN`.
2. `DATABASE_URL` para la base de origen.
3. `BACKUP_DIR` fuera del directorio de adjuntos, en almacenamiento persistente.
4. `BACKUP_ENCRYPTION_KEY`: clave privada de 32 bytes expresada como 64 caracteres hexadecimales. Guardarla separada de las copias; perderla impide recuperar los datos.
5. `BACKUP_STATUS_FILE`: archivo de estado accesible por el proceso web, fuera de rutas públicas, por ejemplo `server/backup-status.json`.
6. `UPLOADS_DIR`, si los adjuntos no están en el directorio habitual `server/uploads`. El comando necesita acceso al mismo volumen de adjuntos que usa la aplicación.
7. `BACKUP_VERIFY_DATABASE_URL`: base previamente creada y vacía para la prueba, con nombre `turnohub_restore_check_...`. Se rechaza un destino con el mismo nombre que la base de origen, y nunca se sobrescribe una base que ya tenga tablas. Usar credenciales con acceso únicamente a esa instancia de prueba.
8. Configurar `sslmode` en las URLs o `PGSSLMODE` según el entorno; el valor predeterminado es `require`.

`backup:create` cifra el dump, los adjuntos y su inventario con AES-256-GCM, y guarda un manifiesto autenticado e inventario de hashes. Falla si falta el directorio de adjuntos o un archivo cambia durante su copia; no informa una copia incompleta como exitosa.

`backup:restore-check` autentica y descifra los archivos en un directorio temporal propio, comprueba hashes, restaura con `pg_restore --exit-on-error`, verifica las tablas principales y comprueba que los registros clínicos restaurados tengan sus adjuntos. Elimina únicamente el directorio temporal creado para esa ejecución; la base aislada restaurada queda disponible para inspección. Para otra ejecución se necesita otra base vacía.

El panel administrativo distingue copia creada de restauración verificada, y muestra fallos o copias con más de 36 horas. No hay un botón de restauración sobre producción. La programación diaria debe configurarse en el entorno de hosting, junto con una copia de los respaldos en almacenamiento independiente del servidor y una política de retención. El programa no elimina copias antiguas automáticamente.

Se encontraron las herramientas de PostgreSQL 17 fuera del PATH (`C:/Program Files/PostgreSQL/17/bin`). Se probó una instancia temporal en 127.0.0.1:55471, exclusivamente con datos ficticios: migraciones e idempotencia en cuatro combinaciones de identificadores de servicios, cola concurrente, disponibilidad, pagos y reprogramación. También se creó un respaldo cifrado y se restauró la base junto con su adjunto en una base vacía distinta; ambas comprobaciones quedaron verificadas. La instancia se detuvo al terminar. No se copió ni modificó la base productiva.

## Despliegue

La migración `006_operations` agrega tablas y metadatos; también elimina la restricción antigua de horario único que incluía turnos cancelados, manteniendo el trigger de solapamiento de turnos activos. Se ejecuta después de las migraciones de correo y recepción, antes de iniciar el worker. Agrega metadatos de avisos y tablas para lista de espera, ofertas y consultas de pagos. No convierte turnos, borra datos ni realiza cobros/devoluciones.

Las migraciones 005/006 y los flujos indicados se probaron en PostgreSQL temporal real. Las pruebas unitarias de proveedor y de interfaz siguen usando simulaciones; no se enviaron correos ni se consultaron cuentas reales de Mercado Pago. Antes de publicar, confirmar SMTP, credenciales de Mercado Pago, persistencia de adjuntos y configuración del trabajo de respaldo en el hosting. La prueba local no acredita una ejecución en Render.

## Hallazgo de instalación desde cero

El script legado `db:init` referencia algunas tablas antes de crearlas y el sembrado de demos intenta usar columnas de planes antes de las migraciones maestras. Para las pruebas locales se prepararon esas dependencias solo en la base descartable. Esto no cambió tablas productivas ni modifica el procedimiento de actualización de una instalación existente. La instalación desde una base completamente vacía requiere ordenar ese bootstrap antes de usarse como procedimiento de instalación.
