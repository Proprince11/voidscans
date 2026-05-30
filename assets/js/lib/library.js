// =====================================================
// library.js — Local library, bookmarks, reading progress.
//
// Storage strategy:
//   - IndexedDB is the primary (works offline, anonymous-friendly)
//   - Firestore at /users/{uid}/library and /users/{uid}/history
//     mirrors the local data when signed in (cross-device sync)
//   - On first sign-in, syncLocalToCloud() pushes IndexedDB → Firestore once
//   - getLibrary / getHistory prefer Firestore when signed in, fall back to local
// =====================================================

import { db } from './firebase.js';
import { getUser, onAuthChange } from './auth.js';
import {
  doc, setDoc, deleteDoc, collection, getDocs, query,
  orderBy, limit as fbLimit, serverTimestamp, getDoc, where
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const DB_NAME = 'voidscans';
const DB_VERSION = 1;
const STORES = {
  library:  'library',
  history:  'history',
  progress: 'progress'
};

let dbPromise;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.library)) {
        const s = db.createObjectStore(STORES.library, { keyPath: 'seriesId' });
        s.createIndex('lastReadAt', 'lastReadAt');
        s.createIndex('status', 'status');
      }
      if (!db.objectStoreNames.contains(STORES.history)) {
        const s = db.createObjectStore(STORES.history, { keyPath: 'id' });
        s.createIndex('seriesId', 'seriesId');
        s.createIndex('readAt', 'readAt');
      }
      if (!db.objectStoreNames.contains(STORES.progress)) {
        db.createObjectStore(STORES.progress, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(store, mode = 'readonly') {
  const db = await openDB();
  return db.transaction(store, mode).objectStore(store);
}
function reqAsPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// =====================================================
// Cloud helpers
// =====================================================
function userRef(uid) { return doc(db, 'users', uid); }
function libRef(uid, seriesId) { return doc(db, 'users', uid, 'library', seriesId); }
function libCol(uid) { return collection(db, 'users', uid, 'library'); }
function histRef(uid, id) { return doc(db, 'users', uid, 'history', id); }
function histCol(uid) { return collection(db, 'users', uid, 'history'); }

async function cloudPutLibrary(seriesId, data) {
  const u = getUser(); if (!u) return;
  try { await setDoc(libRef(u.uid, seriesId), data, { merge: true }); }
  catch (e) { console.warn('cloud put library:', e); }
}
async function cloudDeleteLibrary(seriesId) {
  const u = getUser(); if (!u) return;
  try { await deleteDoc(libRef(u.uid, seriesId)); }
  catch (e) { console.warn('cloud del library:', e); }
}
async function cloudPutHistory(id, data) {
  const u = getUser(); if (!u) return;
  try { await setDoc(histRef(u.uid, id), data, { merge: true }); }
  catch (e) { console.warn('cloud put history:', e); }
}

// =====================================================
// LIBRARY (bookmarks / following)
// =====================================================
export async function isInLibrary(seriesId) {
  try {
    const t = await tx(STORES.library);
    const r = await reqAsPromise(t.get(seriesId));
    return !!r;
  } catch { return false; }
}

export async function addToLibrary(series, status = 'reading') {
  const seriesId = series.slug || series.id;
  const data = {
    seriesId,
    title: series.title,
    cover: series.cover,
    status,
    follow: true,
    addedAt: Date.now(),
    lastReadAt: Date.now(),
    currentChapter: 0
  };
  // Local
  try {
    const t = await tx(STORES.library, 'readwrite');
    await reqAsPromise(t.put(data));
  } catch (e) { console.warn(e); return false; }
  // Cloud (best effort, doesn't block)
  cloudPutLibrary(seriesId, data);
  return true;
}

export async function removeFromLibrary(seriesId) {
  try {
    const t = await tx(STORES.library, 'readwrite');
    await reqAsPromise(t.delete(seriesId));
  } catch { return false; }
  cloudDeleteLibrary(seriesId);
  return true;
}

export async function setLibraryStatus(seriesId, status) {
  try {
    const t = await tx(STORES.library, 'readwrite');
    const item = await reqAsPromise(t.get(seriesId));
    if (!item) return false;
    item.status = status;
    await reqAsPromise(t.put(item));
    cloudPutLibrary(seriesId, { status });
    return true;
  } catch { return false; }
}

export async function getLibrary(filter = 'all') {
  // If signed in, prefer cloud (cross-device truth)
  const u = getUser();
  if (u) {
    try {
      const snap = await getDocs(libCol(u.uid));
      const items = snap.docs.map(d => d.data());
      const sorted = items.sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0));
      return filter === 'all' ? sorted : sorted.filter(x => x.status === filter);
    } catch (e) { /* fall through to local */ }
  }
  try {
    const t = await tx(STORES.library);
    const all = await reqAsPromise(t.getAll());
    const items = all.sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0));
    return filter === 'all' ? items : items.filter(x => x.status === filter);
  } catch { return []; }
}

// =====================================================
// HISTORY (reading history)
// =====================================================
export async function recordRead(seriesId, chapter, total = 0, page = 0) {
  const id = `${seriesId}_${chapter}`;
  const data = { id, seriesId, chapter: Number(chapter), page, total, readAt: Date.now() };
  // Local
  try {
    const t = await tx(STORES.history, 'readwrite');
    await reqAsPromise(t.put(data));

    // Bump library lastReadAt + currentChapter
    const lib = await tx(STORES.library, 'readwrite');
    const item = await reqAsPromise(lib.get(seriesId));
    if (item) {
      item.lastReadAt = Date.now();
      item.currentChapter = Math.max(item.currentChapter || 0, Number(chapter));
      await reqAsPromise(lib.put(item));
      cloudPutLibrary(seriesId, { lastReadAt: item.lastReadAt, currentChapter: item.currentChapter });
    }
  } catch (e) { console.warn(e); }
  // Cloud (best effort)
  cloudPutHistory(id, data);
}

export async function getHistory({ limit = 30 } = {}) {
  const u = getUser();
  if (u) {
    try {
      const q = query(histCol(u.uid), orderBy('readAt', 'desc'), fbLimit(limit));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data());
    } catch { /* fall through */ }
  }
  try {
    const t = await tx(STORES.history);
    const all = await reqAsPromise(t.getAll());
    return all.sort((a, b) => b.readAt - a.readAt).slice(0, limit);
  } catch { return []; }
}

export async function isChapterRead(seriesId, chapter) {
  try {
    const t = await tx(STORES.history);
    const r = await reqAsPromise(t.get(`${seriesId}_${chapter}`));
    return !!r;
  } catch { return false; }
}

export async function getReadChapters(seriesId) {
  try {
    const t = await tx(STORES.history);
    const idx = t.index('seriesId');
    const items = await reqAsPromise(idx.getAll(seriesId));
    return new Set(items.map(x => Number(x.chapter)));
  } catch { return new Set(); }
}

// =====================================================
// PROGRESS (per-chapter reading position) — local only
// =====================================================
export async function saveProgress(seriesId, chapter, page, total) {
  try {
    const id = `${seriesId}_${chapter}`;
    const t = await tx(STORES.progress, 'readwrite');
    await reqAsPromise(t.put({ id, seriesId, chapter: Number(chapter), page, total, updatedAt: Date.now() }));
  } catch (e) { console.warn(e); }
}

export async function getProgress(seriesId, chapter) {
  try {
    const id = `${seriesId}_${chapter}`;
    const t = await tx(STORES.progress);
    return await reqAsPromise(t.get(id)) || null;
  } catch { return null; }
}

// =====================================================
// CLOUD SYNC — push all local data to Firestore on first sign-in
// =====================================================
const SYNC_FLAG = (uid) => `vs:synced:${uid}`;

export async function syncLocalToCloud() {
  const u = getUser();
  if (!u) return { skipped: true };
  // Only sync once per user (in this browser)
  if (localStorage.getItem(SYNC_FLAG(u.uid))) return { skipped: true };

  try {
    // Library
    const lib = await tx(STORES.library);
    const libItems = await reqAsPromise(lib.getAll());
    await Promise.all(libItems.map(item =>
      setDoc(libRef(u.uid, item.seriesId), item, { merge: true }).catch(() => {})
    ));

    // History (most recent 100 to keep it cheap)
    const hist = await tx(STORES.history);
    const histItems = await reqAsPromise(hist.getAll());
    const recentHist = histItems.sort((a, b) => b.readAt - a.readAt).slice(0, 100);
    await Promise.all(recentHist.map(item =>
      setDoc(histRef(u.uid, item.id), item, { merge: true }).catch(() => {})
    ));

    localStorage.setItem(SYNC_FLAG(u.uid), String(Date.now()));
    return { libraryCount: libItems.length, historyCount: recentHist.length };
  } catch (e) {
    console.warn('syncLocalToCloud failed:', e);
    return { error: e.message };
  }
}

// =====================================================
// CLOUD → LOCAL hydration (when signing in on a new device)
// =====================================================
export async function hydrateFromCloud() {
  const u = getUser();
  if (!u) return;
  try {
    // Library
    const libSnap = await getDocs(libCol(u.uid));
    const t = await tx(STORES.library, 'readwrite');
    for (const d of libSnap.docs) {
      const data = d.data();
      // Only overwrite local if cloud is newer (or local missing)
      const existing = await reqAsPromise(t.get(data.seriesId));
      if (!existing || (data.lastReadAt || 0) > (existing.lastReadAt || 0)) {
        await reqAsPromise(t.put(data));
      }
    }
  } catch (e) { console.warn('hydrateFromCloud failed:', e); }
}

// On sign-in: push local → cloud once, then pull cloud → local
onAuthChange(async (user) => {
  if (!user) return;
  // Run async, don't block UI
  setTimeout(async () => {
    await syncLocalToCloud();
    await hydrateFromCloud();
  }, 1500);
});

// =====================================================
// READER PREFERENCES (localStorage)
// =====================================================
const PREF_KEY = 'voidscans:reader-prefs';
const DEFAULT_PREFS = {
  fit: 'width',
  zoom: 100,
  gap: 'small',
  direction: 'vertical',
  hideUI: false,
  preload: 3
};

export function getReaderPrefs() {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
  } catch { return { ...DEFAULT_PREFS }; }
}

export function setReaderPrefs(patch) {
  const next = { ...getReaderPrefs(), ...patch };
  try { localStorage.setItem(PREF_KEY, JSON.stringify(next)); } catch {}
  return next;
}

// =====================================================
// REACTIONS / RATINGS — local guards against re-spamming
// =====================================================
export function hasReacted(seriesId) {
  try { return localStorage.getItem(`vs:reacted:${seriesId}`); } catch { return null; }
}
export function markReacted(seriesId, key) {
  try { localStorage.setItem(`vs:reacted:${seriesId}`, key); } catch {}
}
export function hasRated(seriesId) {
  try { return Number(localStorage.getItem(`vs:rated:${seriesId}`)) || null; } catch { return null; }
}
export function markRated(seriesId, n) {
  try { localStorage.setItem(`vs:rated:${seriesId}`, String(n)); } catch {}
}

// =====================================================
// COMMENT LIKE — prevent double-likes locally
// =====================================================
export function hasLikedComment(commentId) {
  try { return !!localStorage.getItem(`vs:liked:${commentId}`); } catch { return false; }
}
export function markCommentLiked(commentId) {
  try { localStorage.setItem(`vs:liked:${commentId}`, '1'); } catch {}
}
