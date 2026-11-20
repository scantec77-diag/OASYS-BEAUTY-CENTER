# Clientes nuevos y existentes

Implementación preparada; activación en Firebase pendiente. Se verificó por consola la existencia de la base `(default)` y se recuperaron sus reglas activas. La edición exacta debe confirmarse antes del despliegue. La CLI local no tiene sesión; el acceso de consola no autentica automáticamente la CLI.

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
4. Importar las fichas históricas verificadas en `clientesPorEmail`: ID del documento = email exacto que muestra Firebase Authentication; campos `email`, `nombre`, `telefono` (nombre y teléfono pueden quedar vacíos para completarlos luego). Importar solo direcciones confirmadas por Oasis. Después, revisar reglas actuales antes de integrar el bloque de `clientesWeb` y `clientesPorEmail` de `firestore.customers.rules`. El archivo de la rama de correcciones ya incorpora las reglas activas recuperadas; NO reemplazar reglas publicadas sin volver a comparar y revisar los cambios intencionales. El padrón no debe permitir listado ni escritura desde la app.
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

## Estado actualizado de la integración — 19/11/2026

La rama `fix/oasys-security-2026-11-19` ya tiene endpoint configurado, verificación Firebase ID token en Apps Script y envío del token por el formulario. El registro continúa desactivado mediante `CUSTOMERS_ENABLED=false`; esto evita habilitarlo antes de publicar y probar el conjunto.

Se comprobó en la consola que Google es el proveedor habilitado; el acceso por correo/enlace todavía debe activarse. El dominio `scantec77-diag.github.io` sí figura autorizado. La base `(default)` existe y las reglas activas de octubre se recuperaron completas; no eran el prototipo de clientes del repositorio.

`firestore.customers.rules` ahora integra los perfiles/pagos nuevos con horarios, reservas antiguas, tokens de notificaciones y plantillas de pago de la versión activa. Antes de publicarlo revisar las restricciones nuevas de la vía antigua de reservas, detalladas en `CORRECCIONES-2026-11-19.md`. No reemplazar reglas sin comparar de nuevo el estado activo al momento de publicar.

## Validación local actualizada

- Sintaxis, flujos jsdom y pruebas de backend con servicios simulados: aprobados.
- Java 21 disponible; el emulador compiló las reglas integradas. 30 comprobaciones de clientes/pagos y 86 reproducciones/regresiones de integración: aprobadas.
- Ejecutar `npm ci`, `npm test` y `npm run test:rules` para reproducir. El proyecto demo de las pruebas impide confundirlas con datos reales.
- La prueba visual Playwright y las pruebas contra Auth, Firestore, Calendar, Drive y correo reales siguen pendientes. No afirmar entrega de correos o acceso real a comprobantes hasta ejecutarlas.
- No se enviaron correos ni se crearon fichas reales durante estas pruebas. Las fichas históricas requieren datos verificados/importados por el centro.

El detalle vigente de cambios, pruebas, permisos de despliegue y límites queda en `CORRECCIONES-2026-11-19.md`.
