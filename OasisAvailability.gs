const CALENDAR_ID = '04f4ef16777302474a8fDcJHrrHSgvFpsYxqb6g97uaQTd2kE31rPUeDZTeDsjVq@group.calendar.google.com';
const TIME_ZONE = 'America/Argentina/Buenos_Aires';

function doGet(e) {
  const callback = String(e.parameter.callback || '');
  if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService.createTextOutput('Invalid callback').setMimeType(ContentService.MimeType.TEXT);
  }
  const date = String(e.parameter.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonp(callback, { ok: false, error: 'invalid_date' });
  }
  try {
    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    if (!calendar) return jsonp(callback, { ok: false, error: 'calendar_unavailable' });
    const dayStart = new Date(date + 'T09:00:00-03:00');
    const dayEnd = new Date(date + 'T21:00:00-03:00');
    const busy = calendar.getEvents(dayStart, dayEnd).map(event => ({
      start: event.getStartTime().toISOString(),
      end: event.getEndTime().toISOString()
    }));
    return jsonp(callback, { ok: true, date, busy });
  } catch (error) {
    return jsonp(callback, { ok: false, error: 'calendar_read_failed' });
  }
}

function jsonp(callback, data) {
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(data) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
