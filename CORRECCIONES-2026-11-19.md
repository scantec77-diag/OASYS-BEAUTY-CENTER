# Correcciones OASYS — 19/11/2026

Base revisada: main, `ba106d3d7496ae00b67626a8783755305372a6ea`.

## Flujo acordado con Ari

El cliente envía solicitud y comprobante; el horario queda retenido en Calendar al registrarse la solicitud. La administradora verifica manualmente que el pago esté acreditado y aprueba la seña. El turno pasa a **Turno tomado**, en rojo, y se envían correos de confirmación al cliente y a `oasysbeautycenter@gmail.com`. No existe integración con banco, pasarela ni acreditación automática. Subir una imagen no confirma un pago.

El bloqueo de la solicitud pendiente no caduca automáticamente: requiere revisión del centro. No se creó ningún trabajo programado ni se envió correo real durante el desarrollo.

## Cambios

- Reconstrucción del archivo de reglas Firestore eliminando los fragmentos inválidos, conservando el modelo de acceso mínimo. No se modificaron las reglas publicadas.
- Reservas autenticadas mediante Identity Toolkit: token válido del proyecto, usuario verificado/habilitado y coincidencia de UID y mail. El token se obtiene al enviar, no se guarda en Calendar ni se incluye en enlaces.
- Reserva protegida con lock, verificación de conflictos e idempotencia por referencia en toda la ventana de agenda revisada (365 días anteriores y hasta 91 posteriores). El monto solicitado se obtiene de la configuración pública en servidor, no del formulario.
- Comprobante JPG validado en servidor, con límite de tamaño, guardado en carpeta privada nueva de Drive. `OASIS_RECEIPTS_FOLDER_ID` se crea en propiedades del script; no se habilita compartir por enlace. Se reutiliza el archivo en reintentos de la misma referencia/usuario. Si falla la creación del evento puede quedar un archivo huérfano privado, reutilizable por ese reintento; no se borra automáticamente.
- Bandeja administrativa de solicitudes/comprobantes, incluyendo turnos confirmados con correos pendientes. Los datos personales se sirven exclusivamente por la acción administrativa autenticada.
- Registro manual de seña mediante transacción Firestore; el servidor relee el registro inmutable con el token de administrador, verifica referencia/cliente/importe y busca un único evento coincidente antes de confirmarlo.
- Confirmación idempotente: descripción, título y color rojo de Calendar; envío separado a cliente y administradora. El monto no se contabiliza otra vez al reintentar.
- Registro persistente de estado de envío en `OASIS_CONFIRM_EMAILS_<referencia>`. Un envío aceptado no se repite. Cuota agotada se puede reintentar. Un envío interrumpido/incierto no se repite automáticamente: revisar la recepción y conciliar el estado antes de reenviar. No se puede garantizar exactamente una entrega mediante MailApp.
- La agenda pública muestra “Turno tomado” en rojo y no ofrece el botón Elegir en franjas ocupadas. Se actualiza después del OK administrativo y al volver a la ventana. No es una suscripción en tiempo real: el servidor siempre vuelve a comprobar conflictos al reservar.
- Protección de módulos de clima y saludo ante HTML sin sus elementos; sesión visual admin exige correo verificado; importación única del módulo de clientes.
- Pruebas previas actualizadas: mocks de antecedentes, selector correcto del botón de envío, flujo de cliente nuevo y entorno sin endpoint para comprobar reservas deshabilitadas.

## Validación ejecutada

- Compilación y 30 comprobaciones de permisos/datos en emulador Firestore con proyecto `demo-oasys-security`: PASS.
- 16 escenarios de backend de reservas con servicios simulados: PASS.
- 18 escenarios de comprobantes/aprobación/correos con Drive, Firestore, Calendar y MailApp simulados: PASS.
- Flujos de clientes, envío autenticado, cambios de cuenta, reintentos y bandeja administrativa en jsdom: PASS.
- Sintaxis JavaScript/Apps Script y `git diff --check`: PASS.
- Playwright/Chromium: **no ejecutado con éxito**. La descarga del navegador respondió 403 y el Chromium instalado no pudo crear un socket en este entorno. No se obtuvo una validación visual ni móvil real.

Para reproducir: Node >=22.21, Java 21, `npm ci`, `npm test`, `npm run test:rules`. Para navegador: `npx playwright install chromium` y `npm run test:browser`, o definir `CHROMIUM_EXECUTABLE_PATH` hacia un navegador compatible.

## Antes de publicar y de probar integralmente

1. Comparar las reglas efectivas y el Apps Script publicado con esta versión. La fuente canónica es `calendar-backend/Code.gs`; no mezclar `OasisAvailability.gs` (alternativa antigua) con el backend unificado.
2. Usar proyectos/calendario/cuentas de prueba; autorizar Drive, Calendar y envío de correo de Apps Script. Las pruebas locales no comprueban permisos OAuth, entrega real de mails ni acceso real al comprobante privado.
3. Desplegar backend y frontend coordinadamente: el backend exige ahora el token enviado por el frontend nuevo. No activar clientes hasta validar Auth y reglas en el entorno de prueba.
4. Ejecutar el flujo completo: acceso por mail, ficha, comprobante real, agenda, doble solicitud simultánea, revisión de pago, confirmación roja y dos correos. Probar respuestas perdidas, cuota y fallo parcial de Calendar/correo.
5. Los turnos antiguos pueden no tener mail de cliente: quedan con aviso de correo pendiente; no se inventa destinatario. Revisar correspondencia manualmente.
6. Conservar versiones anteriores y exportar reglas/configuración antes de desplegar. Rollback coordinado frontend/backend; no restaurar las reglas fuente corruptas.

No se desplegó, no se habilitaron clientes y no se modificó producción. Quedan revisión visual/móvil, configuración desplegada, notificaciones push, cancelación/liberación de horarios, retención/limpieza de comprobantes y conciliación operativa de correos inciertos. La prueba integral se realiza al finalizar los cambios, según lo pedido por Ari.
