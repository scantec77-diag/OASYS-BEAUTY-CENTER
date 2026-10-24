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
  if (String(params.action || '') !== 'saveSchedule') return postResult_(false, 'Acción no válida.');
  const email = verifyAdmin_(String(params.idToken || ''));
  if (!email) return postResult_(false, 'No se pudo verificar la cuenta administradora.');

  const days = String(params.days || '').split(',').filter(Boolean).map(Number);
  const openTime = String(params.openTime || '');
  const closeTime = String(params.closeTime || '');
  if (days.some(day => !Number.isInteger(day) || day < 1 || day > 7) ||
      !/^([01]\d|2[0-3]):(00|30)$/.test(openTime) ||
      !/^([01]\d|2[0-3]):(00|30)$/.test(closeTime) ||
      timeMinutes_(closeTime) <= timeMinutes_(openTime)) {
    return postResult_(false, 'Revisá los días y el horario elegido.');
  }
  const schedule = { days: Array.from(new Set(days)).sort((a,b) => a-b), openTime, closeTime, updatedAt: new Date().toISOString() };
  PropertiesService.getScriptProperties().setProperty(SETTINGS_KEY, JSON.stringify(schedule));
  return postResult_(true, 'Horario guardado.');
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

function timeMinutes_(value) {
  const parts = value.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

function jsonp(callback, data) {
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(data) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function postResult_(ok, message) {
  const payload = JSON.stringify({ type: 'oasis-schedule-save', ok, message });
  const html = '<!doctype html><meta charset="utf-8"><script>parent.postMessage(' + payload +
    ', "https://scantec77-diag.github.io");</script>';
  return HtmlService.createHtmlOutput(html);
}
