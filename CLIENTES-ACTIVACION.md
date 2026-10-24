# Clientes nuevos y existentes

Implementación preparada; activación en Firebase pendiente. No se ha verificado la edición de la base: `firestore:databases:list --project oasysbeautycenter` falló por falta de autenticación en el entorno de trabajo.

## Flujo
- Soy cliente nuevo / Ya soy cliente: ingresar correo y recibir un enlace de un solo uso de Firebase (sin contraseña ni código para copiar). Tocar el enlace confirma que la persona controla ese correo.
- El enlace conserva qué opción eligió la persona, incluso si lo abre en otro dispositivo. El correo nunca se incluye en la URL de retorno.
- Con mail verificado, recuperar primero clientesWeb/{Firebase Auth UID}. Si todavía no existe, buscar clientesPorEmail/{email exacto de Firebase Authentication}, una ficha histórica importada por el centro.
- “Ya soy cliente” solo continúa si encuentra su ficha actual o un antecedente con ese mismo mail. Si no hay coincidencia, no crea una ficha nueva y pide revisar el correo o contactar al centro.
- “Soy cliente nuevo” permite crear una ficha nueva después de verificar el mail. Si el mail coincide con un antecedente histórico, lo reconoce y evita duplicarlo.
- Los antecedentes históricos son solo de lectura para el cliente. Si faltan nombre o teléfono, los completa y se crea una ficha de acceso vinculada al UID.
- La ficha autocompleta el formulario de turno. Guardar la ficha NO reserva un horario.
- Cambiar cuenta borra la ficha visible y los campos del turno. No se guarda nombre/teléfono en localStorage; solo el correo pendiente de verificación.
- Los clientes nuevos usan clientesWeb/{uid}. Para habilitar el acceso a clientes anteriores, el centro debe importar sus antecedentes a clientesPorEmail/{email en minúsculas}, con al menos el campo email. Puede incluir nombre y teléfono; el historial queda privado y no se modifica desde el navegador.
- La búsqueda histórica es una lectura puntual por el email que Firebase verificó. Las reglas no permiten listar el padrón ni que un cliente lo cree o cambie.

## Activación
1. En Firebase Authentication de **oasysbeautycenter**, habilitar Correo electrónico/contraseña y **Vínculo de correo electrónico (acceso sin contraseña)**. Configurar la plantilla del correo con nombre Oasis.
2. En dominios autorizados agregar `scantec77-diag.github.io`.
3. Verificar con CLI autenticada la edición y base: `firebase firestore:databases:list --project oasysbeautycenter` y `firebase firestore:databases:get '(default)' --project oasysbeautycenter`. Este adaptador está preparado para Firestore Standard/Native `(default)`. Si difiere, adaptar antes de activar. No crear ni reemplazar bases automáticamente.
4. Importar las fichas históricas verificadas en `clientesPorEmail`: ID del documento = email exacto que muestra Firebase Authentication; campos `email`, `nombre`, `telefono` (nombre y teléfono pueden quedar vacíos para completarlos luego). Importar solo direcciones confirmadas por Oasis. Después, revisar reglas actuales antes de integrar el bloque de `clientesWeb` y `clientesPorEmail` de `firestore.customers.rules`. Es un PROTOTIPO independiente que deniega otras colecciones; NO reemplazar reglas existentes sin fusionar y probar. El padrón no debe permitir listado ni escritura desde la app.
5. Probar reglas con emulador y cuentas ficticias: propietario verificado puede crear/leer; anónimo, correo sin verificar y segundo usuario no; prohibidos listar, actualizar, borrar, roles adicionales, UID/mail ajenos y timestamps falsos.
6. Después de revisar/combinar reglas, publicar solamente las reglas correspondientes al proyecto correcto. Cambiar `CUSTOMERS_ENABLED` a `true` en `customer-config.js` y probar desde la página real. Hasta ese momento la interfaz informa que está en preparación y no envía correos ni escribe fichas.

## Pruebas de aceptación reales pendientes
- Alta con correo propio, enlace recibido, ficha persistente tras cerrar y volver a entrar.
- Ya soy cliente con antecedente importado recupera la ficha asociada al email verificado.
- “Ya soy cliente” sin antecedente no crea una ficha y muestra cómo resolver el caso.
- “Soy cliente nuevo” crea ficha luego de verificar, conservando el modo incluso si el enlace se abre en otro dispositivo.
- Un email nuevo que coincide con un antecedente no genera una ficha duplicada.
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
- No se enviaron correos ni se crearon fichas reales. La búsqueda por clientesPorEmail depende de importar el padrón del centro y fusionar las reglas en Firebase.

I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for verified customers accessing only their own profile, with strict field validation and no public listing or updates. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.
