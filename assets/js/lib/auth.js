// =====================================================
// auth.js — Auth wrapper.
// Public users: anonymous reading. Optional sign-in for sync.
// Admins: gated by Firebase Custom Claim `admin: true`.
// =====================================================

import { auth } from './firebase.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

let currentUser = null;
let isAdminCached = false;
let initialized = false;
const subscribers = new Set();

// Persist auth across tabs and sessions
setPersistence(auth, browserLocalPersistence).catch(() => {});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  isAdminCached = false;
  initialized = true;
  if (user) {
    try {
      const tok = await user.getIdTokenResult();
      isAdminCached = !!tok.claims.admin;
    } catch (e) { /* ignore */ }
  }
  subscribers.forEach(fn => fn(user, isAdminCached));
});

export function getUser() { return currentUser; }
export function isAdmin() { return isAdminCached; }
export function isAuthInitialized() { return initialized; }

export function onAuthChange(fn) {
  subscribers.add(fn);
  if (initialized) fn(currentUser, isAdminCached);
  return () => subscribers.delete(fn);
}

export async function signIn(email, password) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return user;
}

export async function signUp(email, password, displayName) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) await updateProfile(user, { displayName });
  return user;
}

/** Sign in with Google. Throws a clear error if Google provider isn't enabled
 *  in Firebase Console (auth/operation-not-allowed). */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const { user } = await signInWithPopup(auth, provider);
  return user;
}

export async function signOut() {
  await fbSignOut(auth);
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Returns the verified admin flag from a fresh ID token.
 * Use this on admin pages to be sure (vs cached value).
 */
export async function verifyAdmin() {
  if (!currentUser) return false;
  try {
    const tok = await currentUser.getIdTokenResult(true);
    isAdminCached = !!tok.claims.admin;
    return isAdminCached;
  } catch {
    return false;
  }
}

/** Update the user's auth profile (display name, photo URL). */
export async function updateAuthProfile(patch) {
  if (!currentUser) throw new Error('Not signed in');
  await updateProfile(currentUser, patch);
}
