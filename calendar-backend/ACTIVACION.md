# Activar reservas de Oasis

El formulario de index.html usa booking.js. No está activo hasta completar estos pasos.

1. Con la cuenta de Google de Oasis, abrir https://script.google.com/ y crear un proyecto independiente llamado "Reservas Oasis".
2. Copiar calendar-backend/Code.gs en el editor.
3. El catálogo de tratamientos y las duraciones informadas ya están cargados en CONFIG.services. Antes de habilitar, confirmar duración de Pedicuría sin semipermanente, Pedicuría + semipermanente, Limpieza / higiene facial y Maquillaje social; luego agregarlas al código. Completar CONFIG.hours con los días y horas reales: siguen pendientes de informar. Esta versión atiende un turno a la vez, con una franja diaria.
4. Configurar manualmente CONFIG.hours por día en el código. Omitir los días cerrados; cargar una franja como `1: [['09:00','18:00']]` para el lunes o varias franjas como `1: [['09:00','13:00'], ['14:00','18:00']]`. El número 0 es domingo y el 6 sábado. Las franjas admiten turnos solo si entran completas dentro del horario. Configurar la zona horaria del proyecto como America/Argentina/Buenos_Aires.
5. Ejecutar checkCalendar y autorizar acceso al calendario. Comprobar el nombre registrado. Si falla, volver a copiar el ID desde Configuración → Integrar calendario: el ID actual es el recibido por chat y aún no se verificó contra Google.
6. Implementar → Nueva implementación → Aplicación web. Ejecutar como la cuenta de Oasis; acceso: Cualquier persona. Autorizar con la cuenta propietaria. Mantener el calendario PRIVADO; no hace falta publicarlo.
7. Copiar la URL terminada en /exec y colocarla en BOOKING_ENDPOINT, al inicio de booking.js. No usar /dev.
8. Probar desde el formulario con datos de prueba y un tratamiento configurado. La página de respuesta debe confirmar registro y el evento debe aparecer en Calendar. Reenviar sin modificar los datos: no debe duplicarlo. Probar el mismo horario con otro formulario: debe rechazarlo.
9. Eliminar el evento de prueba desde Calendar para liberar ese horario.

Las solicitudes retienen el horario y quedan pendientes de confirmación del centro y seña. No se registra ningún pago ni se envían mensajes automáticamente. Todavía no se guarda historial de clientes en Firestore.

## Bloqueos y límites
Cualquier evento existente, incluso de día completo, bloquea ese intervalo. Para bloquear un horario o día, crear un evento en Calendar. Los bloqueos y reservas comparten una única agenda/capacidad. El formulario muestra y permite elegir los 17 servicios. Para crear un evento y bloquear el horario, cada servicio debe tener una duración cargada en CONFIG.services; los cuatro sin duración informada quedan para coordinación manual hasta completarla. El formulario todavía no muestra una lista de horarios libres: comprueba el horario elegido al enviar.

El bloqueo de ejecución serializa las reservas de este mismo Apps Script. Una edición simultánea desde Calendar u otro sistema puede causar un cruce: revisar los cambios manuales. El formulario público tiene un campo trampa básico, pero no verifica identidad ni implementa CAPTCHA. Antes de difundir masivamente, añadir protección contra abuso. No publicar el calendario con los datos de clientes.

La deduplicación mantiene el identificador mientras la pestaña sigue abierta y no se cambian los datos. Con un formulario nuevo, el control de ocupación evita una segunda reserva sobre el mismo intervalo. Si no aparece un resultado, reintentar sin editar el formulario o consultar al centro.

Cambios al código de Apps Script: implementar una nueva versión desde Administrar implementaciones.
