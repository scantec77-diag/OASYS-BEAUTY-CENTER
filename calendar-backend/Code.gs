// Copiar en Code.gs de Google Apps Script. Los horarios y cuatro duraciones siguen pendientes.
const CONFIG = {
  calendarId: '04f4ef16777302474a8fDcJHrrHSgvFpsYxqb6g97uaQTd2kE31rPUeDZTeDsjVq@group.calendar.google.com',
  services: {
    "Manicuría + semipermanente": 120,
    "Manicuría + capping gel": 120,
    "Manicuría + capping Acrygel": 120,
    "Manicuría básica sin esmaltado": 60,
    "Esculpidas Acrygel cortas + semipermanente (sin decoraciones)": 180,
    "Esculpidas largas + semipermanente (sin decoraciones)": 240,
    "Servicio de esculpidas cortas (reparación/reemplazo de 1 uña en total)": 240,
    "Servicio de esculpidas largas (reparación/reemplazo de 1 uña en total)": 240,
    "Lifting de pestañas": 60,
    "Lifting + tinte": 90,
    "Alisado corto (debajo de las orejas)": 120,
    "Alisado medio (hasta los hombros)": 120,
    "Alisado largo (desde los hombros en adelante)": 180
  }, // Duraciones cargadas; los otros servicios esperan confirmación.
  hours: {}, // Cargar manualmente: omitir días cerrados; ej. 1: [['09:00','13:00'], ['14:00','18:00']]
  maxDaysAhead: 90
};
function page(message) {
  const safe = String(message).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return HtmlService.createHtmlOutput('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reserva Oasis</title><body style="font:18px system-ui;background:#fffaf3;color:#42392e;padding:32px;max-width:650px;margin:auto"><h1>Oasis Beauty Center</h1><p role="status">'+safe+'</p><p>Podés volver a la pestaña del formulario.</p></body></html>');
}
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'weather') return getWeatherJsonp(p);
  return page('Para solicitar un turno, usá el formulario de Oasis.');
}

function weatherJsonp(callback, data) {
  const name = String(callback || '');
  if (!/^oasisWeather_[A-Za-z0-9_]{1,80}$/.test(name)) {
    return ContentService.createTextOutput('/* Invalid weather callback */')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  const json = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return ContentService.createTextOutput(name + '(' + json + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function getWeatherJsonp(p) {
  const callback = String(p.callback || '');
  const latitude = Number(p.latitude);
  const longitude = Number(p.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return weatherJsonp(callback, {ok: false, error: 'invalid-location'});
  }

  // Keep weather resolution to roughly neighborhood level; never store GPS coordinates in a customer profile.
  const lat = (Math.round(latitude * 100) / 100).toFixed(2);
  const lon = (Math.round(longitude * 100) / 100).toFixed(2);
  const cache = CacheService.getScriptCache();
  const cacheKey = 'oasis-weather-v1:' + lat + ':' + lon;
  const cached = cache.get(cacheKey);
  if (cached) return weatherJsonp(callback, JSON.parse(cached));

  const apiKey = PropertiesService.getScriptProperties().getProperty('WEATHER_API_KEY');
  if (!apiKey) return weatherJsonp(callback, {ok: false, error: 'weather-not-configured'});
  if (!reserveWeatherCall_()) return weatherJsonp(callback, {ok: false, error: 'weather-limit'});

  try {
    const url = 'https://api.weatherapi.com/v1/current.json?key=' + encodeURIComponent(apiKey) +
      '&q=' + encodeURIComponent(lat + ',' + lon) + '&lang=es';
    const response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    if (response.getResponseCode() !== 200) {
      return weatherJsonp(callback, {ok: false, error: 'weather-provider-unavailable'});
    }
    const source = JSON.parse(response.getContentText());
    const result = {
      ok: true,
      location: {
        name: String(source.location && source.location.name || ''),
        region: String(source.location && source.location.region || ''),
        country: String(source.location && source.location.country || '')
      },
      current: {
        temp_c: Number(source.current && source.current.temp_c),
        feelslike_c: Number(source.current && source.current.feelslike_c),
        humidity: Number(source.current && source.current.humidity),
        wind_kph: Number(source.current && source.current.wind_kph),
        condition: {
          text: String(source.current && source.current.condition && source.current.condition.text || ''),
          code: Number(source.current && source.current.condition && source.current.condition.code)
        },
        last_updated: String(source.current && source.current.last_updated || '')
      }
    };
    cache.put(cacheKey, JSON.stringify(result), 600);
    return weatherJsonp(callback, result);
  } catch (error) {
    console.error('Weather lookup failed.');
    return weatherJsonp(callback, {ok: false, error: 'weather-provider-unavailable'});
  }
}

function reserveWeatherCall_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return false;
  try {
    const properties = PropertiesService.getScriptProperties();
    const now = new Date();
    const day = Utilities.formatDate(now, 'Etc/UTC', 'yyyy-MM-dd');
    const month = Utilities.formatDate(now, 'Etc/UTC', 'yyyy-MM');
    const savedDay = properties.getProperty('WEATHER_QUOTA_DAY') || '';
    const savedMonth = properties.getProperty('WEATHER_QUOTA_MONTH') || '';
    const dayCount = savedDay === day ? Number(properties.getProperty('WEATHER_QUOTA_DAY_COUNT') || 0) : 0;
    const monthCount = savedMonth === month ? Number(properties.getProperty('WEATHER_QUOTA_MONTH_COUNT') || 0) : 0;
    // Stay below the provider's free-plan ceiling even if the public endpoint is abused.
    if (dayCount >= 2900 || monthCount >= 90000) return false;
    properties.setProperties({
      WEATHER_QUOTA_DAY: day,
      WEATHER_QUOTA_DAY_COUNT: String(dayCount + 1),
      WEATHER_QUOTA_MONTH: month,
      WEATHER_QUOTA_MONTH_COUNT: String(monthCount + 1)
    }, false);
    return true;
  } finally {
    lock.releaseLock();
  }
}
function checkCalendar() {
  const calendar = CalendarApp.getCalendarById(CONFIG.calendarId);
  if (!calendar) throw new Error('No se encuentra el calendario. Revisá el ID y el acceso de la cuenta.');
  console.log('Calendario encontrado: ' + calendar.getName());
}
function checkWeatherApi() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('WEATHER_API_KEY');
  if (!apiKey) throw new Error('Configurá WEATHER_API_KEY en Propiedades del script.');
  const url = 'https://api.weatherapi.com/v1/current.json?key=' + encodeURIComponent(apiKey) +
    '&q=Buenos%20Aires&lang=es';
  const response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
  if (response.getResponseCode() !== 200)
    throw new Error('WeatherAPI.com respondió con HTTP ' + response.getResponseCode() + '. Revisá la clave y el plan.');
  console.log('WeatherAPI.com respondió correctamente. La clave no se mostró.');
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
      return page('La duración de ese tratamiento todavía no está cargada. Contactá al centro para coordinarlo manualmente.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.fecha || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.hora || ''))
      return page('La fecha o el horario no son válidos.');
    const start = new Date(p.fecha + 'T' + p.hora + ':00-03:00');
    const end = new Date(start.getTime() + duration * 60000);
    const tz = 'America/Argentina/Buenos_Aires';
    if (!Number.isFinite(start.getTime()) || Utilities.formatDate(start, tz, 'yyyy-MM-dd') !== p.fecha ||
        start <= new Date() || start.getTime() > Date.now() + CONFIG.maxDaysAhead * 86400000)
      return page('Elegí una fecha futura dentro de los próximos 90 días.');
    const weekday = new Date(p.fecha + 'T12:00:00Z').getUTCDay();
    const configuredHours = CONFIG.hours[weekday];
    const ranges = Array.isArray(configuredHours) && typeof configuredHours[0] === 'string'
      ? [configuredHours] : configuredHours;
    const fitsWorkingHours = Array.isArray(ranges) && ranges.some(range =>
      Array.isArray(range) && range.length === 2 &&
      range.every(t => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) &&
      range[0] < range[1] &&
      start >= new Date(p.fecha + 'T' + range[0] + ':00-03:00') &&
      end <= new Date(p.fecha + 'T' + range[1] + ':00-03:00')
    );
    if (!fitsWorkingHours)
      return page('Ese día o horario no está habilitado por el centro. Elegí otro horario.');
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
    const requestedDeposit = Number(String(p.montoSena || '').replace(',', '.'));
    const depositText = Number.isFinite(requestedDeposit) && requestedDeposit > 0 && requestedDeposit <= 100000000
      ? '$ ' + requestedDeposit.toLocaleString('es-AR') : 'a confirmar';
    calendar.createEvent('Turno web · ' + servicio, start, end, {
      description: marker + '\nCliente: ' + nombre + '\nTeléfono: ' + telefono +
        '\nTratamiento: ' + servicio + '\nSeña solicitada: ' + depositText + '\nSeña recibida: pendiente de verificar' + '\nEstado: pendiente de confirmación del centro.'
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
