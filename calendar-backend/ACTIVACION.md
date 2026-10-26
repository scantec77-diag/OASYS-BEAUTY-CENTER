# Actualizar la integración de Agenda de Oasis

El archivo `Code.gs` reúne en una sola aplicación web las reservas, la consulta de disponibilidad, los servicios, la administración de horarios y el clima. La página usa la misma URL `/exec` para las consultas de agenda y reservas.

## Actualización necesaria en Google Apps Script

1. Abrí el proyecto de Apps Script que corresponde a la URL `/exec` configurada en `app-config.js`.
2. Reemplazá el contenido de su archivo `Code.gs` por el contenido completo de este directorio.
3. En la configuración del proyecto, verificá la zona horaria `America/Argentina/Buenos_Aires`.
4. Ejecutá `checkCalendar` y autorizá el acceso. Debe registrar el calendario “Turnos Oasis Beauty Center”.
5. En **Implementar → Administrar implementaciones**, editá la aplicación web, elegí **Nueva versión**, ejecutala como la cuenta de Oasis y conservá el acceso **Cualquier persona**. La URL `/exec` existente se mantiene al actualizar una implementación.
6. Abrí la página pública y comprobá la sección de disponibilidad. Los horarios iniciales son todos los días, de 09:00 a 13:00 y de 14:00 a 18:00; el administrador puede cambiarlos desde “Editar días y horarios”.

Si se crea otra implementación con una URL nueva, actualizá tanto `APPS_SCRIPT_ENDPOINT` como `AVAILABILITY_ENDPOINT` en `app-config.js` con esa URL.

## Prueba segura

- Consultá `settings` para confirmar que devuelve los siete días y los dos tramos horarios.
- Consultá `availability` para una fecha futura. La respuesta debe incluir `ok: true` y los intervalos ocupados, sin nombres ni datos personales.
- Para probar una reserva real, elegí un horario libre y luego eliminá el evento de prueba desde Calendar.

El archivo `../OasisAvailability.gs` conserva una versión independiente antigua. No la despliegues por separado: la página necesita la versión unificada de `Code.gs`.

El clima requiere `WEATHER_API_KEY` en las propiedades del script. No guardes esa clave en el repositorio.
