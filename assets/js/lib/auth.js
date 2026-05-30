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
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

let currentUser = null;
let isAdminCached = false;
const subscribers = new Set();

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  isAdminCached = false;
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

export function onAuthChange(fn) {
  subscribers.add(fn);
  // Fire immediately if we already know
  if (currentUser !== null) fn(currentUser, isAdminCached);
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
