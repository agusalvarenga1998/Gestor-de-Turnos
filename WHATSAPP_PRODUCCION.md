# Conexión desde TurnoHub productivo

Preparado localmente; todavía no desplegado ni vinculado a Meta.

- Página de administración: `https://turnohub.com.ar/admin/whatsapp`.
- Inicio y estado: `/api/whatsapp-connection/start` y `/status`, protegidos por autenticación de administrador.
- Retorno OAuth: `https://api.turnohub.com.ar/api/whatsapp-connection/callback`.
- Configuración Meta autorizada: `2169602726971150`.
- El retorno comprueba estado de un solo uso y cookie segura del navegador que inició la conexión. El servidor intercambia el código, comprueba la cuenta y el número real de TurnoHub y exige coexistencia activa antes de persistir la credencial.
- La credencial se almacena cifrada con AES-256-GCM en `whatsapp_cloud_connection`, no se devuelve al navegador ni se escribe en logs. La migración se ejecuta con el arranque normal del servidor.
- Esta etapa guarda la conexión y mantiene el agente desactivado. No activa respuestas, importa chats/contactos ni suscribe automáticamente la cuenta a webhooks. El receptor conversacional productivo es un paso posterior.

## Configuración privada requerida en Render

`WHATSAPP_META_APP_SECRET`: secreto de la app Meta ya existente (1000507209466486).

`WHATSAPP_CREDENTIALS_KEY`: clave hexadecimal de 32 bytes (64 caracteres hexadecimales), generada de forma segura y conservada en las variables privadas de Render. No incluirla en el repositorio, el frontend, el chat o los logs. Debe mantenerse estable para poder descifrar la credencial después de reinicios.

Estos valores faltantes deshabilitan el inicio del flujo de vinculación; el resto de la web continúa funcionando.

## Configuración requerida en Meta

Agregar a los URI válidos de OAuth:

`https://api.turnohub.com.ar/api/whatsapp-connection/callback`

Mantener HTTPS y modo estricto. El flujo abre Meta en la misma pestaña. La prueba en vivo debe confirmar que Meta muestra la opción de conectar la cuenta de WhatsApp Business existente; si no aparece, cancelar sin crear ni eliminar cuentas.

## Antes de publicar

Revisar solo los cambios relacionados con esta integración, evitando incluir otros cambios locales del usuario. Desplegar backend y frontend; comprobar migración y disponibilidad de la sección desde una sesión de administrador. Confirmar el número mediante la interfaz oficial de Meta antes de activar cualquier envío.

El administrador debe revisar los avisos de coexistencia de Meta sobre dispositivos vinculados y funciones de la app. No se ha autorizado importar el historial de chats.
