import { ADMIN_EMAILS } from './admin-config.js';

const byId = id => document.getElementById(id);
const status = byId('admin-auth-status');
const loginButton = byId('admin-google-login');
const session = byId('admin-session');
const stats = byId('estadisticas');
const normalizedAdmins = ADMIN_EMAILS.map(email => String(email).trim().toLowerCase()).filter(Boolean);

function showSignedOut(message) {
  byId('admin-email').textContent = '';
  session.hidden = true;
  loginButton.hidden = false;
  stats.hidden = true;
  if (message) status.textContent = message;
}

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
  auth.languageCode = 'es';
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
  });
}
