# Clientes nuevos y existentes

Implementación preparada; activación en Firebase pendiente. No se ha verificado la edición de la base: `firestore:databases:list --project oasysbeautycenter` falló por falta de autenticación en el entorno de trabajo.

## Flujo
- Soy cliente nuevo / Ya soy cliente: ingresar correo y abrir enlace de verificación (sin contraseña).
- Al volver se pide confirmar el mismo correo, incluso desde otro dispositivo. El correo nunca se incluye en la URL de retorno.
- Con mail verificado, recuperar únicamente clientesWeb/{Firebase Auth UID}.
- Si no existe ficha, pedir nombre y teléfono y crearla con una transacción. Si ya existe, recuperar sin sobrescribirla.
- La ficha autocompleta el formulario de turno. Guardar la ficha NO reserva un horario.
- Cambiar cuenta borra la ficha visible y los campos del turno. No se guarda nombre/teléfono en localStorage; solo el correo pendiente de verificación.
- Se usa una colección separada para no asumir ni modificar esquemas anteriores. Clientes creados manualmente en otras colecciones requieren migración verificada; no se vinculan automáticamente.

## Activación
1. En Firebase Authentication de **oasysbeautycenter**, habilitar Correo electrónico/contraseña y **Vínculo de correo electrónico (acceso sin contraseña)**. Configurar la plantilla del correo con nombre Oasis.
2. En dominios autorizados agregar `scantec77-diag.github.io`.
3. Verificar con CLI autenticada la edición y base: `firebase firestore:databases:list --project oasysbeautycenter` y `firebase firestore:databases:get '(default)' --project oasysbeautycenter`. Este adaptador está preparado para Firestore Standard/Native `(default)`. Si difiere, adaptar antes de activar. No crear ni reemplazar bases automáticamente.
4. Revisar reglas actuales antes de integrar `firestore.customers.rules`. Es un PROTOTIPO independiente que deniega otras colecciones; NO reemplazar reglas existentes sin fusionar y probar. Eliminar cualquier regla general que permita acceder a clientesWeb, porque las autorizaciones se combinan con OR.
5. Probar reglas con emulador y cuentas ficticias: propietario verificado puede crear/leer; anónimo, correo sin verificar y segundo usuario no; prohibidos listar, actualizar, borrar, roles adicionales, UID/mail ajenos y timestamps falsos.
6. Después de revisar/combinar reglas, publicar solamente las reglas correspondientes al proyecto correcto. Cambiar `CUSTOMERS_ENABLED` a `true` en `customer-config.js` y probar desde la página real. Hasta ese momento la interfaz informa que está en preparación y no envía correos ni escribe fichas.

## Pruebas de aceptación reales pendientes
- Alta con correo propio, enlace recibido, ficha persistente tras cerrar y volver a entrar.
- Ya soy cliente recupera nombre/teléfono sin duplicar ficha.
- Correo no registrado ofrece alta tras verificarlo.
- Enlace vencido ofrece pedir uno nuevo; enlace en otro dispositivo solicita el mismo correo.
- Error de permisos/red no muestra ficha guardada ni habilita reservas.
- Cerrar sesión elimina datos de pantalla y del formulario.
- Dos pestañas completando alta simultáneamente no sobrescriben datos existentes.

## Reservas: alcance separado
BOOKING_ENDPOINT sigue vacío, por lo que no se habilitan reservas. No se modificó el Code.gs ya copiado. Los campos clienteUid/email del formulario son contexto del navegador, NO identidad confiable del servidor. Antes de activar el calendario, el backend deberá verificar Firebase ID token y recuperar/vincular la ficha de manera autorizada; nunca confiar en UID/mail enviados sin verificar. Faltan además servicios, horarios y sincronización con Calendar, como se informó en la revisión.

Documentación oficial: https://firebase.google.com/docs/auth/web/email-link-auth

## Validación realizada
- Sintaxis JavaScript: correcta.
- Pruebas DOM con Firebase simulado: alta, cliente existente, errores de lectura/escritura, reintento, cambio/cierre de sesión, enlace vencido y enlace abierto con una cuenta anterior: pasan.
- Prueba visual Playwright: no ejecutada; no se pudo descargar Chromium en este entorno.
- Validación de reglas por deploy --dry-run: bloqueada por falta de sesión Firebase.
- Emulador de reglas: bloqueado por requerir Java 21 (entorno con Java 17). Las reglas son un prototipo NO validado por el compilador, NO desplegado.
- No se enviaron correos ni se crearon fichas reales.

I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for verified customers accessing only their own profile, with strict field validation and no public listing or updates. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.
