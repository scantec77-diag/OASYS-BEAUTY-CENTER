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
  const { getMessaging, getToken, onMessage, isSupported } =
    await import('https://www.gstatic.com/firebasejs/13.1.0/firebase-messaging.js');
  const pushButton = document.createElement('button');
  pushButton.id = 'admin-push-enable';
  pushButton.type = 'button';
  pushButton.className = 'secondary';
  pushButton.textContent = 'Activar avisos de reservas en este celular';
  const pushStatus = document.createElement('p');
  pushStatus.className = 'muted';
  pushStatus.setAttribute('role', 'status');
  pushStatus.setAttribute('aria-live', 'polite');
  session.append(pushButton, pushStatus);

  async function registerPushToken(token, idToken) {
    const frameName = 'oasis-push-registration-' + crypto.randomUUID();
    const frame = document.createElement('iframe');
    frame.name = frameName;
    frame.hidden = true;
    frame.title = 'Registro de notificaciones';
    document.body.append(frame);
    const nonce = crypto.randomUUID();
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error('timeout')), 25000);
      const finish = value => {
        clearTimeout(timeout);
        window.removeEventListener('message', onMessageResult);
        frame.remove();
        value instanceof Error ? reject(value) : resolve(value);
      };
      const onMessageResult = event => {
        if (event.source !== frame.contentWindow || event.data?.source !== 'oasys-calendar' || event.data?.nonce !== nonce) return;
        finish(event.data.result);
      };
      window.addEventListener('message', onMessageResult);
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = APPS_SCRIPT_ENDPOINT;
      form.target = frameName;
      form.hidden = true;
      for (const [name, value] of Object.entries({
        action: 'registerAdminPushToken',
        registrationToken: token,
        idToken,
        nonce
      })) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.append(input);
      }
      document.body.append(form);
      form.submit();
      form.remove();
    });
    if (!result?.ok) throw new Error('registration_failed');
  }

  let messaging;
  if (await isSupported()) {
    messaging = getMessaging(app);
    onMessage(messaging, payload => {
      const notification = payload.notification;
      if (notification && Notification.permission === 'granted') {
        new Notification(notification.title || 'Nueva reserva pendiente', {
          body: notification.body || 'Entró una reserva en Oasis Beauty Center.',
          icon: './oasys-logo.jpg',
          tag: 'oasys-new-booking'
        });
      }
    });
  }
  pushButton.addEventListener('click', async () => {
    const currentUser = auth.currentUser;
    const currentEmail = String(currentUser?.email || '').trim().toLowerCase();
    if (!currentUser || !currentUser.emailVerified || !normalizedAdmins.includes(currentEmail)) {
      pushStatus.textContent = 'Iniciá sesión con el Gmail administrador para activar los avisos.';
      return;
    }
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !messaging || !WEB_PUSH_VAPID_KEY) {
      pushStatus.textContent = 'Este navegador no admite las notificaciones web necesarias.';
      return;
    }
    pushButton.disabled = true;
    pushStatus.textContent = 'Preparando las notificaciones…';
    try {
      const permission = Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission !== 'granted') throw new Error('permission_denied');
      const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js', { scope: './' });
      const token = await getToken(messaging, { vapidKey: WEB_PUSH_VAPID_KEY, serviceWorkerRegistration: registration });
      if (!token) throw new Error('token_unavailable');
      await registerPushToken(token, await currentUser.getIdToken(true));
      pushButton.textContent = 'Avisos de reservas activados en este celular';
      pushStatus.textContent = 'Listo. Este celular recibirá avisos cuando entre una reserva pendiente.';
    } catch (error) {
      pushStatus.textContent = error?.message === 'permission_denied'
        ? 'El permiso quedó bloqueado. Habilitá las notificaciones del sitio desde la configuración del navegador.'
        : 'No se pudo activar el celular. Revisá el permiso de notificaciones y volvé a intentar.';
    } finally {
      pushButton.disabled = false;
    }
  });
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
    try {
      const idToken = await user.getIdToken();
      publishAdminAuth({ email: user.email, idToken });
    } catch {
      status.textContent = 'Sesión de administración abierta; no se pudo habilitar el guardado todavía.';
    }
  });
}
