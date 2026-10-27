import { ADMIN_EMAILS } from './admin-config.js';
import { APPS_SCRIPT_ENDPOINT, WEB_PUSH_VAPID_KEY } from './app-config.js';

const byId = id => document.getElementById(id);
const status = byId('admin-auth-status');
const loginButton = byId('admin-google-login');
const session = byId('admin-session');
const stats = byId('estadisticas');
const normalizedAdmins = ADMIN_EMAILS.map(email => String(email).trim().toLowerCase()).filter(Boolean);
const clientsButton = byId('admin-clients-button');
const clientsEditor = byId('admin-clients-editor');
const clientsForm = byId('admin-client-form');
const clientsStatus = byId('admin-client-status');
const clientsSave = byId('admin-client-save');

function publishAdminAuth(detail) {
  window.oasisAdminSession = detail;
  for (const id of ['admin-services-button', 'admin-clients-button', 'availability-edit-button', 'admin-manual-payment-button']) {
    const button = document.getElementById(id);
    if (button) button.hidden = !detail;
  }
  if (!detail && clientsEditor) {
    clientsEditor.hidden = true;
    clientsButton?.setAttribute('aria-expanded', 'false');
    const paymentEditor = document.getElementById('admin-manual-payment-editor');
    paymentEditor.hidden = true;
    document.getElementById('admin-manual-payment-button')?.setAttribute('aria-expanded', 'false');
  }
  document.dispatchEvent(new CustomEvent('oasis:admin-auth', { detail }));
}

function showSignedOut(message) {
  byId('admin-email').textContent = '';
  session.hidden = true;
  loginButton.hidden = false;
  stats.hidden = true;
  publishAdminAuth(null);
  if (message) status.textContent = message;
}

clientsButton?.addEventListener('click', () => {
  clientsEditor.hidden = false;
  clientsButton.setAttribute('aria-expanded', 'true');
  clientsEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  byId('admin-clients-title').focus({ preventScroll: true });
});
byId('admin-clients-close')?.addEventListener('click', () => {
  clientsEditor.hidden = true;
  clientsButton.setAttribute('aria-expanded', 'false');
  clientsButton.focus();
});

if (!normalizedAdmins.length) {
  status.textContent = 'Falta configurar el Gmail administrador para habilitar el acceso.';
} else {
  loginButton.disabled = false;
  status.textContent = 'Ingresá con el Gmail autorizado de Oasis.';
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js');
  const { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } =
    await import('https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js');
  const app = initializeApp({
    apiKey: 'AIzaSyBo-OXa4h6wD_3TyKtL3LBulaRDse8z8po',
    authDomain: 'oasysbeautycenter.firebaseapp.com',
    projectId: 'oasysbeautycenter',
    storageBucket: 'oasysbeautycenter.firebasestorage.app',
    messagingSenderId: '26340609563',
    appId: '1:26340609563:web:61aff5ee2cc95ec267b2be'
  }, 'oasys-admin');
  const auth = getAuth(app);
  const { getFirestore, doc, getDocFromServer, setDoc, serverTimestamp } =
    await import('https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js');
  const db = getFirestore(app);
  window.oasisAdminServices = { auth, db };
  auth.languageCode = 'es';

  clientsForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!clientsForm.reportValidity()) return;
    const user = auth.currentUser;
    const currentEmail = String(user?.email || '').trim().toLowerCase();
    if (!user || !user.emailVerified || !normalizedAdmins.includes(currentEmail)) {
      clientsStatus.textContent = 'Iniciá sesión con el Gmail administrador de Oasis para cargar clientes.';
      return;
    }
    const nombre = byId('admin-client-name').value.trim().replace(/\s+/g, ' ');
    const email = byId('admin-client-email').value.trim().toLowerCase();
    const telefono = byId('admin-client-phone').value.trim();
    if (!nombre || nombre.length > 80 || !/^[+() 0-9-]{7,25}$/.test(telefono)) {
      clientsStatus.textContent = 'Revisá el nombre y el teléfono ingresados.';
      return;
    }
    clientsSave.disabled = true;
    clientsStatus.textContent = 'Guardando la ficha en la base de datos…';
    try {
      const customerRef = doc(db, 'clientesPorEmail', email);
      const existing = await getDocFromServer(customerRef);
      if (existing.exists()) {
        clientsStatus.textContent = 'Ya existe una ficha para ese correo. No se modificó ningún dato.';
        return;
      }
      await setDoc(customerRef, { email, nombre, telefono, createdAt: serverTimestamp() });
      clientsForm.reset();
      clientsStatus.textContent = 'Cliente guardado en la base de datos. Puede ingresar con ese mismo correo.';
    } catch (error) {
      clientsStatus.textContent = error?.code === 'permission-denied'
        ? 'Firebase rechazó el guardado. Falta publicar firestore.customers.rules con permiso de carga para Oasis.'
        : 'No se pudo guardar la ficha. Revisá la conexión con Firestore y volvé a intentar.';
    } finally {
      clientsSave.disabled = false;
    }
  });
  const pushButton = document.createElement('button');
  pushButton.type = 'button';
  pushButton.className = 'secondary';
  pushButton.textContent = 'Activar avisos de reservas en este celular';
  pushButton.hidden = true;
  const pushStatus = document.createElement('p');
  pushStatus.className = 'muted';
  pushStatus.setAttribute('role', 'status');
  pushStatus.setAttribute('aria-live', 'polite');
  pushStatus.hidden = true;
  session.append(pushButton, pushStatus);

  async function saveAdminPushToken(idToken, registrationToken) {
    const frame = document.createElement('iframe');
    const nonce = crypto.randomUUID();
    const frameName = 'oasys-push-register-' + nonce;
    frame.name = frameName;
    frame.hidden = true;
    document.body.append(frame);
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = APPS_SCRIPT_ENDPOINT;
    form.target = frameName;
    form.hidden = true;
    for (const [name, value] of Object.entries({
      action: 'registerAdminPushToken', idToken, registrationToken, nonce
    })) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.append(input);
    }
    document.body.append(form);
    try {
      return await new Promise((resolve, reject) => {
        const finish = (error, result) => {
          clearTimeout(timer);
          window.removeEventListener('message', onMessage);
          error ? reject(error) : resolve(result);
        };
        const onMessage = event => {
          if (event.source !== frame.contentWindow || event.data?.source !== 'oasys-calendar' || event.data?.nonce !== nonce) return;
          finish(null, event.data.result);
        };
        const timer = setTimeout(() => finish(new Error('El servidor tardó en responder.')), 20000);
        window.addEventListener('message', onMessage);
        form.submit();
      });
    } finally {
      form.remove();
      frame.remove();
    }
  }

  pushButton.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user || !normalizedAdmins.includes(String(user.email || '').trim().toLowerCase())) {
      pushStatus.textContent = 'Volvé a iniciar sesión con el Gmail administrador de Oasis.';
      return;
    }
    pushButton.disabled = true;
    pushStatus.textContent = 'Preparando las notificaciones…';
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        throw new Error('Este navegador no permite notificaciones web. Probá desde Chrome en el celular.');
      }
      const { isSupported, getMessaging, getToken } =
        await import('https://www.gstatic.com/firebasejs/13.1.0/firebase-messaging.js');
      if (!(await isSupported())) throw new Error('Las notificaciones push no son compatibles con este navegador.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('No se habilitó el permiso de notificaciones en el celular.');
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const messaging = getMessaging(app);
      const registrationToken = await getToken(messaging, {
        vapidKey: WEB_PUSH_VAPID_KEY,
        serviceWorkerRegistration: registration
      });
      if (!registrationToken) throw new Error('Firebase no devolvió el registro de este celular.');
      const result = await saveAdminPushToken(await user.getIdToken(), registrationToken);
      if (!result?.ok) throw new Error('No se pudo guardar el registro de notificaciones.');
      pushStatus.textContent = 'Listo: este celular recibirá un aviso cuando entre una reserva pendiente de pago.';
      pushButton.textContent = 'Notificaciones de reservas activadas';
    } catch (error) {
      pushStatus.textContent = error?.message || 'No se pudieron activar las notificaciones. Volvé a intentar.';
    } finally {
      pushButton.disabled = false;
    }
  });

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  loginButton.addEventListener('click', async () => {
    loginButton.disabled = true;
    status.textContent = 'Abriendo el inicio de Google…';
    try {
      const result = await signInWithPopup(auth, provider);
      const email = String(result.user.email || '').trim().toLowerCase();
      if (!normalizedAdmins.includes(email)) {
        await signOut(auth);
        showSignedOut('Esa cuenta de Google no tiene permisos de administrador.');
      }
    } catch (error) {
      const code = error?.code || '';
      status.textContent = code === 'auth/unauthorized-domain'
        ? 'Firebase todavía necesita autorizar el dominio de Oasis para el inicio con Google.'
        : code === 'auth/operation-not-allowed'
          ? 'Falta habilitar el proveedor Google en Firebase Authentication.'
          : code === 'auth/popup-blocked'
            ? 'El navegador bloqueó la ventana de Google. Permití las ventanas emergentes y reintentá.'
            : 'No se pudo iniciar sesión con Google. Revisá la conexión y volvé a intentar.';
    } finally {
      loginButton.disabled = false;
    }
  });

  byId('admin-google-logout').addEventListener('click', async () => {
    try {
      await signOut(auth);
      showSignedOut('Sesión cerrada.');
    } catch {
      status.textContent = 'No se pudo cerrar la sesión. Volvé a intentarlo.';
    }
  });

  onAuthStateChanged(auth, async user => {
    if (!user) {
      showSignedOut('Ingresá con el Gmail autorizado de Oasis.');
      return;
    }
    const email = String(user.email || '').trim().toLowerCase();
    if (!normalizedAdmins.includes(email)) {
      await signOut(auth);
      showSignedOut('Esa cuenta de Google no tiene permisos de administrador.');
      return;
    }
    byId('admin-email').textContent = user.email;
    loginButton.hidden = true;
    session.hidden = false;
    stats.hidden = false;
    status.textContent = 'Acceso de administrador habilitado.';
    publishAdminAuth({ email: user.email, idToken: null });
    pushButton.hidden = false;
    pushStatus.hidden = false;
    pushStatus.textContent = 'Activá los avisos una vez en este celular para recibir nuevas reservas.';
    try {
      const idToken = await user.getIdToken();
      publishAdminAuth({ email: user.email, idToken });
    } catch {
      status.textContent = 'Sesión de administración abierta; no se pudo habilitar el guardado todavía.';
    }
  });
}
