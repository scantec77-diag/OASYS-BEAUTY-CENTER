import { APPS_SCRIPT_ENDPOINT } from './app-config.js';

const byId = id => document.getElementById(id);
const weatherButton = byId('weather-button');
const weatherStatus = byId('weather-status');
const weatherResult = byId('weather-result');
let pending = false;

function setStatus(text) {
  weatherStatus.textContent = text;
}

function iconFor(code) {
  if (code === 1000) return '☀️';
  if ([1003, 1006, 1009].includes(code)) return '☁️';
  if ([1030, 1135, 1147].includes(code)) return '🌫️';
  if ([1066, 1069, 1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225, 1255, 1258].includes(code)) return '❄️';
  if ([1087, 1273, 1276, 1279, 1282].includes(code)) return '⛈️';
  if ([1063, 1072, 1150, 1153, 1168, 1171, 1180, 1183, 1186, 1189, 1192, 1195, 1198, 1201, 1204, 1207, 1240, 1243, 1246, 1249, 1252].includes(code)) return '🌧️';
  return '🌤️';
}

function renderWeather(data) {
  const current = data.current;
  const location = data.location;
  const place = [location.name, location.region].filter(Boolean).join(', ');
  byId('weather-icon').textContent = iconFor(Number(current.condition.code));
  byId('weather-temperature').textContent = `${Math.round(Number(current.temp_c))}°`;
  byId('weather-condition').textContent = current.condition.text;
  byId('weather-location').textContent = place || location.country || 'Tu ubicación';
  byId('weather-details').textContent = `Sensación ${Math.round(Number(current.feelslike_c))}° · Humedad ${current.humidity}% · Viento ${Math.round(Number(current.wind_kph))} km/h`;
  byId('weather-updated').textContent = current.last_updated
    ? `Actualizado ${current.last_updated.slice(-5)}` : 'Clima actual';
  weatherResult.hidden = false;
  setStatus('');
  weatherButton.textContent = 'Actualizar clima';
}

function loadWeather(latitude, longitude) {
  const callback = `oasisWeather_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const script = document.createElement('script');
  let timeout;
  const cleanUp = () => {
    clearTimeout(timeout);
    script.remove();
    delete window[callback];
    pending = false;
    weatherButton.disabled = false;
  };

  window[callback] = data => {
    cleanUp();
    if (!data?.ok) {
      const message = data?.error === 'weather-not-configured'
        ? 'El centro está terminando de activar el clima local.'
        : data?.error === 'weather-limit'
          ? 'Por hoy alcanzamos el límite de consultas del clima. Probá mañana.'
          : 'No pudimos consultar el clima ahora. Probá de nuevo en unos minutos.';
      setStatus(message);
      return;
    }
    renderWeather(data);
  };

  const url = new URL(APPS_SCRIPT_ENDPOINT);
  url.searchParams.set('action', 'weather');
  url.searchParams.set('latitude', latitude.toFixed(2));
  url.searchParams.set('longitude', longitude.toFixed(2));
  url.searchParams.set('callback', callback);
  script.src = url.toString();
  script.async = true;
  script.onerror = () => {
    cleanUp();
    setStatus('No pudimos consultar el clima ahora. Probá de nuevo en unos minutos.');
  };
  timeout = setTimeout(() => {
    cleanUp();
    setStatus('La consulta tardó demasiado. Probá de nuevo.');
  }, 15000);
  document.head.append(script);
}

weatherButton.addEventListener('click', () => {
  if (pending) return;
  if (!APPS_SCRIPT_ENDPOINT) {
    setStatus('El clima local está preparado y se activará cuando conectemos el servicio de Oasis.');
    return;
  }
  if (!navigator.geolocation) {
    setStatus('Este navegador no puede compartir la ubicación.');
    return;
  }
  pending = true;
  weatherButton.disabled = true;
  weatherResult.hidden = true;
  setStatus('Solicitando permiso para consultar tu ubicación…');
  navigator.geolocation.getCurrentPosition(position => {
    setStatus('Buscando el clima de tu zona…');
    loadWeather(position.coords.latitude, position.coords.longitude);
  }, error => {
    pending = false;
    weatherButton.disabled = false;
    const message = error.code === 1
      ? 'No se permitió la ubicación. Podés habilitarla desde el navegador y volver a intentar.'
      : 'No pudimos obtener la ubicación. Revisá el permiso y probá de nuevo.';
    setStatus(message);
  }, {enableHighAccuracy: true, timeout: 12000, maximumAge: 0});
});


// A shareable visual preview uses sample values only; it never requests location.
if (new URLSearchParams(location.search).get('vista') === 'demo') {
  byId('preview-note').hidden = false;
  byId('weather-icon').textContent = '🌤️';
  byId('weather-temperature').textContent = '21°';
  byId('weather-condition').textContent = 'Parcialmente nublado';
  byId('weather-location').textContent = 'Buenos Aires, Argentina';
  byId('weather-details').textContent = 'Sensación 22° · Humedad 62% · Viento 8 km/h';
  byId('weather-updated').textContent = 'Datos ilustrativos';
  weatherResult.hidden = false;
  weatherButton.disabled = true;
  weatherButton.textContent = 'Clima de ejemplo';
  byId('welcome-greeting').textContent = 'Buen día, Alejandra';
  byId('welcome-card').hidden = false;
  setStatus('');
}
