const CALENDAR_ID = '04f4ef16777302474a8fDcJHrrHSgvFpsYxqb6g97uaQTd2kE31rPUeDZTeDsjVq@group.calendar.google.com';
const TIME_ZONE = 'America/Argentina/Buenos_Aires';
const FIREBASE_WEB_API_KEY = 'AIzaSyBo-OXa4h6wD_3TyKtL3LBulaRDse8z8po';
const ADMIN_EMAILS = ['oasysbeautycenter@gmail.com'];
const DEFAULT_SERVICE_STYLES = {
  nameColor: '#42392E', detailColor: '#766B5D', cardColor: '#FFFDF9',
  nameFont: 'serif', detailFont: 'system', nameSize: 16, detailSize: 14
};
const SETTINGS_KEY = 'OASIS_WEEKLY_SCHEDULE';
const DEFAULT_STATUS_COLORS = {
  unavailable: '#E5E7EB',
  available: '#FFFFFF',
  busy: '#FECACA',
  taken: '#BFDBFE'
};

function doGet(e) {
  const callback = String(e.parameter.callback || '');
  if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService.createTextOutput('Invalid callback').setMimeType(ContentService.MimeType.TEXT);
  }
  const action = String(e.parameter.action || 'availability');
  if (action === 'settings') return jsonp(callback, { ok: true, schedule: getSchedule_() });
  if (action === 'services') return jsonp(callback, {
    ok: true, services: getServices_(), styles: getServiceStyles_()
  });
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
    const lastClose = schedule.secondCloseTime || schedule.closeTime;
    const dayEnd = Utilities.parseDate(date + ' ' + lastClose, TIME_ZONE, 'yyyy-MM-dd HH:mm');
    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    if (!calendar) return jsonp(callback, { ok: false, error: 'calendar_unavailable' });
    const busy = calendar.getEvents(dayStart, dayEnd).map(event => ({
      start: event.getStartTime().toISOString(),
      end: event.getEndTime().toISOString(),
      status: getEventStatus_(event.getTitle())
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
  const resultType = action === 'saveServices' ? 'oasis-services-save'
    : action === 'saveSchedule' ? 'oasis-schedule-save' : 'oasis-service-agenda';
  if (!email) return postResult_(false, 'No se pudo verificar la cuenta administradora.', resultType);

  if (action === 'loadServiceAgenda') {
    try {
      const agenda = getAdminServiceAgenda_();
      return postResult_(true, 'Agenda actualizada.', resultType, agenda);
    } catch (error) {
      return postResult_(false, 'No se pudo consultar la agenda del centro.', resultType);
    }
  }

  if (action === 'markServiceDone') {
    try {
      const result = markServiceDone_(String(params.eventId || ''));
      return postResult_(true, result.message, resultType, getAdminServiceAgenda_());
    } catch (error) {
      return postResult_(false, 'No se pudo marcar el servicio como realizado.', resultType);
    }
  }

  if (action === 'saveServices') {
    try {
      const services = JSON.parse(String(params.services || '[]'));
      const styles = JSON.parse(String(params.styles || '{}'));
      validateServices_(services);
      validateServiceStyles_(styles);
      PropertiesService.getScriptProperties().setProperty('OASIS_SERVICES', JSON.stringify(services));
      PropertiesService.getScriptProperties().setProperty('OASIS_SERVICE_STYLES', JSON.stringify(styles));
      return postResult_(true, 'Lista y estilos de servicios guardados.', 'oasis-services-save');
    } catch (error) {
      return postResult_(false, 'Revisá los nombres, precios y tiempos de los servicios.', 'oasis-services-save');
    }
  }
  if (action !== 'saveSchedule') return postResult_(false, 'Acción no válida.', 'oasis-schedule-save');

  const days = String(params.days || '').split(',').filter(Boolean).map(Number);
  const openTime = String(params.openTime || '');
  const closeTime = String(params.closeTime || '');
  const secondOpenTime = String(params.secondOpenTime || '');
  const secondCloseTime = String(params.secondCloseTime || '');
  let statusColors;
  try { statusColors = JSON.parse(String(params.statusColors || '{}')); } catch (error) { statusColors = null; }
  if (days.some(day => !Number.isInteger(day) || day < 1 || day > 7) ||
      !/^([01]\d|2[0-3]):(00|30)$/.test(openTime) ||
      !/^([01]\d|2[0-3]):(00|30)$/.test(closeTime) ||
      timeMinutes_(closeTime) <= timeMinutes_(openTime) ||
      Boolean(secondOpenTime) !== Boolean(secondCloseTime) ||
      (secondOpenTime && (!/^([01]\d|2[0-3]):(00|30)$/.test(secondOpenTime) ||
        !/^([01]\d|2[0-3]):(00|30)$/.test(secondCloseTime) ||
        timeMinutes_(secondOpenTime) < timeMinutes_(closeTime) ||
        timeMinutes_(secondCloseTime) <= timeMinutes_(secondOpenTime))) ||
      !validStatusColors_(statusColors)) {
    return postResult_(false, 'Revisá los días y el horario elegido.', 'oasis-schedule-save');
  }
  const schedule = {
    days: Array.from(new Set(days)).sort((a,b) => a-b),
    openTime, closeTime, secondOpenTime, secondCloseTime, statusColors,
    updatedAt: new Date().toISOString()
  };
  PropertiesService.getScriptProperties().setProperty(SETTINGS_KEY, JSON.stringify(schedule));
  return postResult_(true, 'Horario guardado.', 'oasis-schedule-save');
}

function getAdminServiceAgenda_() {
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  if (!calendar) throw new Error('calendar_unavailable');

  const now = new Date();
  const start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const ledger = getCompletedServiceLedger_();
  const appointments = calendar.getEvents(start, end)
    .map(event => {
      const description = event.getDescription() || '';
      const service = serviceNameFromEvent_(event);
      return {
        id: event.getId(),
        service,
        start: event.getStartTime().toISOString(),
        end: event.getEndTime().toISOString(),
        description,
        done: description.includes('OASIS_SERVICE_DONE:') || Boolean(ledger.eventIds[event.getId()])
      };
    })
    .filter(item => item.description.includes('OASIS_REQUEST:') && item.service && !item.done && new Date(item.end) <= now)
    .map(({ id, service, start }) => ({ id, service, start }))
    .sort((a, b) => a.start.localeCompare(b.start));

  return { counts: ledger.counts, appointments };
}

function markServiceDone_(eventId) {
  if (!eventId || eventId.length > 200) throw new Error('invalid_event_id');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('busy');
  try {
    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    if (!calendar) throw new Error('calendar_unavailable');
    const event = calendar.getEventById(eventId);
    if (!event) {
      throw new Error('event_not_found');
    }
    let description = event.getDescription() || '';
    if (!description.includes('OASIS_REQUEST:')) throw new Error('not_oasis_booking');
    const service = serviceNameFromEvent_(event);
    if (!service) throw new Error('service_missing');

    const ledger = getCompletedServiceLedger_();
    const alreadyCounted = Boolean(ledger.eventIds[eventId]);
    if (!alreadyCounted) {
      ledger.eventIds[eventId] = service;
      ledger.counts[service] = Number(ledger.counts[service] || 0) + 1;
      PropertiesService.getScriptProperties().setProperty(
        'OASIS_COMPLETED_SERVICE_LEDGER', JSON.stringify(ledger)
      );
    }
    if (!description.includes('OASIS_SERVICE_DONE:')) {
      description += (description ? '\n' : '') + 'OASIS_SERVICE_DONE:' + new Date().toISOString();
      event.setDescription(description);
    }
    return {
      message: alreadyCounted
        ? 'El servicio ya estaba registrado como realizado.'
        : 'Servicio marcado como realizado y contador actualizado.'
    };
  } finally {
    lock.releaseLock();
  }
}

function getCompletedServiceLedger_() {
  const raw = PropertiesService.getScriptProperties().getProperty('OASIS_COMPLETED_SERVICE_LEDGER');
  if (raw) {
    try {
      const value = JSON.parse(raw);
      if (value && typeof value === 'object') {
        return {
          counts: value.counts && typeof value.counts === 'object' ? value.counts : {},
          eventIds: value.eventIds && typeof value.eventIds === 'object' ? value.eventIds : {}
        };
      }
    } catch (error) {}
  }
  return { counts: {}, eventIds: {} };
}

function serviceNameFromEvent_(event) {
  const description = event.getDescription() || '';
  const match = description.match(/(?:^|\n)Tratamiento:\s*([^\n]+)/i);
  if (match) return match[1].trim();
  return String(event.getTitle() || '').replace(/^Turno web\s*[·-]\s*/i, '').trim();
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
      if (Array.isArray(value.days) && value.openTime && value.closeTime) {
        value.secondOpenTime = value.secondOpenTime || '';
        value.secondCloseTime = value.secondCloseTime || '';
        value.statusColors = { ...DEFAULT_STATUS_COLORS, ...(value.statusColors || {}) };
        return value;
      }
    } catch (error) {}
  }
  return { days: [], openTime: '09:00', closeTime: '21:00', secondOpenTime: '', secondCloseTime: '', statusColors: { ...DEFAULT_STATUS_COLORS } };
}

function validStatusColors_(colors) {
  const keys = ['unavailable', 'available', 'busy', 'taken'];
  return colors && keys.every(key => typeof colors[key] === 'string' && /^#[0-9A-Fa-f]{6}$/.test(colors[key]));
}

function getEventStatus_(title) {
  const value = String(title || '').trim().toLowerCase();
  if (/^(turno tomado|turno:|reserva oasis)/.test(value)) return 'taken';
  if (/^(no disponible|cerrado)/.test(value)) return 'unavailable';
  return 'busy';
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


function getServiceStyles_() {
  const stored = PropertiesService.getScriptProperties().getProperty('OASIS_SERVICE_STYLES');
  if (stored) {
    try {
      const value = JSON.parse(stored);
      return { ...DEFAULT_SERVICE_STYLES, ...value };
    } catch (error) {}
  }
  return { ...DEFAULT_SERVICE_STYLES };
}

function validateServiceStyles_(styles) {
  const allowedFonts = ['system', 'serif', 'arial', 'trebuchet'];
  if (!styles ||
      !/^#[0-9A-Fa-f]{6}$/.test(String(styles.nameColor || '')) ||
      !/^#[0-9A-Fa-f]{6}$/.test(String(styles.detailColor || '')) ||
      !/^#[0-9A-Fa-f]{6}$/.test(String(styles.cardColor || '')) ||
      !allowedFonts.includes(styles.nameFont) ||
      !allowedFonts.includes(styles.detailFont) ||
      !Number.isInteger(styles.nameSize) || styles.nameSize < 12 || styles.nameSize > 36 ||
      !Number.isInteger(styles.detailSize) || styles.detailSize < 10 || styles.detailSize > 24) {
    throw new Error('invalid_service_styles');
  }
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

function postResult_(ok, message, type, data) {
  const payload = JSON.stringify({ type, ok, message, data })
    .replace(/</g, '\\u003c');
  const html = '<!doctype html><meta charset="utf-8"><script>parent.postMessage(' + payload +
    ', "https://scantec77-diag.github.io");</script>';
  return HtmlService.createHtmlOutput(html);
}
