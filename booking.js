/* Pegar aquí la URL /exec después de implementar el Apps Script de Oasis. */
import { APPS_SCRIPT_ENDPOINT } from './app-config.js';
const BOOKING_ENDPOINT = APPS_SCRIPT_ENDPOINT;
const booking = document.getElementById('booking');
const result = document.getElementById('resultado');
const submit = booking.querySelector('button[type="submit"]');
document.getElementById('year').textContent = new Date().getFullYear();
const dateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit'
}).formatToParts(new Date());
const part = type => dateParts.find(p => p.type === type).value;
document.getElementById('fecha').min = part('year') + '-' + part('month') + '-' + part('day');
const enabled = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(BOOKING_ENDPOINT);
let customer = null;
submit.disabled = true;
document.addEventListener('oasis:customer', event => {
  customer = event.detail;
  requestId = '';
  document.getElementById('nombre').value = customer?.nombre || '';
  document.getElementById('telefono').value = customer?.telefono || '';
  document.getElementById('clienteUid').value = customer?.uid || '';
  document.getElementById('clienteEmail').value = customer?.email || '';
  document.getElementById('booking-customer').textContent = customer ? 'Reserva para ' + customer.nombre : 'Primero ingresá o creá tu ficha en la sección Clientes.';
  submit.disabled = !enabled || !customer;
});
if (enabled) {
  booking.action = BOOKING_ENDPOINT;
  document.getElementById('booking-notice').textContent =
    'Al enviar se abrirá el resultado en otra pestaña. El horario queda retenido solo cuando recibas la confirmación de registro; la atención y seña deben confirmarse con el centro. Los datos se guardan en la agenda privada de Oasis.';
} else {
  result.textContent = 'Reservas en preparación: falta activar la conexión con la agenda.';
}
let requestId = '';
booking.addEventListener('input', () => { requestId = ''; });
booking.addEventListener('submit', event => {
  if (!enabled || !customer) { event.preventDefault(); return; }
  const name = document.getElementById('nombre');
  const service = document.getElementById('servicio');
  name.value = name.value.trim();
  service.value = service.value.trim();
  if (!booking.reportValidity()) { event.preventDefault(); return; }
  if (!requestId) requestId = crypto.randomUUID();
  document.getElementById('requestId').value = requestId;
  result.textContent = 'Consultá el resultado en la pestaña que se abre. Este mensaje no confirma la reserva. Si falla, reenviá sin modificar los datos.';
});

