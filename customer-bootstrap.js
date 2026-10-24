import { CUSTOMERS_ENABLED } from './customer-config.js';
const status = document.getElementById('customer-status');
if (CUSTOMERS_ENABLED) {
  import('./customers.js?v=20261024-1').catch(() => {
    status.textContent = 'No pudimos cargar el acceso de clientes. Revisá tu conexión y recargá la página.';
    document.getElementById('customer-send').disabled = true;
  });
} else {
  status.textContent = 'El registro y el acceso de clientes están en preparación. El centro está terminando de habilitarlos.';
  for (const name of ['new', 'existing']) document.getElementById('customer-' + name).addEventListener('click', () => {
    document.getElementById('customer-access-title').textContent = name === 'new' ? 'Creá tu ficha de cliente' : 'Ingresá con tu mail';
    for (const option of ['new','existing']) document.getElementById('customer-' + option).setAttribute('aria-pressed', String(option === name));
    document.getElementById('customer-email').focus();
  });
  document.getElementById('customer-access').addEventListener('submit', event => event.preventDefault());
}
