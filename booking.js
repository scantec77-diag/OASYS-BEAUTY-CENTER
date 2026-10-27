import { APPS_SCRIPT_ENDPOINT } from './app-config.js';
const BOOKING_ENDPOINT = APPS_SCRIPT_ENDPOINT;
const booking = document.getElementById('booking');
const result = document.getElementById('resultado');
const submit = booking.querySelector('button[type="submit"]');
const receiptFile = document.getElementById('comprobanteArchivo');
const receiptData = document.getElementById('comprobanteImagen');
const receiptStatus = document.getElementById('comprobanteEstado');
document.getElementById('year').textContent = new Date().getFullYear();
const dateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit'
}).formatToParts(new Date());
const part = type => dateParts.find(p => p.type === type).value;
document.getElementById('fecha').min = part('year') + '-' + part('month') + '-' + part('day');
const enabled = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(BOOKING_ENDPOINT);
let customer = null;
let requestId = '';
let receiptEncoded = false;
submit.disabled = true;

function compressReceipt(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error('Elegí una imagen JPG, PNG o WebP.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la foto. Probá con otra imagen.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('No se pudo abrir la foto. Probá con otra imagen.'));
      image.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        let quality = 0.78;
        let data = canvas.toDataURL('image/jpeg', quality);
        while (data.length > 1550000 && quality > 0.42) {
          quality -= 0.08;
          data = canvas.toDataURL('image/jpeg', quality);
        }
        if (data.length > 1550000) return reject(new Error('La foto sigue siendo muy pesada. Elegí una imagen más liviana.'));
        resolve(data);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

receiptFile?.addEventListener('change', () => {
  receiptData.value = '';
  receiptEncoded = false;
  requestId = '';
  receiptStatus.textContent = receiptFile.files?.[0]
    ? 'Foto elegida. Se optimizará al enviar la solicitud.'
    : 'Podés elegir una foto JPG, PNG o WebP. Quedará asociada a la solicitud para que el centro la revise.';
});

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
booking.addEventListener('input', () => { requestId = ''; });
booking.addEventListener('submit', async event => {
  if (!enabled || !customer) { event.preventDefault(); return; }
  if (!booking.reportValidity()) { event.preventDefault(); return; }
  if (receiptFile?.files?.[0] && !receiptEncoded) {
    event.preventDefault();
    submit.disabled = true;
    receiptStatus.textContent = 'Preparando la foto…';
    try {
      receiptData.value = await compressReceipt(receiptFile.files[0]);
      receiptEncoded = true;
    } catch (error) {
      receiptStatus.textContent = error.message || 'No se pudo preparar la foto.';
      submit.disabled = false;
      return;
    }
    submit.disabled = false;
    booking.requestSubmit(submit);
    return;
  }
  const name = document.getElementById('nombre');
  const service = document.getElementById('servicio');
  name.value = name.value.trim();
  service.value = service.value.trim();
  if (!requestId) requestId = crypto.randomUUID();
  document.getElementById('requestId').value = requestId;
  result.textContent = 'Consultá el resultado en la pestaña que se abre. Este mensaje no confirma la reserva. Si falla, reenviá sin modificar los datos.';
});
