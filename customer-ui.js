// UI isolated from Firebase so error and identity transitions can be tested locally.
export function mountCustomers(api) {
  const el = id => document.getElementById(id);
  let user = null, profile = null, generation = 0, busy = false;
  let mode = 'existing';
  let link = api.isEmailLink(location.href) ? location.href : null;
  const message = text => { el('customer-status').textContent = text; };
  const storage = {
    get() { try { return localStorage.getItem('oasis.pendingEmail') || ''; } catch { return ''; } },
    set(email) { try { localStorage.setItem('oasis.pendingEmail', email); } catch {} },
    clear() { try { localStorage.removeItem('oasis.pendingEmail'); } catch {} }
  };
  function publish(value) {
    document.dispatchEvent(new CustomEvent('oasis:customer', {detail: value}));
  }
  function resetProfile() {
    profile = null;
    el('customer-profile').hidden = true;
    el('customer-ready').hidden = true;
    el('customer-name').value = '';
    el('customer-phone').value = '';
    publish(null);
  }
  function showProfile(data) {
    profile = data;
    el('customer-profile').hidden = true;
    el('customer-ready').hidden = false;
    el('customer-summary').textContent = `${data.nombre} · ${data.email}`;
    publish({...data, uid: user.uid});
  }
  function errorText(error) {
    const code = error?.code || '';
    if (/operation-not-allowed|unauthorized-domain|invalid-api-key|configuration-not-found/.test(code))
      return 'El acceso por mail todavía necesita activación del centro. No se guardó una ficha nueva.';
    if (/permission-denied|failed-precondition|not-found/.test(code))
      return 'No pudimos acceder a tu ficha. El centro debe revisar la configuración de clientes. Podés reintentar.';
    if (/expired-action-code|invalid-action-code/.test(code))
      return 'Ese enlace venció o ya fue usado. Pedí uno nuevo.';
    if (/invalid-email|invalid-credential/.test(code))
      return 'Revisá el mail: debe ser el mismo al que llegó el enlace.';
    if (/too-many-requests|quota-exceeded/.test(code))
      return 'No podemos enviar otro enlace por ahora. Esperá unos minutos y reintentá.';
    return 'No pudimos completar la operación. Revisá tu conexión y reintentá; todavía no confirmamos cambios.';
  }
  async function loadUser(next) {
    const current = ++generation;
    user = next;
    resetProfile();
    el('customer-access').hidden = !!next;
    el('customer-session').hidden = !next;
    el('customer-retry').hidden = true;
    if (!next) {
      message(link ? 'Para abrir este enlace, confirmá el mail al que lo enviamos.' : 'Elegí una opción para continuar. No necesitás contraseña.');
      return;
    }
    if (!next.emailVerified) { message('Necesitás verificar tu mail con un enlace de acceso.'); return; }
    el('customer-session-email').textContent = next.email;
    message('Buscando tu ficha…');
    try {
      const found = await api.getProfile(next);
      if (current !== generation || user?.uid !== next.uid) return;
      if (found) { showProfile(found); message('Ya encontramos tu ficha. Podés continuar con tu turno.'); }
      else {
        el('customer-profile').hidden = false;
        message(mode === 'existing' ? 'Todavía no hay una ficha web asociada a este mail. Completá tus datos una sola vez.' : 'Mail verificado. Completá tus datos para darte de alta.');
      }
    } catch (error) {
      if (current !== generation) return;
      message(errorText(error)); el('customer-retry').hidden = false;
    }
  }
  for (const name of ['new', 'existing']) el('customer-' + name).addEventListener('click', () => {
    mode = name;
    el('customer-new').setAttribute('aria-pressed', String(name === 'new'));
    el('customer-existing').setAttribute('aria-pressed', String(name === 'existing'));
    el('customer-access-title').textContent = name === 'new' ? 'Creá tu ficha de cliente' : 'Ingresá con tu mail';
    el('customer-email').focus();
  });
  el('customer-email').value = storage.get();
  el('customer-send').textContent = link ? 'Verificar mi mail' : 'Enviarme enlace de acceso';
  el('customer-access').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !el('customer-access').reportValidity()) return;
    const email = el('customer-email').value.trim().toLowerCase();
    busy = true; el('customer-send').disabled = true;
    try {
      if (link) {
        const credential = await api.finishLink(email, link);
        link = null; storage.clear();
        history.replaceState(null, '', location.pathname + '#clientes');
        el('customer-send').textContent = 'Enviarme enlace de acceso';
        await loadUser(credential.user);
      } else {
        await api.sendLink(email, location.origin + location.pathname);
        storage.set(email);
        message('Te enviamos un enlace. Revisá tu correo y la carpeta de spam; abrilo para continuar.');
      }
    } catch (error) {
      message(errorText(error));
      if (/expired-action-code|invalid-action-code/.test(error?.code || '')) {
        link = null; history.replaceState(null, '', location.pathname + '#clientes');
        el('customer-send').textContent = 'Enviarme un enlace nuevo';
      }
    } finally { busy = false; el('customer-send').disabled = false; }
  });
  el('customer-profile').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !user?.emailVerified) return;
    const nombre = el('customer-name').value.trim();
    const telefono = el('customer-phone').value.trim();
    if (!nombre || nombre.length > 80 || !/^[+() 0-9-]{7,25}$/.test(telefono)) {
      message('Completá tu nombre y un teléfono válido de 7 a 25 caracteres.'); return;
    }
    const current = generation, owner = user;
    busy = true; el('customer-save').disabled = true;
    try {
      const saved = await api.createProfile(owner, {nombre, telefono});
      if (current !== generation) return;
      showProfile(saved);
      message('Tu ficha está guardada. La próxima vez vas a ingresar con tu mail.');
    } catch (error) { if (current === generation) message(errorText(error)); }
    finally { busy = false; el('customer-save').disabled = false; }
  });
  el('customer-signout').addEventListener('click', async () => {
    // Clear visible PII immediately, even if sign-out cannot reach storage.
    ++generation; resetProfile();
    try { await api.logout(); storage.clear(); el('customer-email').value = ''; }
    catch (error) { message(errorText(error)); el('customer-retry').hidden = false; }
  });
  el('customer-retry').addEventListener('click', () => loadUser(user));
  el('customer-continue').addEventListener('click', () => {
    if (profile) { location.hash = 'turnos'; el('servicio').focus(); }
  });
  el('customer-send').disabled = false;
  api.watchUser(next => { if (link) return loadUser(null); return loadUser(next); });
}
