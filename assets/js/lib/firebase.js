// =====================================================
// firebase.js — Initialize Firebase + export instances.
// Public Firebase web config is OK to commit; security
// is enforced by Firestore Rules + Custom Claims server-side.
// =====================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCN90gGJYotvIFof1M7zxSSIdWzjWjZdB0',
  authDomain: 'voidscans-6c66b.firebaseapp.com',
  projectId: 'voidscans-6c66b',
  storageBucket: 'voidscans-6c66b.firebasestorage.app',
  messagingSenderId: '1075674977587',
  appId: '1:1075674977587:web:f306a9e3dd0de2ec5e5a46'
};

export const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);
export const auth = getAuth(app);
