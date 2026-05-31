// =====================================================
// settings.js — Site-wide settings (admin-editable, public-readable).
//
// Single Firestore doc at /site/settings holds all the editable site
// configuration: branding (logo), monetization (Ko-fi, ads, payment keys),
// integrations (Discord webhook), theme defaults, feature toggles.
//
// Loaded once at boot, cached in memory + localStorage for instant cold
// loads. Listeners (admin form save) trigger a refetch and re-broadcast.
// =====================================================

import { db } from './firebase.js';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const LS_KEY = 'jayascans:site-settings:v1';
const SETTINGS_REF = () => doc(db, 'site', 'settings');

// =====================================================
// DEFAULTS — also serve as the schema. Anything missing from Firestore
// falls back to these so the UI never breaks even if the doc is empty.
// =====================================================
export const DEFAULT_SETTINGS = {
  branding: {
    logoUrl: '',                 // empty = use built-in /assets/images/logo.svg
    logoMarkOnly: false,         // hide JAYA·SCANS text, only show V-mark
    siteName: 'JayaScans',       // overrides SITE.name when non-empty
    tagline: ''                  // overrides SITE.tagline when non-empty
  },
  monetization: {
    kofi: {
      enabled: false,
      url: '',                   // e.g. 'https://ko-fi.com/jayascans'
      text: 'Enjoying our scans? Show some love and help us keep going.'
    },
    ads: {
      headerEnabled: false,
      headerScript: '',          // raw HTML/JS dropped into a top slot
      footerEnabled: false,
      footerScript: '',          // raw HTML/JS dropped into a bottom slot
      midChapterEnabled: false,
      midChapterScript: '',      // injected between reader pages 5 and 6
      sidebarEnabled: false,
      sidebarScript: ''          // sidebar slot on browse / series pages
    },
    payment: {
      stripePublicKey: '',       // pk_live_... — public key only, never secret
      paypalClientId: ''
    }
  },
  integrations: {
    discord: {
      enabled: false,
      webhookUrl: '',            // discord webhook URL — fired on chapter publish
      mentionRole: ''            // optional <@&ROLE_ID>
    }
  },
  theme: {
    defaultTheme: 'dark',        // 'dark' | 'light' | 'sepia'
    allowUserOverride: true
  },
  features: {
    reportsEnabled: true,        // user report button on chapter pages
    commentsEnabled: true,
    ratingsEnabled: true,
    kofiEnabled: false,          // master toggle — ignored if monetization.kofi.enabled is false too
    adsEnabled: false,           // master toggle for all ad slots
    themeToggleEnabled: true,    // show theme switcher in nav
    discordWebhookEnabled: false // master toggle
  }
};

// =====================================================
// IN-MEMORY STATE
// =====================================================
let cached = null;
const subscribers = new Set();

function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  const out = Array.isArray(target) ? [...target] : { ...target };
  for (const k of Object.keys(source)) {
    if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
      out[k] = deepMerge(out[k] || {}, source[k]);
    } else {
      out[k] = source[k];
    }
  }
  return out;
}

function readLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeLocal(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
}

/** Synchronous getter — returns default + localStorage cached values.
 *  Always safe to call; never returns null. */
export function getSettings() {
  if (cached) return cached;
  const local = readLocal();
  cached = local ? deepMerge(DEFAULT_SETTINGS, local) : { ...DEFAULT_SETTINGS };
  return cached;
}

/** Async loader — fetches from Firestore, caches, returns merged. */
export async function loadSettings() {
  // Return cached immediately if we already loaded this session
  if (cached && cached.__loaded) return cached;
  try {
    const snap = await getDoc(SETTINGS_REF());
    const remote = snap.exists() ? snap.data() : {};
    cached = deepMerge(DEFAULT_SETTINGS, remote);
    cached.__loaded = true;
    writeLocal(cached);
    broadcast();
    return cached;
  } catch (e) {
    // Firestore Rules might block read for unauthenticated; fall back to local
    console.debug('loadSettings: falling back to local cache', e.message);
    cached = readLocal() || { ...DEFAULT_SETTINGS };
    return cached;
  }
}

/** Save a partial patch to Firestore + invalidate cache. Admin only — Rules enforce. */
export async function saveSettings(patch) {
  await setDoc(SETTINGS_REF(), {
    ...patch,
    updatedAt: serverTimestamp()
  }, { merge: true });
  // Refresh local cache with the merged shape
  cached = deepMerge(getSettings(), patch);
  writeLocal(cached);
  broadcast();
  return cached;
}

/** Subscribe to settings changes (e.g. after admin saves). Returns unsub. */
export function onSettingsChange(fn) {
  subscribers.add(fn);
  if (cached) fn(cached);
  return () => subscribers.delete(fn);
}

function broadcast() {
  for (const fn of subscribers) {
    try { fn(cached); } catch (e) { console.warn('settings subscriber error:', e); }
  }
}

/** Real-time updates — call once at boot to push admin saves to all open tabs. */
export function watchSettings() {
  try {
    return onSnapshot(SETTINGS_REF(), (snap) => {
      if (!snap.exists()) return;
      cached = deepMerge(DEFAULT_SETTINGS, snap.data());
      cached.__loaded = true;
      writeLocal(cached);
      broadcast();
    }, (err) => {
      // Public read may be blocked by rules — fail silent
      console.debug('watchSettings:', err.code || err.message);
    });
  } catch (e) {
    return () => {};
  }
}
