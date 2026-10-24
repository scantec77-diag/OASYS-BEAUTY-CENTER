import { AVAILABILITY_ENDPOINT } from './app-config.js';

const catalog = document.getElementById('services-list');
const bookingSelect = document.getElementById('servicio');
const adminButton = document.getElementById('admin-services-button');
const editor = document.getElementById('admin-services-editor');
const rows = document.getElementById('admin-services-rows');
const addButton = document.getElementById('admin-service-add');
const saveButton = document.getElementById('admin-services-save');
const closeButton = document.getElementById('admin-services-close');
const status = document.getElementById('admin-services-status');
const frame = document.getElementById('oasis-services-save-frame');
const validEndpoint = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(AVAILABILITY_ENDPOINT);
const defaultStyles = {
  nameColor: '#42392E',
  detailColor: '#766B5D',
  cardColor: '#FFFDF9',
  nameFont: 'serif',
  detailFont: 'system',
  nameSize: 16,
  detailSize: 14
};
const fonts = {
  system: 'system-ui, sans-serif',
  serif: 'Georgia, serif',
  arial: 'Arial, sans-serif',
  trebuchet: '"Trebuchet MS", Arial, sans-serif'
};
let adminSession = window.oasisAdminSession || null;
let services = readStaticServices();
let styles = { ...defaultStyles };

function readStaticServices() {
  return [...catalog.querySelectorAll('.service-item')].map((item, index) => {
    const label = item.querySelector('strong')?.textContent.trim() || '';
    const info = item.querySelector('span')?.textContent || '';
    const amount = info.match(/\$([\d.]+)/);
    const duration = info.match(/(\d+)\s*min/);
    return {
      id: 's' + (index + 1),
      name: label,
      price: amount ? Number(amount[1].replace(/\D/g, '')) : null,
      fromPrice: /^Desde\s/i.test(info),
      durationMin: duration ? Number(duration[1]) : null
    };
  });
}

function applyStyles(value = defaultStyles) {
  styles = { ...defaultStyles, ...(value || {}) };
  const root = document.documentElement;
  root.style.setProperty('--service-name-color', styles.nameColor);
  root.style.setProperty('--service-detail-color', styles.detailColor);
  root.style.setProperty('--service-card-color', styles.cardColor);
  root.style.setProperty('--service-name-font', fonts[styles.nameFont] || fonts.serif);
  root.style.setProperty('--service-detail-font', fonts[styles.detailFont] || fonts.system);
  root.style.setProperty('--service-name-size', Math.min(36, Math.max(12, Number(styles.nameSize) || 16)) + 'px');
  root.style.setProperty('--service-detail-size', Math.min(24, Math.max(10, Number(styles.detailSize) || 14)) + 'px');
}

function formatMoney(amount, fromPrice) {
  if (amount === null || amount === undefined || amount === '') return 'Precio a confirmar';
  const value = '$' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Number(amount));
  return (fromPrice ? 'Desde ' : '') + value;
}

function formatDuration(durationMin) {
  return Number(durationMin) > 0 ? Number(durationMin) + ' min' : 'Duración a confirmar';
}

function renderCatalog(items) {
  services = items;
  catalog.replaceChildren();
  bookingSelect.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.disabled = true;
  placeholder.selected = true;
  placeholder.textContent = 'Elegí un tratamiento';
  bookingSelect.append(placeholder);
  for (const service of services) {
    const article = document.createElement('article');
    article.className = 'service-item';
    const name = document.createElement('strong');
    name.textContent = service.name;
    const details = document.createElement('span');
    details.textContent = formatMoney(service.price, service.fromPrice) + ' · ' + formatDuration(service.durationMin);
    article.append(name, details);
    catalog.append(article);

    const option = document.createElement('option');
    option.value = service.name;
    option.textContent = service.name + ' · ' + formatMoney(service.price, service.fromPrice);
    bookingSelect.append(option);
  }
}

function renderRows() {
  rows.replaceChildren();
  services.forEach((service, index) => rows.append(createRow(service, index)));
}

function createRow(service, index) {
  const row = document.createElement('div');
  row.className = 'admin-service-row';
  row.dataset.serviceId = service.id || 'service-' + Date.now() + '-' + index;
  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Servicio';
  const name = document.createElement('input');
  name.type = 'text';
  name.maxLength = 120;
  name.required = true;
  name.value = service.name || '';
  name.dataset.field = 'name';
  nameLabel.append(name);

  const priceLabel = document.createElement('label');
  priceLabel.textContent = 'Precio';
  const price = document.createElement('input');
  price.type = 'number';
  price.min = '0';
  price.max = '100000000';
  price.step = '500';
  price.inputMode = 'numeric';
  price.placeholder = 'A confirmar';
  price.value = service.price === null || service.price === undefined ? '' : String(service.price);
  price.dataset.field = 'price';
  priceLabel.append(price);

  const fromLabel = document.createElement('label');
  fromLabel.className = 'admin-service-from';
  const from = document.createElement('input');
  from.type = 'checkbox';
  from.checked = Boolean(service.fromPrice);
  from.dataset.field = 'fromPrice';
  fromLabel.append(from, document.createTextNode(' Desde'));

  const durationLabel = document.createElement('label');
  durationLabel.textContent = 'Duración (minutos)';
  const duration = document.createElement('input');
  duration.type = 'number';
  duration.min = '30';
  duration.max = '720';
  duration.step = '30';
  duration.placeholder = 'A confirmar';
  duration.value = service.durationMin || '';
  duration.dataset.field = 'durationMin';
  durationLabel.append(duration);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'secondary admin-service-delete';
  remove.textContent = 'Eliminar';
  remove.setAttribute('aria-label', 'Eliminar ' + (service.name || 'servicio'));
  remove.addEventListener('click', () => {
    row.remove();
    status.textContent = 'Servicio quitado de la lista. Tocá Guardar cambios para confirmar.';
  });

  row.append(nameLabel, priceLabel, fromLabel, durationLabel, remove);
  return row;
}

function renderStyleControls() {
  for (const key of ['nameColor', 'detailColor', 'cardColor', 'nameFont', 'detailFont', 'nameSize', 'detailSize']) {
    const input = document.getElementById('service-style-' + key);
    if (input) input.value = styles[key] ?? defaultStyles[key];
  }
}

function collectRows() {
  return [...rows.querySelectorAll('.admin-service-row')].map((row, index) => {
    const value = field => row.querySelector('[data-field="' + field + '"]');
    const priceText = value('price').value.trim();
    const durationText = value('durationMin').value.trim();
    return {
      id: row.dataset.serviceId || 'service-' + index,
      name: value('name').value.trim(),
      price: priceText === '' ? null : Number(priceText),
      fromPrice: value('fromPrice').checked,
      durationMin: durationText === '' ? null : Number(durationText)
    };
  });
}

function collectStyles() {
  const value = key => document.getElementById('service-style-' + key).value;
  return {
    nameColor: value('nameColor'),
    detailColor: value('detailColor'),
    cardColor: value('cardColor'),
    nameFont: value('nameFont'),
    detailFont: value('detailFont'),
    nameSize: Number(value('nameSize')),
    detailSize: Number(value('detailSize'))
  };
}

function loadJSONP(params) {
  return new Promise((resolve, reject) => {
    const callbackName = 'oasisServices' + Date.now() + Math.floor(Math.random() * 1000);
    const script = document.createElement('script');
    const timeout = setTimeout(() => finish(null), 12000);
    function finish(result) {
      clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
      if (result) resolve(result);
      else reject(new Error('No se pudo cargar el catálogo.'));
    }
    window[callbackName] = finish;
    script.onerror = () => finish(null);
    const query = new URLSearchParams({ ...params, callback: callbackName });
    script.src = AVAILABILITY_ENDPOINT + '?' + query.toString();
    document.head.append(script);
  });
}

async function refreshServices() {
  if (!validEndpoint) return;
  try {
    const result = await loadJSONP({ action: 'services' });
    if (!result.ok || !Array.isArray(result.services)) throw new Error('Catálogo no disponible.');
    applyStyles(result.styles || defaultStyles);
    renderCatalog(result.services);
    if (!editor.hidden) {
      renderRows();
      renderStyleControls();
    }
  } catch {
    status.textContent = 'No se pudo leer la lista guardada. Se muestra la lista inicial.';
  }
}

function syncAdmin(detail) {
  adminSession = detail || null;
  adminButton.hidden = !adminSession;
  saveButton.disabled = !validEndpoint || !adminSession?.idToken;
}

adminButton.addEventListener('click', () => {
  editor.hidden = !editor.hidden;
  if (!editor.hidden) {
    renderRows();
    renderStyleControls();
    status.textContent = validEndpoint
      ? 'Editá servicios y estilos; después guardá los cambios.'
      : 'El editor está listo. Falta publicar y vincular el servicio de guardado.';
  }
});

closeButton.addEventListener('click', () => { editor.hidden = true; });

addButton.addEventListener('click', () => {
  const id = 'new-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
  rows.append(createRow({ id, name: '', price: null, fromPrice: false, durationMin: null }, rows.children.length));
  rows.lastElementChild.querySelector('[data-field="name"]').focus();
});

saveButton.addEventListener('click', () => {
  if (!validEndpoint || !adminSession?.idToken) {
    status.textContent = 'Iniciá sesión como administradora y vinculá el servicio de guardado.';
    return;
  }
  const nextServices = collectRows();
  if (nextServices.some(service => !service.name)) {
    status.textContent = 'Completá el nombre de cada servicio o eliminá la fila vacía.';
    return;
  }
  if (nextServices.some(service =>
    (service.price !== null && (!Number.isInteger(service.price) || service.price < 0)) ||
    (service.durationMin !== null && (!Number.isInteger(service.durationMin) || service.durationMin < 30 || service.durationMin > 720 || service.durationMin % 30 !== 0))
  )) {
    status.textContent = 'Revisá los precios y las duraciones. Los tiempos se cargan cada 30 minutos.';
    return;
  }
  const nextStyles = collectStyles();
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = AVAILABILITY_ENDPOINT;
  form.target = frame.name;
  form.hidden = true;
  const fields = {
    action: 'saveServices',
    idToken: adminSession.idToken,
    services: JSON.stringify(nextServices),
    styles: JSON.stringify(nextStyles)
  };
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.append(input);
  }
  frame.onload = () => {
    frame.onload = null;
    window.setTimeout(refreshServices, 900);
  };
  status.textContent = 'Guardando catálogo y estilos…';
  document.body.append(form);
  form.submit();
  form.remove();
});

window.addEventListener('message', event => {
  if (event.source !== frame.contentWindow || event.data?.type !== 'oasis-services-save') return;
  status.textContent = event.data.message || (event.data.ok ? 'Lista guardada.' : 'No se pudo guardar la lista.');
  if (event.data.ok) window.setTimeout(refreshServices, 400);
});

document.addEventListener('oasis:admin-auth', event => syncAdmin(event.detail));
applyStyles(styles);
if (adminSession) syncAdmin(adminSession);
if (validEndpoint) refreshServices();
