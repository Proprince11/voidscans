// =====================================================
// account.js — User profile in Firestore.
// Stored at /users/{uid}. Auto-created on first sign-in.
// =====================================================

import { db } from './firebase.js';
import { getUser, onAuthChange, updateAuthProfile } from './auth.js';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let currentProfile = null;
const subscribers = new Set();

/** Subscribe to profile changes. Returns an unsubscribe fn. */
export function onProfileChange(fn) {
  subscribers.add(fn);
  fn(currentProfile);
  return () => subscribers.delete(fn);
}

export function getProfile() { return currentProfile; }

function notify() {
  subscribers.forEach(fn => { try { fn(currentProfile); } catch {} });
}

/** Create or read the user's profile document. */
export async function ensureProfile(user) {
  if (!user) { currentProfile = null; notify(); return null; }
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const initial = {
        displayName: user.displayName || (user.email?.split('@')[0]) || 'Reader',
        email: user.email || null,
        photoURL: user.photoURL || null,
        bio: '',
        createdAt: serverTimestamp(),
        lastSeenAt: serverTimestamp()
      };
      await setDoc(ref, initial);
      currentProfile = { uid: user.uid, ...initial };
    } else {
      currentProfile = { uid: user.uid, ...snap.data() };
      // bump lastSeenAt (best effort)
      updateDoc(ref, { lastSeenAt: serverTimestamp() }).catch(() => {});
    }
    notify();
    return currentProfile;
  } catch (e) {
    console.warn('ensureProfile failed:', e);
    currentProfile = { uid: user.uid, displayName: user.displayName || 'Reader', email: user.email };
    notify();
    return currentProfile;
  }
}

/** Update profile fields. Mirrors displayName/photoURL to Firebase Auth profile too. */
export async function updateProfileFields(patch) {
  const u = getUser();
  if (!u) throw new Error('Not signed in');
  await updateDoc(doc(db, 'users', u.uid), {
    ...patch,
    updatedAt: serverTimestamp()
  });
  if (patch.displayName !== undefined || patch.photoURL !== undefined) {
    try {
      await updateAuthProfile({
        ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
        ...(patch.photoURL !== undefined ? { photoURL: patch.photoURL } : {})
      });
    } catch {}
  }
  currentProfile = { ...currentProfile, ...patch };
  notify();
}

// Auto-ensure profile whenever auth state changes
onAuthChange((user) => {
  if (user) {
    ensureProfile(user);
  } else {
    currentProfile = null;
    notify();
  }
});
