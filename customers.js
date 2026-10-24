import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import { getAuth, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { getFirestore, doc, getDocFromServer, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import { mountCustomers } from './customer-ui.js';

const app = initializeApp({
  apiKey: 'AIzaSyBo-OXa4h6wD_3TyKtL3LBulaRDse8z8po',
  authDomain: 'oasysbeautycenter.firebaseapp.com',
  projectId: 'oasysbeautycenter',
  storageBucket: 'oasysbeautycenter.firebasestorage.app',
  messagingSenderId: '26340609563',
  appId: '1:26340609563:web:61aff5ee2cc95ec267b2be'
});
const auth = getAuth(app);
auth.languageCode = 'es';
// Target: Firestore Native/Standard, (default). Verify edition before deployment.
const db = getFirestore(app);
const profileRef = user => doc(db, 'clientesWeb', user.uid);
const legacyRef = user => doc(db, 'clientesPorEmail', user.email.trim().toLowerCase());
const publicProfile = data => ({
  nombre: typeof data.nombre === 'string' ? data.nombre : '',
  telefono: typeof data.telefono === 'string' ? data.telefono : '',
  email: data.email
});
mountCustomers({
  isEmailLink: url => isSignInWithEmailLink(auth, url),
  sendLink: (email, url) => sendSignInLinkToEmail(auth, email, {url, handleCodeInApp: true}),
  finishLink: (email, url) => signInWithEmailLink(auth, email, url),
  watchUser: callback => onAuthStateChanged(auth, callback),
  logout: () => signOut(auth),
  async getProfile(user) {
    const snapshot = await getDocFromServer(profileRef(user));
    return snapshot.exists() ? publicProfile(snapshot.data()) : null;
  },
  async getLegacyProfile(user) {
    if (!user.emailVerified || !user.email) return null;
    const snapshot = await getDocFromServer(legacyRef(user));
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    if (typeof data.email !== 'string' ||
        data.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      throw new Error('legacy-email-mismatch');
    }
    return {...publicProfile(data), origen: 'antecedente'};
  },
  async createProfile(user, fields) {
    // Transaction prevents duplicate profiles and overwrites from two tabs.
    return runTransaction(db, async transaction => {
      const ref = profileRef(user);
      const existing = await transaction.get(ref);
      if (existing.exists()) return publicProfile(existing.data());
      const data = {...fields, email: user.email, uid: user.uid, createdAt: serverTimestamp()};
      transaction.set(ref, data);
      return publicProfile(data);
    });
  }
});
