const byId = id => document.getElementById(id);
const depositPanel = byId('booking-deposit');
const amountLabel = byId('booking-deposit-amount');
const walletDetails = byId('booking-wallet-details');
const depositInput = byId('booking-deposit-amount-value');
const status = byId('booking-deposit-status');
const adminButton = byId('admin-deposit-button');
const editor = byId('admin-deposit-editor');
const form = byId('admin-deposit-form');
const formStatus = byId('admin-deposit-status');
const save = byId('admin-deposit-save');
const money = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const { doc, getDocFromServer, setDoc, serverTimestamp } =
  await import('https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js');
let adminSession = window.oasisAdminSession || null;
let settings = null;

function renderPublicSettings(value) {
  settings = value || null;
  if (!depositPanel) return;
  if (!settings || !Number.isFinite(Number(settings.amount)) || Number(settings.amount) <= 0) {
    amountLabel.textContent = 'A confirmar';
    depositInput.value = '';
    walletDetails.textContent = 'El centro informará el importe y los datos de pago al confirmar el turno.';
    status.textContent = 'La seña todavía no está configurada.';
    return;
  }
  const amount = Number(settings.amount);
  amountLabel.textContent = '$ ' + money.format(amount);
  depositInput.value = String(amount);
  status.textContent = 'Este importe se descontará del valor del servicio.';
  const lines = [];
  if (settings.walletName) lines.push('Billetera: ' + settings.walletName);
  if (settings.accountHolder) lines.push('Titular: ' + settings.accountHolder);
  if (settings.alias) lines.push('Alias: ' + settings.alias);
  if (settings.cbuCvu) lines.push('CBU/CVU: ' + settings.cbuCvu);
  if (settings.paymentLink) lines.push('Link de pago: ' + settings.paymentLink);
  walletDetails.textContent = lines.length
    ? lines.join(' · ')
    : 'Los datos de la billetera se informarán al confirmar el turno.';
}

async function loadPublicSettings() {
  try {
    const db = window.oasisAdminServices?.db;
    if (!db) throw new Error('firestore-not-ready');
    const snapshot = await getDocFromServer(doc(db, 'configuracionPublica', 'senas'));
    renderPublicSettings(snapshot.exists() ? snapshot.data() : null);
  } catch {
    if (status) status.textContent = 'No se pudo cargar el importe de la seña. Consultalo con Oasis.';
  }
}

function fillAdminForm(value) {
  byId('admin-deposit-amount').value = value?.amount ?? '';
  byId('admin-deposit-wallet').value = value?.walletName || '';
  byId('admin-deposit-holder').value = value?.accountHolder || '';
  byId('admin-deposit-alias').value = value?.alias || '';
  byId('admin-deposit-cbu').value = value?.cbuCvu || '';
  byId('admin-deposit-link').value = value?.paymentLink || '';
}

async function loadAdminSettings() {
  const db = window.oasisAdminServices?.db;
  if (!db) {
    formStatus.textContent = 'No se pudo conectar con Firestore.';
    return;
  }
  try {
    const snapshot = await getDocFromServer(doc(db, 'configuracionPublica', 'senas'));
    fillAdminForm(snapshot.exists() ? snapshot.data() : null);
    formStatus.textContent = snapshot.exists()
      ? 'Configuración actual cargada.'
      : 'Configurá el importe y la billetera que recibirán las señas.';
  } catch (error) {
    formStatus.textContent = error?.code === 'permission-denied'
      ? 'Falta publicar las reglas de Firestore que permiten consultar la configuración de señas.'
      : 'No se pudo cargar la configuración. Revisá la conexión.';
  }
}

adminButton?.addEventListener('click', async () => {
  editor.hidden = false;
  adminButton.setAttribute('aria-expanded', 'true');
  editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  byId('admin-deposit-title').focus({ preventScroll: true });
  await loadAdminSettings();
});
byId('admin-deposit-close')?.addEventListener('click', () => {
  editor.hidden = true;
  adminButton.setAttribute('aria-expanded', 'false');
  adminButton.focus();
});

form?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const user = window.oasisAdminServices?.auth?.currentUser;
  const email = String(user?.email || '').trim().toLowerCase();
  const amount = Number(byId('admin-deposit-amount').value);
  if (!adminSession?.idToken || !user?.emailVerified || email !== 'oasysbeautycenter@gmail.com') {
    formStatus.textContent = 'Iniciá sesión con la cuenta administradora de Oasis.';
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
    formStatus.textContent = 'Ingresá un importe válido para la seña.';
    return;
  }
  const value = {
    amount,
    walletName: byId('admin-deposit-wallet').value.trim().slice(0, 60),
    accountHolder: byId('admin-deposit-holder').value.trim().slice(0, 100),
    alias: byId('admin-deposit-alias').value.trim().slice(0, 80),
    cbuCvu: byId('admin-deposit-cbu').value.trim().slice(0, 40),
    paymentLink: byId('admin-deposit-link').value.trim().slice(0, 500),
    updatedAt: serverTimestamp(),
    updatedBy: email
  };
  save.disabled = true;
  formStatus.textContent = 'Guardando la seña y los datos de la billetera…';
  try {
    await setDoc(doc(window.oasisAdminServices.db, 'configuracionPublica', 'senas'), value);
    renderPublicSettings(value);
    formStatus.textContent = 'Seña guardada. El importe y los datos de pago aparecen en la reserva.';
  } catch (error) {
    formStatus.textContent = error?.code === 'permission-denied'
      ? 'Firebase rechazó el guardado. Publicá las reglas actualizadas de Firestore.'
      : 'No se pudo guardar la seña. Revisá la conexión y volvé a intentar.';
  } finally {
    save.disabled = false;
  }
});

document.addEventListener('oasis:admin-auth', event => {
  adminSession = event.detail || null;
  if (adminButton) adminButton.hidden = !adminSession;
  if (!adminSession && editor) {
    editor.hidden = true;
    adminButton?.setAttribute('aria-expanded', 'false');
  }
  if (adminSession?.idToken) loadAdminSettings();
});

document.addEventListener('oasis:customer', () => {
  if (depositPanel) loadPublicSettings();
});
if (adminSession?.idToken) loadAdminSettings();
loadPublicSettings();
