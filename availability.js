import { APPS_SCRIPT_ENDPOINT } from './app-config.js';

const monthLabel = document.getElementById('availability-month');
const grid = document.getElementById('availability-grid');
const dayLabel = document.getElementById('availability-selected-day');
const slots = document.getElementById('availability-slots');
const status = document.getElementById('availability-status');
const previous = document.getElementById('availability-prev');
const next = document.getElementById('availability-next');
const todayParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric', month: '2-digit', day: '2-digit'
}).formatToParts(new Date());
const getPart = type => todayParts.find(part => part.type === type).value;
const today = new Date(Number(getPart('year')), Number(getPart('month')) - 1, Number(getPart('day')));
let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDate = new Date(today);

const spanishDate = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
});
const validEndpoint = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(APPS_SCRIPT_ENDPOINT);

function isoDate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
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
    button.addEventListener('click', () => {
      selectedDate = date;
      renderMonth();
      renderDay();
    });
    grid.append(button);
  }
}

function renderDay() {
  const dateText = spanishDate.format(selectedDate);
  dayLabel.textContent = dateText.charAt(0).toLocaleUpperCase('es-AR') + dateText.slice(1);
  slots.replaceChildren();
  status.textContent = validEndpoint
    ? 'Consultando disponibilidad…'
    : 'La conexión de disponibilidad todavía no está activada.';
  for (let hour = 9; hour < 21; hour++) {
    const row = document.createElement('div');
    row.className = 'availability-slot pending';
    row.innerHTML = '<time></time><span></span>';
    row.querySelector('time').textContent = String(hour).padStart(2, '0') + ':00';
    row.querySelector('span').textContent = validEndpoint ? 'Consultando…' : 'Sin datos todavía';
    slots.append(row);
  }
  if (validEndpoint) loadBusyTimes(isoDate(selectedDate));
}

function loadBusyTimes(date) {
  const callbackName = 'oasisAvailability' + Date.now();
  const script = document.createElement('script');
  const timeout = setTimeout(() => finish(null), 12000);
  function finish(result) {
    clearTimeout(timeout);
    delete window[callbackName];
    script.remove();
    if (!result?.ok || result.date !== date) {
      status.textContent = 'No se pudo consultar la agenda. Volvé a cargar la página.';
      return;
    }
    const events = result.busy.map(item => ({
      start: new Date(item.start).getTime(),
      end: new Date(item.end).getTime()
    }));
    const dayStart = new Date(date + 'T00:00:00-03:00');
    [...slots.children].forEach((row, index) => {
      const start = dayStart.getTime() + (9 + index) * 60 * 60 * 1000;
      const end = start + 60 * 60 * 1000;
      const busy = events.some(event => event.start < end && event.end > start);
      row.className = 'availability-slot ' + (busy ? 'busy' : 'free');
      row.querySelector('span').textContent = busy ? 'Ocupado' : 'Disponible';
    });
    status.textContent = 'Disponibilidad consultada · horario del centro: 09:00 a 21:00.';
  }
  window[callbackName] = finish;
  script.onerror = () => finish(null);
  script.src = APPS_SCRIPT_ENDPOINT + '?date=' + encodeURIComponent(date) + '&callback=' + encodeURIComponent(callbackName);
  document.head.append(script);
}

previous.addEventListener('click', () => {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
  renderMonth();
});
next.addEventListener('click', () => {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  renderMonth();
});

renderMonth();
renderDay();
