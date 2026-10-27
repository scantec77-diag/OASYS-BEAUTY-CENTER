importScripts('https://www.gstatic.com/firebasejs/13.1.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.1.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBo-OXa4h6wD_3TyKtL3LBulaRDse8z8po',
  authDomain: 'oasysbeautycenter.firebaseapp.com',
  projectId: 'oasysbeautycenter',
  storageBucket: 'oasysbeautycenter.firebasestorage.app',
  messagingSenderId: '26340609563',
  appId: '1:26340609563:web:61aff5ee2cc95ec267b2be'
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage(payload => {
  const notification = payload.notification || {};
  return self.registration.showNotification(notification.title || 'Nueva reserva pendiente', {
    body: notification.body || 'Entró una reserva pendiente de pago.',
    icon: '/oasys-logo.jpg',
    data: { url: payload.data?.url || '/#administracion' }
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/#administracion', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
    for (const client of clientList) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) return client.focus();
    }
    return clients.openWindow(target);
  }));
});
