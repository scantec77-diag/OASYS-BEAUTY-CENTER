const CALENDAR_ID = '04f4ef16777302474a8fDcJHrrHSgvFpsYxqb6g97uaQTd2kE31rPUeDZTeDsjVq@group.calendar.google.com';
const TIME_ZONE = 'America/Argentina/Buenos_Aires';
const FIREBASE_WEB_API_KEY = 'AIzaSyBo-OXa4h6wD_3TyKtL3LBulaRDse8z8po';
const ADMIN_EMAILS = ['oasysbeautycenter@gmail.com'];
const SETTINGS_KEY = 'OASIS_WEEKLY_SCHEDULE';

function doGet(e) {
  const callback = String(e.parameter.callback || '');
  if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService.createTextOutput('Invalid callback').setMimeType(ContentService.MimeType.TEXT);
  }
  const action = String(e.parameter.action || 'availability');
  if (action === 'settings') return jsonp(callback, { ok: true, schedule: getSchedule_() });
  if (action === 'services') return jsonp(callback, { ok: true, services: getServices_() });
  if (action !== 'availability') return jsonp(callback, { ok: false, error: 'invalid_action' });

  const date = String(e.parameter.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonp(callback, { ok: false, error: 'invalid_date' });
  try {
    const schedule = getSchedule_();
    const weekday = Number(Utilities.formatDate(
      Utilities.parseDate(date + ' 12:00', TIME_ZONE, 'yyyy-MM-dd HH:mm'), TIME_ZONE, 'u'
    ));
    if (!schedule.days.includes(weekday)) return jsonp(callback, { ok: true, date, closed: true, busy: [] });

    const dayStart = Utilities.parseDate(date + ' ' + schedule.openTime, TIME_ZONE, 'yyyy-MM-dd HH:mm');
    const dayEnd = Utilities.parseDate(date + ' ' + schedule.closeTime, TIME_ZONE, 'yyyy-MM-dd HH:mm');
    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    if (!calendar) return jsonp(callback, { ok: false, error: 'calendar_unavailable' });
    const busy = calendar.getEvents(dayStart, dayEnd).map(event => ({
      start: event.getStartTime().toISOString(),
      end: event.getEndTime().toISOString()
    }));
    return jsonp(callback, { ok: true, date, closed: false, schedule, busy });
  } catch (error) {
    return jsonp(callback, { ok: false, error: 'calendar_read_failed' });
  }
}

function doPost(e) {
  const params = e.parameter || {};
  const action = String(params.action || '');
  const email = verifyAdmin_(String(params.idToken || ''));
  if (!email) return postResult_(false, 'No se pudo verificar la cuenta administradora.',
    action === 'saveServices' ? 'oasis-services-save' : 'oasis-schedule-save');

  if (action === 'saveServices') {
    try {
      const services = JSON.parse(String(params.services || '[]'));
      validateServices_(services);
      PropertiesService.getScriptProperties().setProperty('OASIS_SERVICES', JSON.stringify(services));
      return postResult_(true, 'Lista de servicios guardada.', 'oasis-services-save');
    } catch (error) {
      return postResult_(false, 'Revisá los nombres, precios y tiempos de los servicios.', 'oasis-services-save');
    }
  }
  if (action !== 'saveSchedule') return postResult_(false, 'Acción no válida.', 'oasis-schedule-save');

  const days = String(params.days || '').split(',').filter(Boolean).map(Number);
  const openTime = String(params.openTime || '');
  const closeTime = String(params.closeTime || '');
  if (days.some(day => !Number.isInteger(day) || day < 1 || day > 7) ||
      !/^([01]\d|2[0-3]):(00|30)$/.test(openTime) ||
      !/^([01]\d|2[0-3]):(00|30)$/.test(closeTime) ||
      timeMinutes_(closeTime) <= timeMinutes_(openTime)) {
    return postResult_(false, 'Revisá los días y el horario elegido.', 'oasis-schedule-save');
  }
  const schedule = { days: Array.from(new Set(days)).sort((a,b) => a-b), openTime, closeTime, updatedAt: new Date().toISOString() };
  PropertiesService.getScriptProperties().setProperty(SETTINGS_KEY, JSON.stringify(schedule));
  return postResult_(true, 'Horario guardado.', 'oasis-schedule-save');
}

function verifyAdmin_(idToken) {
  if (!idToken || idToken.length > 10000) return '';
  try {
    const response = UrlFetchApp.fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(FIREBASE_WEB_API_KEY),
      { method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken }), muteHttpExceptions: true }
    );
    if (response.getResponseCode() !== 200) return '';
    const data = JSON.parse(response.getContentText());
    const user = data.users && data.users[0];
    const email = String(user && user.email || '').trim().toLowerCase();
    return user && user.emailVerified && ADMIN_EMAILS.includes(email) ? email : '';
  } catch (error) {
    return '';
  }
}

function getSchedule_() {
  const stored = PropertiesService.getScriptProperties().getProperty(SETTINGS_KEY);
  if (stored) {
    try {
      const value = JSON.parse(stored);
      if (Array.isArray(value.days) && value.openTime && value.closeTime) return value;
    } catch (error) {}
  }
  return { days: [], openTime: '09:00', closeTime: '21:00' };
}

function getServices_() {
  const stored = PropertiesService.getScriptProperties().getProperty('OASIS_SERVICES');
  if (stored) {
    try {
      const value = JSON.parse(stored);
      if (Array.isArray(value)) return value;
    } catch (error) {}
  }
  return defaultServices_();
}

function defaultServices_() {
  return [
    { id: 's1', name: 'Manicuría + semipermanente', price: 32000, fromPrice: false, durationMin: 120 },
    { id: 's2', name: 'Manicuría + capping gel', price: 35000, fromPrice: false, durationMin: 120 },
    { id: 's3', name: 'Manicuría + capping Acrygel', price: 40000, fromPrice: false, durationMin: 120 },
    { id: 's4', name: 'Manicuría básica sin esmaltado', price: 25000, fromPrice: false, durationMin: 60 },
    { id: 's5', name: 'Esculpidas Acrygel cortas + semipermanente (sin decoraciones)', price: 45000, fromPrice: true, durationMin: 180 },
    { id: 's6', name: 'Esculpidas largas + semipermanente (sin decoraciones)', price: 50000, fromPrice: true, durationMin: 240 },
    { id: 's7', name: 'Servicio de esculpidas cortas (reparación/reemplazo de 1 uña en total)', price: 45000, fromPrice: true, durationMin: 240 },
    { id: 's8', name: 'Servicio de esculpidas largas (reparación/reemplazo de 1 uña en total)', price: 50000, fromPrice: true, durationMin: 240 },
    { id: 's9', name: 'Pedicuría sin semipermanente', price: 35000, fromPrice: false, durationMin: null },
    { id: 's10', name: 'Pedicuría + semipermanente', price: 40000, fromPrice: true, durationMin: null },
    { id: 's11', name: 'Limpieza / higiene facial', price: 60000, fromPrice: false, durationMin: null },
    { id: 's12', name: 'Maquillaje social', price: 80000, fromPrice: true, durationMin: null },
    { id: 's13', name: 'Lifting de pestañas', price: 25000, fromPrice: false, durationMin: 60 },
    { id: 's14', name: 'Lifting + tinte', price: 30000, fromPrice: false, durationMin: 90 },
    { id: 's15', name: 'Alisado corto (debajo de las orejas)', price: 25000, fromPrice: false, durationMin: 120 },
    { id: 's16', name: 'Alisado medio (hasta los hombros)', price: 35000, fromPrice: false, durationMin: 120 },
    { id: 's17', name: 'Alisado largo (desde los hombros en adelante)', price: 55000, fromPrice: false, durationMin: 180 }
  ];
}

function validateServices_(services) {
  if (!Array.isArray(services) || services.length > 80) throw new Error('invalid_services');
  const ids = new Set();
  services.forEach(service => {
    if (!service || typeof service.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(service.id) ||
        ids.has(service.id) || typeof service.name !== 'string' || !service.name.trim() || service.name.length > 120) {
      throw new Error('invalid_service');
    }
    ids.add(service.id);
    if (service.price !== null && (!Number.isInteger(service.price) || service.price < 0 || service.price > 100000000)) {
      throw new Error('invalid_price');
    }
    if (service.durationMin !== null &&
        (!Number.isInteger(service.durationMin) || service.durationMin < 30 || service.durationMin > 720 || service.durationMin % 30 !== 0)) {
      throw new Error('invalid_duration');
    }
    service.fromPrice = Boolean(service.fromPrice);
  });
}

function timeMinutes_(value) {
  const parts = value.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

function jsonp(callback, data) {
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(data) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function postResult_(ok, message, type) {
  const payload = JSON.stringify({ type, ok, message });
  const html = '<!doctype html><meta charset="utf-8"><script>parent.postMessage(' + payload +
    ', "https://scantec77-diag.github.io");</script>';
  return HtmlService.createHtmlOutput(html);
}
