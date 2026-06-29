// =====================================================
// api.js — Data layer.
// Reads from Firestore, normalizes old + new schema fields,
// caches with TTL to avoid hammering Firestore free tier.
// All views go through here. Don't read Firestore directly.
// =====================================================

import { db } from './firebase.js';
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, startAfter, increment, serverTimestamp,
  collectionGroup, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

import { normStatus, normType, slugify } from './utils.js';
import { SITE } from './site.config.js';

// =====================================================
// EDGE CACHE — try cache Worker first, fallback to Firestore.
// =====================================================
async function cachedApiGet(path) {
  if (!SITE.cacheApi) return null; // disabled
  try {
    const res = await fetch(`${SITE.cacheApi}${path}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // cache Worker down, fall through to Firestore
  }
}

// =====================================================
// CACHE — in-memory TTL cache to dedupe Firestore reads.
// =====================================================
const cache = new Map(); // key -> { value, expires }
const inflight = new Map(); // key -> Promise

const TTL = {
  series: 5 * 60 * 1000,    // 5 min
  chapters: 2 * 60 * 1000,  // 2 min
  reactions: 60 * 1000,     // 1 min
  rating: 60 * 1000,
  comments: 30 * 1000
};

function cacheGet(key) {
  const v = cache.get(key);
  if (!v) return null;
  if (Date.now() > v.expires) { cache.delete(key); return null; }
  return v.value;
}
function cacheSet(key, value, ttl) {
  cache.set(key, { value, expires: Date.now() + ttl });
}
export function cacheBust(prefix = '') {
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
}

async function memoFetch(key, ttl, fn) {
  const hit = cacheGet(key);
  if (hit !== null) return hit;
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try {
      const v = await fn();
      cacheSet(key, v, ttl);
      return v;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

// =====================================================
// NORMALIZATION — old schema is tolerant.
// Old: series/{auto-id} {slug, title, cover, description, type, status, latestChapter, createdAt}
// Old: chapters/{auto-id} {seriesSlug, chapterNum, images, createdAt}
//
// New (target): series/{slug} as doc id, plus richer fields.
// New: series/{slug}/chapters/{number} subcollection (eventually).
//
// To avoid breaking changes, this layer reads BOTH shapes.
// =====================================================
export function normalizeSeries(raw, fallbackId = '') {
  const r = raw || {};
  const slug = r.slug || fallbackId;
  return {
    id: fallbackId || slug,
    slug,
    title: r.title || 'Untitled',
    altTitles: Array.isArray(r.altTitles) ? r.altTitles : [],
    cover: r.cover || '',
    coverBlur: r.coverBlur || null,
    type: normType(r.type),
    status: normStatus(r.status),
    year: Number(r.year) || null,
    author: r.author || '',
    artist: r.artist || '',
    genres: Array.isArray(r.genres) ? r.genres : [],
    tags: Array.isArray(r.tags) ? r.tags : [],
    description: r.description || '',
    rating: r.rating && typeof r.rating === 'object'
      ? { average: Number(r.rating.average) || 0, total: Number(r.rating.total) || 0 }
      : { average: 0, total: 0 },
    views: Number(r.views) || 0,
    followers: Number(r.followers) || 0,
    latestChapter: Number(r.latestChapter ?? r.latestChapterNumber ?? 0) || 0,
    latestChapterAt: r.latestChapterAt || r.updatedAt || r.createdAt || null,
    featured: !!r.featured,
    hot: !!r.hot,
    new: !!r.new,
    createdAt: r.createdAt || null,
    updatedAt: r.updatedAt || null
  };
}

export function normalizeChapter(raw, fallbackId = '') {
  const r = raw || {};
  return {
    id: fallbackId,
    seriesSlug: r.seriesSlug || r.series || '',
    number: Number(r.chapterNum ?? r.number) || 0,
    title: r.title || '',
    pages: Array.isArray(r.images) ? r.images : (Array.isArray(r.pages) ? r.pages : []),
    views: Number(r.views) || 0,
    createdAt: r.createdAt || null
  };
}

// =====================================================
// SERIES READS
// =====================================================
export async function fetchAllSeries({ limitTo = 200 } = {}) {
  return memoFetch(`series:all:${limitTo}`, TTL.series, async () => {
    // Try edge cache first (avoids Firestore read)
    const cached = await cachedApiGet('/api/series');
    if (cached && Array.isArray(cached)) return cached.slice(0, limitTo);
    // Fallback to direct Firestore
    const q = query(collection(db, 'series'), orderBy('createdAt', 'desc'), limit(limitTo));
    const snap = await getDocs(q);
    return snap.docs.map(d => normalizeSeries(d.data(), d.id));
  });
}

/** Find a single series by its slug field (legacy schema). */
export async function fetchSeriesBySlug(slug) {
  if (!slug) return null;
  return memoFetch(`series:slug:${slug}`, TTL.series, async () => {
    // Try edge cache first
    const cached = await cachedApiGet(`/api/series/${encodeURIComponent(slug)}`);
    if (cached && cached.slug && !cached.error) return cached;
    // Fallback to direct Firestore
    const q = query(collection(db, 'series'), where('slug', '==', slug), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return normalizeSeries(d.data(), d.id);
  });
}

/** Sample home page sections. */
export async function fetchHomeSections() {
  const all = await fetchAllSeries({ limitTo: 60 });
  const featured = all.filter(s => s.featured);
  const hot = all.filter(s => s.hot);
  const newOnes = all.filter(s => s.new);
  const heroSet = (featured.length ? featured : all).slice(0, 5);
  const popular = (hot.length ? hot : all).slice(0, 12);
  const newlyAdded = (newOnes.length ? newOnes : all).slice(0, 12);
  const latest = all.filter(s => s.latestChapter > 0)
    .sort((a, b) => {
      const at = a.latestChapterAt?.toMillis ? a.latestChapterAt.toMillis() : (a.latestChapterAt ? new Date(a.latestChapterAt).getTime() : 0);
      const bt = b.latestChapterAt?.toMillis ? b.latestChapterAt.toMillis() : (b.latestChapterAt ? new Date(b.latestChapterAt).getTime() : 0);
      return bt - at;
    })
    .slice(0, 12);

  // Fetch recent chapters (last 4) for each series in Latest Updates
  const latestWithChapters = await Promise.all(
    latest.map(async (s) => {
      try {
        const chapters = await fetchChapters(s.slug);
        return { ...s, recentChapters: chapters.slice(0, 4) };
      } catch {
        return { ...s, recentChapters: [] };
      }
    })
  );

  // Top series ranked by views (for popularity ranking)
  const topSeries = [...all]
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 9);

  return { all, hero: heroSet, popular, newlyAdded, latest: latestWithChapters, topSeries };
}

// =====================================================
// SERIES WRITES (admin only — security rules enforce)
// =====================================================
export async function createSeries(data) {
  const slug = data.slug || slugify(data.title);
  const payload = {
    ...data,
    slug,
    title: data.title || 'Untitled',
    type: normType(data.type),
    status: normStatus(data.status),
    altTitles: data.altTitles || [],
    genres: data.genres || [],
    tags: data.tags || [],
    rating: data.rating || { average: 0, total: 0 },
    views: 0,
    followers: 0,
    latestChapter: data.latestChapter || 0,
    featured: !!data.featured,
    hot: !!data.hot,
    new: data.new === undefined ? true : !!data.new,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  // Use slug as doc id when creating new (avoids dup-slug bugs)
  await setDoc(doc(db, 'series', slug), payload);
  cacheBust('series:');
  return slug;
}

export async function updateSeries(docId, patch) {
  await updateDoc(doc(db, 'series', docId), {
    ...patch,
    updatedAt: serverTimestamp()
  });
  cacheBust('series:');
}

export async function deleteSeries(docId, slug) {
  // Delete child chapters first
  const chQ = query(collection(db, 'chapters'), where('seriesSlug', '==', slug));
  const chSnap = await getDocs(chQ);
  await Promise.all(chSnap.docs.map(d => deleteDoc(doc(db, 'chapters', d.id))));
  await deleteDoc(doc(db, 'series', docId));
  cacheBust('series:');
  cacheBust(`chapters:${slug}`);
}

// =====================================================
// CHAPTERS
// =====================================================
export async function fetchChapters(slug) {
  if (!slug) return [];
  return memoFetch(`chapters:${slug}`, TTL.chapters, async () => {
    // Try edge cache first
    const cached = await cachedApiGet(`/api/chapters/${encodeURIComponent(slug)}`);
    if (cached && Array.isArray(cached)) return cached;
    // Fallback to direct Firestore
    const q = query(
      collection(db, 'chapters'),
      where('seriesSlug', '==', slug),
      orderBy('chapterNum', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => normalizeChapter(d.data(), d.id));
  });
}

export async function fetchChapter(slug, number) {
  const num = Number(number);
  if (!slug || !num) return null;
  return memoFetch(`chapters:${slug}:${num}`, TTL.chapters, async () => {
    // Try edge cache first
    const cached = await cachedApiGet(`/api/chapter/${encodeURIComponent(slug)}/${num}`);
    if (cached && cached.pages && !cached.error) return cached;
    // Fallback to direct Firestore
    const q = query(
      collection(db, 'chapters'),
      where('seriesSlug', '==', slug),
      where('chapterNum', '==', num),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return normalizeChapter(snap.docs[0].data(), snap.docs[0].id);
  });
}

export async function createChapter({ seriesSlug, number, title = '', pages = [] }) {
  const ch = {
    seriesSlug,
    chapterNum: Number(number),
    title,
    images: pages.filter(Boolean),
    createdAt: serverTimestamp()
  };
  const ref = await addDoc(collection(db, 'chapters'), ch);

  // Update series.latestChapter & latestChapterAt without overwriting createdAt
  const sQ = query(collection(db, 'series'), where('slug', '==', seriesSlug), limit(1));
  const sSnap = await getDocs(sQ);
  if (!sSnap.empty) {
    const d = sSnap.docs[0];
    const cur = Number(d.data().latestChapter || 0);
    if (Number(number) >= cur) {
      await updateDoc(d.ref, {
        latestChapter: Number(number),
        latestChapterAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  }
  cacheBust(`chapters:${seriesSlug}`);
  cacheBust('series:');
  return ref.id;
}

export async function updateChapter(chapterDocId, patch) {
  const fixed = { ...patch };
  if (patch.pages) { fixed.images = patch.pages; delete fixed.pages; }
  if (patch.number !== undefined) { fixed.chapterNum = Number(patch.number); delete fixed.number; }
  await updateDoc(doc(db, 'chapters', chapterDocId), fixed);
  cacheBust('chapters:');
}

export async function deleteChapter(chapterDocId, seriesSlug) {
  await deleteDoc(doc(db, 'chapters', chapterDocId));
  cacheBust(`chapters:${seriesSlug}`);
}

// =====================================================
// REACTIONS — counts per series, stored in /reactions/{slug}
// =====================================================
const REACTION_KEYS = ['fire', 'heart', 'star', 'mind', 'sad'];

export async function fetchReactions(slug) {
  if (!slug) return REACTION_KEYS.reduce((a, k) => (a[k] = 0, a), {});
  return memoFetch(`reactions:${slug}`, TTL.reactions, async () => {
    const ref = doc(db, 'reactions', slug);
    const snap = await getDoc(ref);
    const out = REACTION_KEYS.reduce((a, k) => (a[k] = 0, a), {});
    if (snap.exists()) Object.assign(out, snap.data());
    return out;
  });
}

export async function addReaction(slug, key) {
  if (!REACTION_KEYS.includes(key)) throw new Error('invalid reaction');
  const ref = doc(db, 'reactions', slug);
  try {
    await updateDoc(ref, { [key]: increment(1) });
  } catch {
    await setDoc(ref, { [key]: 1 }, { merge: true });
  }
  cacheBust(`reactions:${slug}`);
}

// =====================================================
// RATINGS — per series doc, stored in /ratings/{slug}
// =====================================================
export async function fetchRating(slug) {
  if (!slug) return { average: 0, total: 0, distribution: [0,0,0,0,0] };
  return memoFetch(`rating:${slug}`, TTL.rating, async () => {
    const snap = await getDoc(doc(db, 'ratings', slug));
    if (!snap.exists()) return { average: 0, total: 0, distribution: [0,0,0,0,0] };
    const d = snap.data();
    return {
      average: Number(d.average) || 0,
      total: Number(d.total) || 0,
      distribution: d.distribution || [0,0,0,0,0]
    };
  });
}

export async function submitRating(slug, stars) {
  const n = Math.max(1, Math.min(5, Math.round(Number(stars))));
  const ref = doc(db, 'ratings', slug);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const d = snap.data();
    const total = (Number(d.total) || 0) + 1;
    const avg = ((Number(d.average) || 0) * (total - 1) + n) / total;
    const dist = Array.isArray(d.distribution) ? [...d.distribution] : [0,0,0,0,0];
    dist[n - 1]++;
    await updateDoc(ref, { average: avg, total, distribution: dist });
  } else {
    const dist = [0,0,0,0,0]; dist[n - 1] = 1;
    await setDoc(ref, { average: n, total: 1, distribution: dist });
  }
  cacheBust(`rating:${slug}`);
}

// =====================================================
// COMMENTS — under /series/{slug}/comments (subcoll), or
// /comments/{slug}/messages (alt). We use the former.
// =====================================================
export async function fetchComments(slug, limitTo = 30) {
  if (!slug) return [];
  return memoFetch(`comments:${slug}:${limitTo}`, TTL.comments, async () => {
    try {
      const q = query(
        collection(db, 'series', slug, 'comments'),
        orderBy('createdAt', 'desc'),
        limit(limitTo)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn('Comments fetch failed:', e);
      return [];
    }
  });
}

export async function postComment(slug, { authorName, authorId = null, text, chapter = null }) {
  const cleanText = String(text || '').trim();
  if (cleanText.length < 2 || cleanText.length > 1000) {
    throw new Error('Comment must be 2–1000 characters.');
  }
  const ref = await addDoc(collection(db, 'series', slug, 'comments'), {
    authorName: String(authorName || 'Anonymous').slice(0, 40),
    authorId,
    text: cleanText,
    chapter,
    likes: 0,
    flagged: false,
    createdAt: serverTimestamp()
  });
  cacheBust(`comments:${slug}`);
  return ref.id;
}

export async function likeComment(slug, commentId) {
  const ref = doc(db, 'series', slug, 'comments', commentId);
  try {
    await updateDoc(ref, { likes: increment(1) });
  } catch (e) {
    console.warn('Like failed:', e);
    throw e;
  }
  cacheBust(`comments:${slug}`);
}

export async function deleteComment(slug, commentId) {
  await deleteDoc(doc(db, 'series', slug, 'comments', commentId));
  cacheBust(`comments:${slug}`);
}

// =====================================================
// SEARCH (client-side, on cached series list)
// =====================================================
export function searchSeries(allSeries, q) {
  if (!q || q.length < 1) return allSeries;
  const needle = String(q).toLowerCase().trim();
  const ranked = [];
  for (const s of allSeries) {
    let score = 0;
    if (s.title.toLowerCase() === needle) score += 100;
    else if (s.title.toLowerCase().includes(needle)) score += 50;
    if (s.altTitles.some(a => a.toLowerCase().includes(needle))) score += 30;
    if (s.genres.some(g => g.toLowerCase() === needle)) score += 20;
    if (s.tags.some(t => t.toLowerCase().includes(needle))) score += 10;
    if (s.description.toLowerCase().includes(needle)) score += 5;
    if (score > 0) ranked.push({ s, score });
  }
  return ranked.sort((a, b) => b.score - a.score).map(r => r.s);
}

// =====================================================
// ADMIN HELPERS
// =====================================================
export async function fetchStats() {
  const series = await fetchAllSeries({ limitTo: 500 });
  // Use a summary query for chapter count instead of reading every document.
  // Firestore count() aggregation (available since SDK 10.5+) is far cheaper
  // than fetching all docs. Fallback to a cached count if unavailable.
  let chapterCount = 0;
  try {
    // Try getCountFromServer (Firestore aggregation query)
    const { getCountFromServer } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    const q = query(collection(db, 'chapters'));
    const snap = await getCountFromServer(q);
    chapterCount = snap.data().count;
  } catch {
    // Fallback: sum latestChapter across all series (approximation, zero Firestore reads)
    chapterCount = series.reduce((sum, s) => sum + (s.latestChapter || 0), 0);
  }
  return {
    seriesCount: series.length,
    chapterCount,
    ongoing: series.filter(s => s.status === 'ongoing').length,
    completed: series.filter(s => s.status === 'completed').length
  };
}


// =====================================================
// VIEW TRACKING & FOLLOWERS
// Counters live on series/chapter docs. Public-write is allowed
// in Firestore rules ONLY for views/followers fields (locked-down
// via affectedKeys() check). Sessioned dedup so a single visit
// counts once per series/chapter.
// =====================================================
const SESS_KEY = (k) => `vs:viewed:${k}`;

function alreadyViewed(key) {
  try { return !!sessionStorage.getItem(SESS_KEY(key)); } catch { return false; }
}
function markViewed(key) {
  try { sessionStorage.setItem(SESS_KEY(key), '1'); } catch {}
}

/** Track a series page view. Sessioned — counts once per session per series. */
export async function trackSeriesView(slug) {
  if (!slug) return;
  const key = `series:${slug}`;
  if (alreadyViewed(key)) return;
  markViewed(key);
  try {
    await updateDoc(doc(db, 'series', slug), { views: increment(1) });
    cacheBust(`series:`);
  } catch (e) {
    // If rules reject (e.g. not yet updated to allow views), fail silent
    console.debug('trackSeriesView skipped:', e?.code || e?.message);
  }
}

/** Track a chapter view. Increments chapter.views + parent series.views. */
export async function trackChapterView(seriesSlug, chapterNum) {
  if (!seriesSlug || !chapterNum) return;
  const key = `ch:${seriesSlug}:${chapterNum}`;
  if (alreadyViewed(key)) return;
  markViewed(key);
  try {
    // Find chapter doc by composite query
    const q = query(
      collection(db, 'chapters'),
      where('seriesSlug', '==', seriesSlug),
      where('chapterNum', '==', Number(chapterNum)),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    await updateDoc(snap.docs[0].ref, { views: increment(1) });
    cacheBust(`chapters:${seriesSlug}`);
  } catch (e) {
    console.debug('trackChapterView skipped:', e?.code || e?.message);
  }
}

/** Adjust series.followers counter. delta = +1 on bookmark, -1 on remove. */
export async function adjustFollowers(slug, delta = 1) {
  if (!slug) return;
  try {
    await updateDoc(doc(db, 'series', slug), { followers: increment(delta) });
    cacheBust(`series:`);
  } catch (e) {
    console.debug('adjustFollowers skipped:', e?.code || e?.message);
  }
}

// =====================================================
// PER-CHAPTER COMMENTS
// Stored under /series/{slug}/comments with a `chapter` field.
// =====================================================
export async function fetchChapterComments(slug, chapterNum, limitTo = 30) {
  if (!slug || !chapterNum) return [];
  return memoFetch(`comments:${slug}:ch:${chapterNum}:${limitTo}`, TTL.comments, async () => {
    try {
      const q = query(
        collection(db, 'series', slug, 'comments'),
        where('chapter', '==', Number(chapterNum)),
        orderBy('createdAt', 'desc'),
        limit(limitTo)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn('fetchChapterComments failed:', e);
      return [];
    }
  });
}



// =====================================================
// REPORTS — user-submitted issue reports for chapters/series
// (broken images, bad translation, wrong order, etc.)
// Stored under top-level /reports collection. Admin-readable,
// public-writable (rules clamp to required fields + rate-limit).
// =====================================================
export async function submitReport({ seriesSlug, chapter = null, reason, details = '', authorName = '', authorEmail = '' }) {
  const allowedReasons = ['broken_image', 'wrong_chapter', 'bad_translation', 'spam_comment', 'other'];
  if (!seriesSlug) throw new Error('seriesSlug required');
  if (!allowedReasons.includes(reason)) throw new Error('invalid reason');
  const cleanDetails = String(details || '').trim().slice(0, 1000);
  const payload = {
    seriesSlug: String(seriesSlug).slice(0, 200),
    chapter: chapter ? Number(chapter) : null,
    reason,
    details: cleanDetails,
    authorName: String(authorName || 'Anonymous').slice(0, 40),
    authorEmail: String(authorEmail || '').slice(0, 200),
    status: 'open',
    pageUrl: typeof location !== 'undefined' ? location.href.slice(0, 500) : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : '',
    createdAt: serverTimestamp()
  };
  const ref = await addDoc(collection(db, 'reports'), payload);
  return ref.id;
}
