import { AVAILABILITY_ENDPOINT } from './app-config.js';
const { addDoc, collection, getDocsFromServer, query, serverTimestamp, where } =
  await import('https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js');

const depositElement = document.getElementById('stats-deposits');
const manualElement = document.getElementById('stats-manual-income');
const totalElement = document.getElementById('stats-total-income');
const completedList = document.getElementById('services-completed-list');
const adminList = document.getElementById('admin-completion-list');
const adminStatus = document.getElementById('admin-completion-status');
const frame = document.getElementById('oasis-completed-services-frame');
const paymentButton = document.getElementById('admin-manual-payment-button');
const paymentEditor = document.getElementById('admin-manual-payment-editor');
const paymentForm = document.getElementById('admin-manual-payment-form');
const paymentAmount = document.getElementById('admin-manual-payment-amount');
const paymentSave = document.getElementById('admin-manual-payment-save');
const paymentStatus = document.getElementById('admin-manual-payment-status');
const depositButton = document.getElementById('admin-confirm-deposit-button');
const depositEditor = document.getElementById('admin-confirm-deposit-editor');
const depositForm = document.getElementById('admin-confirm-deposit-form');
const depositReference = document.getElementById('admin-confirm-deposit-reference');
const depositClient = document.getElementById('admin-confirm-deposit-client');
const depositAmount = document.getElementById('admin-confirm-deposit-amount');
const depositSave = document.getElementById('admin-confirm-deposit-save');
const depositStatus = document.getElementById('admin-confirm-deposit-status');
const money = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const validEndpoint = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(AVAILABILITY_ENDPOINT);
let adminSession = window.oasisAdminSession || null;
let pendingAction = '';

function buenosAiresDayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const get = type => parts.find(part => part.type === type).value;
  return get('year') + '-' + get('month') + '-' + get('day');
}

async function refreshManualIncome() {
  if (!adminSession?.idToken) return false;
  const db = window.oasisAdminServices?.db;
  if (!db) {
    paymentStatus.textContent = 'No se pudo conectar con Firestore.';
    return false;
  }
  try {
    const dayKey = buenosAiresDayKey();
    const dailyPayments = query(
      collection(db, 'pagosManuales'),
      where('dayKey', '==', dayKey)
    );
    const snapshot = await getDocsFromServer(dailyPayments);
    const total = snapshot.docs.reduce((sum, item) => {
      const amount = Number(item.data().monto);
      return Number.isFinite(amount) && amount > 0 ? sum + amount : sum;
    }, 0);
    manualElement.dataset.value = String(total);
    manualElement.textContent = '$ ' + money.format(total);
    paymentStatus.textContent = 'Ingresos manuales de hoy actualizados.';
    return true;
  } catch (error) {
    paymentStatus.textContent = error?.code === 'permission-denied'
      ? 'Firebase todavía no permite consultar pagos. Publicá las reglas actualizadas de Firestore.'
      : 'No se pudo actualizar el resumen de pagos manuales.';
    return false;
  }
}

async function refreshDeposits() {
  if (!adminSession?.idToken) return false;
  const db = window.oasisAdminServices?.db;
  if (!db) return false;
  try {
    const dayKey = buenosAiresDayKey();
    const dailyDeposits = query(
      collection(db, 'senasRecibidas'),
      where('dayKey', '==', dayKey)
    );
    const snapshot = await getDocsFromServer(dailyDeposits);
    const total = snapshot.docs.reduce((sum, item) => {
      const amount = Number(item.data().monto);
      return Number.isFinite(amount) && amount > 0 ? sum + amount : sum;
    }, 0);
    depositElement.dataset.value = String(total);
    depositElement.textContent = '$ ' + money.format(total);
    updateTotal();
    depositStatus.textContent = 'Señas recibidas de hoy actualizadas.';
    return true;
  } catch (error) {
    depositStatus.textContent = error?.code === 'permission-denied'
      ? 'Firebase todavía no permite consultar señas. Publicá las reglas actualizadas de Firestore.'
      : 'No se pudo actualizar el total de señas.';
    return false;
  }
}

depositButton?.addEventListener('click', () => {
  depositEditor.hidden = false;
  depositButton.setAttribute('aria-expanded', 'true');
  depositEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('admin-confirm-deposit-title').focus({ preventScroll: true });
});
document.getElementById('admin-confirm-deposit-close')?.addEventListener('click', () => {
  depositEditor.hidden = true;
  depositButton.setAttribute('aria-expanded', 'false');
  depositButton.focus();
});
depositForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!depositForm.reportValidity()) return;
  const reference = depositReference.value.trim();
  const client = depositClient.value.trim().replace(/\\s+/g, ' ');
  const amount = Number(depositAmount.value);
  const user = window.oasisAdminServices?.auth?.currentUser;
  const email = String(user?.email || '').trim().toLowerCase();
  const db = window.oasisAdminServices?.db;
  if (!adminSession?.idToken || !user?.emailVerified || email !== 'oasysbeautycenter@gmail.com') {
    depositStatus.textContent = 'Iniciá sesión con la cuenta administradora de Oasis.';
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
    depositStatus.textContent = 'Ingresá un importe válido en pesos.';
    return;
  }
  if (!db) {
    depositStatus.textContent = 'No se pudo conectar con Firestore.';
    return;
  }
  depositSave.disabled = true;
  depositStatus.textContent = 'Guardando la seña recibida…';
  try {
    await addDoc(collection(db, 'senasRecibidas'), {
      referencia: reference,
      cliente: client,
      monto: amount,
      dayKey: buenosAiresDayKey(),
      createdAt: serverTimestamp(),
      createdBy: email
    });
    depositForm.reset();
    await refreshDeposits();
    depositStatus.textContent = 'Seña de $ ' + money.format(amount) + ' vinculada a la reserva ' + reference + '. Total actualizado.';
  } catch (error) {
    depositStatus.textContent = error?.code === 'permission-denied'
      ? 'Firebase rechazó el registro. Publicá las reglas actualizadas de Firestore.'
      : 'No se pudo guardar la seña. Revisá la conexión y volvé a intentar.';
  } finally {
    depositSave.disabled = false;
  }
});

paymentButton.addEventListener('click', () => {
  paymentEditor.hidden = false;
  paymentButton.setAttribute('aria-expanded', 'true');
  paymentEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('admin-manual-payment-title').focus({ preventScroll: true });
  paymentAmount.focus({ preventScroll: true });
});
document.getElementById('admin-manual-payment-close').addEventListener('click', () => {
  paymentEditor.hidden = true;
  paymentButton.setAttribute('aria-expanded', 'false');
  paymentButton.focus();
});

paymentForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!paymentForm.reportValidity()) return;
  const amount = Number(paymentAmount.value);
  const user = window.oasisAdminServices?.auth?.currentUser;
  const email = String(user?.email || '').trim().toLowerCase();
  if (!adminSession?.idToken || !user?.emailVerified) {
    paymentStatus.textContent = 'Iniciá sesión con la cuenta administradora de Oasis.';
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
    paymentStatus.textContent = 'Ingresá un importe válido en pesos.';
    return;
  }
  const db = window.oasisAdminServices?.db;
  if (!db) {
    paymentStatus.textContent = 'No se pudo conectar con Firestore.';
    return;
  }
  paymentSave.disabled = true;
  paymentStatus.textContent = 'Guardando pago manual…';
  try {
    await addDoc(collection(db, 'pagosManuales'), {
      monto: amount,
      dayKey: buenosAiresDayKey(),
      createdAt: serverTimestamp(),
      createdBy: email
    });
    paymentForm.reset();
    const refreshed = await refreshManualIncome();
    paymentStatus.textContent = refreshed
      ? 'Pago de $ ' + money.format(amount) + ' registrado. Total del día actualizado.'
      : 'Pago registrado; el resumen del día se actualizará cuando Firestore responda.';
  } catch (error) {
    paymentStatus.textContent = error?.code === 'permission-denied'
      ? 'Firebase rechazó el pago. Publicá las reglas actualizadas de Firestore.'
      : 'No se pudo guardar el pago manual. Revisá la conexión con Firestore.';
  } finally {
    paymentSave.disabled = false;
  }
});

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
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/\./g, '');
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
  if (adminSession?.idToken) {
    refreshAdminAgenda();
    refreshManualIncome();
    refreshDeposits();
  }
  else {
    adminStatus.textContent = '';
    paymentEditor.hidden = true;
    paymentButton.setAttribute('aria-expanded', 'false');
    if (depositEditor) depositEditor.hidden = true;
    depositButton?.setAttribute('aria-expanded', 'false');
    manualElement.dataset.value = '';
    manualElement.textContent = '$ —';
    depositElement.dataset.value = '';
    depositElement.textContent = '$ —';
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
if (adminSession?.idToken) { refreshAdminAgenda(); refreshManualIncome(); refreshDeposits(); }
window.setInterval(() => { refreshAdminAgenda(); refreshManualIncome(); refreshDeposits(); }, 30000);
