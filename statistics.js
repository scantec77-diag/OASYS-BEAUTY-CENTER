import { AVAILABILITY_ENDPOINT } from './app-config.js';

const depositElement = document.getElementById('stats-deposits');
const manualElement = document.getElementById('stats-manual-income');
const totalElement = document.getElementById('stats-total-income');
const completedList = document.getElementById('services-completed-list');
const adminList = document.getElementById('admin-completion-list');
const adminStatus = document.getElementById('admin-completion-status');
const frame = document.getElementById('oasis-completed-services-frame');
const money = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const validEndpoint = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(AVAILABILITY_ENDPOINT);
let adminSession = window.oasisAdminSession || null;
let pendingAction = '';

function readAmount(element) {
  if (!element) return null;
  const rawValue = String(element.dataset.value || '').trim();
  if (rawValue) {
    const numericValue = Number(rawValue);
    if (Number.isFinite(numericValue) && numericValue >= 0) return numericValue;
  }
  const source = String(element.textContent || '').trim();
  const cleaned = source.replace(/[^0-9,.-]/g, '');
  if (!cleaned) return null;
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\\./g, '').replace(',', '.')
    : cleaned.replace(/\\./g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function updateTotal() {
  const deposit = readAmount(depositElement);
  const manual = readAmount(manualElement);
  if (deposit === null && manual === null) {
    totalElement.textContent = '$ —';
    return;
  }
  totalElement.textContent = '$ ' + money.format((deposit || 0) + (manual || 0));
}

function renderCompletedCounts(counts) {
  completedList.replaceChildren();
  const entries = Object.entries(counts || {})
    .filter(([, count]) => Number(count) > 0)
    .sort(([a], [b]) => a.localeCompare(b, 'es-AR'));
  if (!entries.length) {
    const empty = document.createElement('span');
    empty.className = 'muted';
    empty.textContent = 'Todavía no hay servicios marcados como realizados.';
    completedList.append(empty);
    return;
  }
  for (const [name, count] of entries) {
    const item = document.createElement('span');
    item.className = 'service-count-item';
    item.append(document.createTextNode(name + ' '));
    const number = document.createElement('strong');
    number.textContent = String(count);
    item.append(number);
    completedList.append(item);
  }
}

function renderAdminAppointments(appointments) {
  adminList.replaceChildren();
  if (!appointments?.length) {
    const empty = document.createElement('span');
    empty.className = 'muted';
    empty.textContent = 'No hay turnos pendientes de marcar como realizados.';
    adminList.append(empty);
    return;
  }
  const dateFormat = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires'
  });
  for (const appointment of appointments) {
    const row = document.createElement('div');
    row.className = 'admin-completion-row';
    const details = document.createElement('p');
    const date = new Date(appointment.start);
    details.textContent = appointment.service + ' · ' +
      (Number.isNaN(date.getTime()) ? '' : dateFormat.format(date));
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = 'Marcar realizado';
    button.addEventListener('click', () => {
      if (!window.confirm('¿Confirmás que se realizó ' + appointment.service + '? El contador se actualizará.')) return;
      sendAdminAction('markServiceDone', { eventId: appointment.id });
    });
    row.append(details, button);
    adminList.append(row);
  }
}

function sendAdminAction(action, extra = {}) {
  if (pendingAction || !validEndpoint || !adminSession?.idToken) return;
  pendingAction = action;
  window.setTimeout(() => {
    if (pendingAction === action) {
      pendingAction = '';
      adminStatus.textContent = 'La agenda tardó en responder. Tocá para volver a consultar en unos segundos.';
    }
  }, 20000);
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = AVAILABILITY_ENDPOINT;
  form.target = frame.name;
  form.hidden = true;
  const fields = { action, idToken: adminSession.idToken, ...extra };
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = String(value);
    form.append(input);
  }
  document.body.append(form);
  form.submit();
  form.remove();
}

function refreshAdminAgenda() {
  if (!adminSession?.idToken) return;
  if (!validEndpoint) {
    adminStatus.textContent = 'Falta vincular la aplicación web de horarios para consultar la agenda.';
    return;
  }
  adminStatus.textContent = 'Actualizando la agenda y los servicios realizados…';
  sendAdminAction('loadServiceAgenda');
}

window.addEventListener('message', event => {
  if (event.source !== frame.contentWindow || event.data?.type !== 'oasis-service-agenda') return;
  const wasMarking = pendingAction === 'markServiceDone';
  pendingAction = '';
  adminStatus.textContent = event.data.message || (event.data.ok ? 'Agenda actualizada.' : 'No se pudo actualizar la agenda.');
  if (!event.data.ok) return;
  renderCompletedCounts(event.data.data?.counts || {});
  renderAdminAppointments(event.data.data?.appointments || []);
  if (wasMarking) window.setTimeout(refreshAdminAgenda, 350);
});

document.addEventListener('oasis:admin-auth', event => {
  adminSession = event.detail || null;
  if (adminSession?.idToken) refreshAdminAgenda();
  else {
    adminStatus.textContent = '';
    adminList.replaceChildren();
    renderCompletedCounts({});
  }
});

updateTotal();
const observer = new MutationObserver(updateTotal);
for (const element of [depositElement, manualElement]) {
  if (element) observer.observe(element, {
    attributes: true, attributeFilter: ['data-value'], childList: true,
    characterData: true, subtree: true
  });
}
if (adminSession?.idToken) refreshAdminAgenda();
window.setInterval(refreshAdminAgenda, 30000);
