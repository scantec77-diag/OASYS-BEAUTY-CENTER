import { APPS_SCRIPT_ENDPOINT } from './app-config.js';

const monthLabel = document.getElementById('availability-month');
const grid = document.getElementById('availability-grid');
const dayLabel = document.getElementById('availability-selected-day');
const slots = document.getElementById('availability-slots');
const status = document.getElementById('availability-status');
const previous = document.getElementById('availability-prev');
const next = document.getElementById('availability-next');
const editButton = document.getElementById('availability-edit-button');
const editor = document.getElementById('availability-editor');
const settingsForm = document.getElementById('availability-settings-form');
const settingsStatus = document.getElementById('availability-settings-status');
const saveButton = document.getElementById('availability-settings-save');
const frame = document.getElementById('oasis-schedule-save-frame');
const defaultSchedule = { days: [], openTime: '09:00', closeTime: '21:00' };
const todayParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric', month: '2-digit', day: '2-digit'
}).formatToParts(new Date());
const getPart = type => todayParts.find(part => part.type === type).value;
const today = new Date(Number(getPart('year')), Number(getPart('month')) - 1, Number(getPart('day')));
let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDate = new Date(today);
let schedule = { ...defaultSchedule };
let scheduleLoaded = false;
let adminSession = null;

const spanishDate = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
});
const validEndpoint = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(APPS_SCRIPT_ENDPOINT);

function isoDate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

function weekday(date) {
  const value = date.getDay();
  return value || 7;
}

function loadJSONP(params) {
  return new Promise((resolve, reject) => {
    const callbackName = 'oasisCalendar' + Date.now() + Math.floor(Math.random() * 1000);
    const script = document.createElement('script');
    const timeout = setTimeout(() => finish(null), 12000);
    function finish(result) {
      clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
      if (result) resolve(result);
      else reject(new Error('No se pudo consultar la agenda.'));
    }
    window[callbackName] = finish;
    script.onerror = () => finish(null);
    const query = new URLSearchParams({ ...params, callback: callbackName });
    script.src = APPS_SCRIPT_ENDPOINT + '?' + query.toString();
    document.head.append(script);
  });
}

function renderMonth() {
  monthLabel.textContent = new Intl.DateTimeFormat('es-AR', {
    month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires'
  }).format(visibleMonth);
  grid.replaceChildren();
  const offset = (new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay() + 6) % 7;
  const days = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  for (let i = 0; i < offset; i++) {
    const blank = document.createElement('span');
    blank.className = 'availability-day blank';
    blank.setAttribute('aria-hidden', 'true');
    grid.append(blank);
  }
  for (let day = 1; day <= days; day++) {
    const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'availability-day';
    button.textContent = String(day);
    button.setAttribute('aria-label', spanishDate.format(date));
    button.setAttribute('aria-pressed', String(isoDate(date) === isoDate(selectedDate)));
    if (isoDate(date) === isoDate(today)) button.classList.add('today');
    if (scheduleLoaded && !schedule.days.includes(weekday(date))) button.classList.add('closed-day');
    button.addEventListener('click', () => {
      selectedDate = date;
      renderMonth();
      renderDay();
    });
    grid.append(button);
  }
}

function minutes(value) {
  const [hours, mins] = value.split(':').map(Number);
  return hours * 60 + mins;
}

function timeLabel(value) {
  return String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
}

function renderDay(busyIntervals = null) {
  const dateText = spanishDate.format(selectedDate);
  dayLabel.textContent = dateText.charAt(0).toLocaleUpperCase('es-AR') + dateText.slice(1);
  slots.replaceChildren();

  if (!scheduleLoaded) {
    status.textContent = validEndpoint ? 'Cargando los días y horarios de Oasis…' : 'La conexión para consultar y guardar horarios todavía está pendiente.';
    return;
  }
  if (!schedule.days.length) {
    status.textContent = 'Los días de atención todavía no están configurados.';
    return;
  }
  if (!schedule.days.includes(weekday(selectedDate))) {
    status.textContent = 'Oasis no atiende este día.';
    return;
  }

  const open = minutes(schedule.openTime);
  const close = minutes(schedule.closeTime);
  if (busyIntervals === null) {
    for (let start = open; start < close; start += 60) {
      addSlot(start, Math.min(start + 60, close), 'pending', 'Consultando…');
    }
    status.textContent = 'Consultando reservas…';
    return;
  }

  const selectedIso = isoDate(selectedDate);
  const dayStart = new Date(selectedIso + 'T00:00:00-03:00').getTime();
  for (let start = open; start < close; start += 60) {
    const end = Math.min(start + 60, close);
    const startMs = dayStart + start * 60 * 1000;
    const endMs = dayStart + end * 60 * 1000;
    const isBusy = busyIntervals.some(event => event.start < endMs && event.end > startMs);
    addSlot(start, end, isBusy ? 'busy' : 'free', isBusy ? 'Ocupado' : 'Disponible');
  }
  status.textContent = 'Horario de atención: ' + schedule.openTime + ' a ' + schedule.closeTime + '.';
}

function addSlot(start, end, state, label) {
  const row = document.createElement('div');
  row.className = 'availability-slot ' + state;
  const time = document.createElement('time');
  time.textContent = timeLabel(start) + (end - start < 60 ? '–' + timeLabel(end) : '');
  const description = document.createElement('span');
  description.textContent = label;
  row.append(time, description);
  slots.append(row);
}

async function refreshSelectedDay() {
  renderDay(null);
  if (!validEndpoint || !scheduleLoaded || !schedule.days.includes(weekday(selectedDate))) return;
  try {
    const result = await loadJSONP({ action: 'availability', date: isoDate(selectedDate) });
    if (!result.ok || result.date !== isoDate(selectedDate)) throw new Error('Agenda no disponible.');
    if (result.closed) {
      status.textContent = 'Oasis no atiende este día.';
      slots.replaceChildren();
      return;
    }
    const busy = (result.busy || []).map(item => ({
      start: new Date(item.start).getTime(),
      end: new Date(item.end).getTime()
    }));
    renderDay(busy);
  } catch {
    status.textContent = 'No se pudo consultar la agenda. Volvé a intentarlo más tarde.';
    slots.replaceChildren();
  }
}

function renderEditor() {
  settingsForm.querySelectorAll('input[name="days"]').forEach(input => {
    input.checked = schedule.days.includes(Number(input.value));
  });
  document.getElementById('availability-open-time').value = schedule.openTime;
  document.getElementById('availability-close-time').value = schedule.closeTime;
  saveButton.disabled = !validEndpoint || !adminSession?.idToken;
}

async function loadSettings() {
  if (!validEndpoint) {
    schedule = { ...defaultSchedule };
    scheduleLoaded = false;
    renderMonth();
    renderEditor();
    renderDay();
    return;
  }
  try {
    const result = await loadJSONP({ action: 'settings' });
    if (!result.ok || !result.schedule) throw new Error('Configuración no disponible.');
    schedule = {
      days: Array.isArray(result.schedule.days) ? result.schedule.days.map(Number) : [],
      openTime: result.schedule.openTime || '09:00',
      closeTime: result.schedule.closeTime || '21:00'
    };
    scheduleLoaded = true;
    renderMonth();
    renderEditor();
    refreshSelectedDay();
  } catch {
    scheduleLoaded = false;
    status.textContent = 'No se pudo cargar la configuración de horarios.';
    renderEditor();
  }
}

editButton.addEventListener('click', () => {
  editor.hidden = !editor.hidden;
  if (!editor.hidden) renderEditor();
});

settingsForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!validEndpoint || !adminSession?.idToken) {
    settingsStatus.textContent = 'Iniciá sesión como administradora y vinculá la aplicación web de horarios.';
    return;
  }
  if (!settingsForm.reportValidity()) return;
  const data = new FormData(settingsForm);
  const dayValues = data.getAll('days');
  if (!dayValues.length) {
    settingsStatus.textContent = 'Seleccioná al menos un día de atención.';
    return;
  }
  const days = dayValues.join(',');
  const openTime = String(data.get('openTime'));
  const closeTime = String(data.get('closeTime'));
  if (minutes(closeTime) <= minutes(openTime)) {
    settingsStatus.textContent = 'La hora de cierre tiene que ser posterior a la apertura.';
    return;
  }
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = APPS_SCRIPT_ENDPOINT;
  form.target = frame.name;
  form.hidden = true;
  const fields = { action: 'saveSchedule', idToken: adminSession.idToken, days, openTime, closeTime };
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.append(input);
  }
  frame.onload = () => {
    frame.onload = null;
    settingsStatus.textContent = 'Guardado. Actualizando la agenda…';
    window.setTimeout(loadSettings, 900);
  };
  settingsStatus.textContent = 'Guardando días y horarios…';
  document.body.append(form);
  form.submit();
  form.remove();
});

window.addEventListener('message', event => {
  if (event.source !== frame.contentWindow || event.data?.type !== 'oasis-schedule-save') return;
  settingsStatus.textContent = event.data.message || (event.data.ok ? 'Horario guardado.' : 'No se pudo guardar.');
  if (event.data.ok) window.setTimeout(loadSettings, 400);
});

document.addEventListener('oasis:admin-auth', event => {
  adminSession = event.detail || null;
  editButton.hidden = !adminSession;
  saveButton.disabled = !validEndpoint || !adminSession?.idToken;
  if (adminSession) settingsStatus.textContent = validEndpoint
    ? 'Elegí los días y el horario de atención.'
    : 'Falta publicar y vincular el servicio de horarios.';
  else settingsStatus.textContent = '';
});

previous.addEventListener('click', () => {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
  renderMonth();
});
next.addEventListener('click', () => {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  renderMonth();
});

renderMonth();
renderEditor();
renderDay();
loadSettings();
