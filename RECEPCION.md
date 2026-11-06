# Acceso de recepción

El profesional administra cuentas desde **Equipo y recepción** (`/team`). El ingreso independiente está en `/reception`, también enlazado desde el login de profesionales.

## Permisos de esta primera versión

- Consultar agenda por fecha, contacto básico del paciente, servicio y saldo.
- Reservar turnos para pacientes y servicios existentes del mismo consultorio. Se reutilizan las validaciones de disponibilidad y límites del plan.
- Registrar el saldo completo recibido en efectivo o transferencia. El importe se comprueba de nuevo dentro de una transacción y no se duplica un cobro ya registrado.
- Las historias clínicas, archivos, notas, configuración, suscripciones, administración de pacientes, devoluciones y confirmación de solicitudes online permanecen a cargo del profesional.

La API no entrega a recepción los tokens privados de los turnos, las historias clínicas ni credenciales del profesional. Las operaciones se auditan con el identificador de la cuenta de recepción.

## Cuentas y sesiones

- El profesional asigna email y contraseña a cada cuenta y comparte esas credenciales por un canal privado. La aplicación no envía contraseñas por correo.
- Un email identifica una cuenta de recepción de un consultorio.
- El profesional puede desactivar, reactivar o restablecer la contraseña. Esas acciones invalidan los JWT anteriores de esa cuenta.
- La sesión dura hasta ocho horas. Cada petición vuelve a comprobar que la cuenta sigue activa y que el profesional está habilitado y tiene suscripción vigente.
- El token de recepción es independiente del token del profesional y no permite entrar a las rutas de este último.

## Base de datos y despliegue

La migración aditiva `005_reception_accounts` crea una tabla y sus índices, y se integra en `stabilizeSchema()` antes de abrir el servidor. No transforma cuentas existentes ni registros de pacientes.

Las pruebas de permisos, revocación y aislamiento de consultorio usan una base simulada. Además se validó la cadena de migraciones con PostgreSQL 17 temporal real, junto con la reserva de horarios liberados, reprogramación y el trigger contable que registra el saldo una sola vez. No se ejecutó ninguna migración en producción durante este trabajo; falta la validación del entorno de despliegue.
