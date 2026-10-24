// Copiar en Code.gs de Google Apps Script. Completar servicios y horarios reales.
const CONFIG = {
  calendarId: '04f4ef16777302474a8fDcJHrrHSgvFpsYxqb6g97uaQTd2kE31rPUeDZTeDsjVq@group.calendar.google.com',
  services: {}, // Formato: 'Nombre exacto del tratamiento': minutos
  hours: {}, // 0=domingo...6=sábado. Formato: 1: ['09:00', '18:00']
  maxDaysAhead: 90
};
function page(message) {
  const safe = String(message).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return HtmlService.createHtmlOutput('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reserva Oasis</title><body style="font:18px system-ui;background:#fffaf3;color:#42392e;padding:32px;max-width:650px;margin:auto"><h1>Oasis Beauty Center</h1><p role="status">'+safe+'</p><p>Podés volver a la pestaña del formulario.</p></body></html>');
}
function doGet() { return page('Para solicitar un turno, usá el formulario de Oasis.'); }
function checkCalendar() {
  const calendar = CalendarApp.getCalendarById(CONFIG.calendarId);
  if (!calendar) throw new Error('No se encuentra el calendario. Revisá el ID y el acceso de la cuenta.');
  console.log('Calendario encontrado: ' + calendar.getName());
}
function doPost(e) {
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    const p = (e && e.parameter) || {};
    if (p.website) return page('No se pudo procesar la solicitud.');
    const nombre = String(p.nombre || '').trim();
    const telefono = String(p.telefono || '').trim();
    const servicio = String(p.servicio || '').trim();
    const id = String(p.requestId || '');
    if (!nombre || nombre.length > 80 || !/^[+() 0-9-]{7,25}$/.test(telefono) ||
        servicio.length > 100 || !/^[a-f0-9-]{36}$/i.test(id)) {
      return page('Revisá el nombre, teléfono y tratamiento antes de enviar.');
    }
    if (!Object.keys(CONFIG.services).length || !Object.keys(CONFIG.hours).length)
      return page('Las reservas todavía no están habilitadas. Falta configurar los tratamientos y horarios del centro.');
    const duration = Object.prototype.hasOwnProperty.call(CONFIG.services, servicio) ? CONFIG.services[servicio] : 0;
    if (!Number.isInteger(duration) || duration < 5 || duration > 480)
      return page('Ese tratamiento todavía no está habilitado. Consultá al centro por su nombre y duración.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.fecha || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.hora || ''))
      return page('La fecha o el horario no son válidos.');
    const start = new Date(p.fecha + 'T' + p.hora + ':00-03:00');
    const end = new Date(start.getTime() + duration * 60000);
    const tz = 'America/Argentina/Buenos_Aires';
    if (!Number.isFinite(start.getTime()) || Utilities.formatDate(start, tz, 'yyyy-MM-dd') !== p.fecha ||
        start <= new Date() || start.getTime() > Date.now() + CONFIG.maxDaysAhead * 86400000)
      return page('Elegí una fecha futura dentro de los próximos 90 días.');
    const weekday = new Date(p.fecha + 'T12:00:00Z').getUTCDay();
    const hours = CONFIG.hours[weekday];
    if (!Array.isArray(hours) || hours.length !== 2 || !hours.every(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) ||
        start < new Date(p.fecha + 'T' + hours[0] + ':00-03:00') ||
        end > new Date(p.fecha + 'T' + hours[1] + ':00-03:00'))
      return page('El tratamiento no entra dentro del horario de atención de ese día. Elegí otro horario.');
    locked = lock.tryLock(15000);
    if (!locked) return page('Hay otra reserva en proceso. Esperá unos segundos y volvé a enviar.');
    const calendar = CalendarApp.getCalendarById(CONFIG.calendarId);
    if (!calendar) return page('No se pudo acceder a la agenda. No se confirmó ningún turno.');
    const events = calendar.getEvents(start, end);
    const marker = 'OASIS_REQUEST:' + id;
    if (events.some(event => event.getDescription().split('\n').includes(marker)))
      return page('Tu solicitud ya había quedado registrada en este horario. No se creó un turno duplicado.');
    if (events.length)
      return page('Ese horario está ocupado o bloqueado. No se guardó la reserva; elegí otro horario.');
    calendar.createEvent('Turno web · ' + servicio, start, end, {
      description: marker + '\nCliente: ' + nombre + '\nTeléfono: ' + telefono +
        '\nTratamiento: ' + servicio + '\nEstado: pendiente de confirmación del centro y seña.'
    });
    return page('Solicitud registrada en la agenda para el ' + p.fecha + ' a las ' + p.hora +
      ' (hora de Argentina). El horario quedó retenido; falta la confirmación del centro y la seña. Referencia: ' + id);
  } catch (error) {
    console.error('Error al registrar reserva: ' + error.message);
    return page('No pudimos confirmar el resultado. Conservá el formulario y reintentá sin cambiar los datos para evitar duplicados; si persiste, consultá al centro.');
  } finally {
    if (locked) lock.releaseLock();
  }
}
