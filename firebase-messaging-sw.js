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

firebase.messaging();
