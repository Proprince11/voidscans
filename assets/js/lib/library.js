// =====================================================
// library.js — Local library, bookmarks, and reading
// progress. Stored in IndexedDB so it survives across
// sessions and works offline. Optional Firestore sync if
// the user is signed in.
// =====================================================

import { getUser } from './auth.js';

const DB_NAME = 'voidscans';
const DB_VERSION = 1;
const STORES = {
  library:  'library',   // { seriesId, title, cover, status, addedAt, currentChapter, lastReadAt, follow }
  history:  'history',   // { id (seriesId_chNum), seriesId, chapter, page, total, readAt }
  progress: 'progress'   // { seriesId_chNum: { page, total } }
};

let dbPromise;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
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
  try {
    const t = await tx(STORES.library, 'readwrite');
    await reqAsPromise(t.put({
      seriesId: series.slug || series.id,
      title: series.title,
      cover: series.cover,
      status,
      follow: true,
      addedAt: Date.now(),
      lastReadAt: Date.now(),
      currentChapter: 0
    }));
    return true;
  } catch (e) { console.warn(e); return false; }
}

export async function removeFromLibrary(seriesId) {
  try {
    const t = await tx(STORES.library, 'readwrite');
    await reqAsPromise(t.delete(seriesId));
    return true;
  } catch { return false; }
}

export async function setLibraryStatus(seriesId, status) {
  try {
    const t = await tx(STORES.library, 'readwrite');
    const item = await reqAsPromise(t.get(seriesId));
    if (!item) return false;
    item.status = status;
    await reqAsPromise(t.put(item));
    return true;
  } catch { return false; }
}

export async function getLibrary(filter = 'all') {
  try {
    const t = await tx(STORES.library);
    const all = await reqAsPromise(t.getAll());
    const items = all.sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0));
    if (filter === 'all') return items;
    return items.filter(x => x.status === filter);
  } catch { return []; }
}

// =====================================================
// HISTORY (reading history)
// =====================================================
export async function recordRead(seriesId, chapter, total = 0, page = 0) {
  try {
    const id = `${seriesId}_${chapter}`;
    const t = await tx(STORES.history, 'readwrite');
    await reqAsPromise(t.put({
      id, seriesId, chapter: Number(chapter), page, total,
      readAt: Date.now()
    }));

    // Bump library lastReadAt + currentChapter
    const lib = await tx(STORES.library, 'readwrite');
    const item = await reqAsPromise(lib.get(seriesId));
    if (item) {
      item.lastReadAt = Date.now();
      item.currentChapter = Math.max(item.currentChapter || 0, Number(chapter));
      await reqAsPromise(lib.put(item));
    }
  } catch (e) { console.warn(e); }
}

export async function getHistory({ limit = 30 } = {}) {
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
// PROGRESS (per-chapter reading position)
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
// READER PREFERENCES (localStorage)
// =====================================================
const PREF_KEY = 'voidscans:reader-prefs';
const DEFAULT_PREFS = {
  fit: 'width',          // width | height | original
  zoom: 100,             // 75 | 100 | 125 | 150
  gap: 'small',          // small | medium | large
  direction: 'vertical', // vertical | horizontal | rtl
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
