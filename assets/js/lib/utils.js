// =====================================================
// utils.js — Small helpers used everywhere.
// =====================================================

/** Safely escape HTML for innerHTML usage. */
export function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>'"]/g, t => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[t]));
}

/** Build a CSS-safe slug from arbitrary text. */
export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Capitalize first letter. */
export function cap(s) {
  if (!s) return '';
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

/** Title-case a slug like "solo-raven" → "Solo Raven". */
export function unslug(slug) {
  return String(slug || '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/** Relative time like "2 hrs ago", "3 days ago". */
export function timeAgo(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date));
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  const intervals = [
    { label: 'yr', s: 31536000 },
    { label: 'mo', s: 2592000 },
    { label: 'wk', s: 604800 },
    { label: 'd',  s: 86400 },
    { label: 'h',  s: 3600 },
    { label: 'm',  s: 60 },
  ];
  for (const i of intervals) {
    const v = Math.floor(seconds / i.s);
    if (v >= 1) return `${v}${i.label} ago`;
  }
  return 'just now';
}

/** ISO date for inputs. */
export function isoDate(date) {
  const d = date instanceof Date ? date : (date?.toDate ? date.toDate() : new Date(date));
  return d.toISOString().slice(0, 10);
}

/** Debounce. */
export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Throttle (leading edge). */
export function throttle(fn, ms = 100) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    }
  };
}

/** Pick query param. */
export function qs(name, search = location.search) {
  return new URLSearchParams(search).get(name);
}

/** First letter or '?' for avatar. */
export function avatarLetter(name) {
  if (!name) return '?';
  return String(name).trim().charAt(0).toUpperCase();
}

/** Is the screen mobile? (below 768px) */
export function isMobile() {
  return window.matchMedia('(max-width: 767px)').matches;
}

/** Is touch device? */
export function isTouch() {
  return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
}

/** Sleep helper. */
export const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Tagged template helper for clean HTML strings. */
export function html(strings, ...values) {
  return strings.reduce((acc, str, i) => acc + str + (i < values.length ? String(values[i] ?? '') : ''), '');
}

/** Normalize series status to lowercase canonical. */
export function normStatus(status) {
  const s = String(status || '').toLowerCase().trim();
  if (['ongoing', 'on-going', 'on going'].includes(s)) return 'ongoing';
  if (['completed', 'complete', 'finished'].includes(s)) return 'completed';
  if (['hiatus', 'on-hiatus', 'on hiatus', 'paused'].includes(s)) return 'hiatus';
  if (['dropped', 'cancelled', 'canceled'].includes(s)) return 'dropped';
  return s || 'ongoing';
}

/** Normalize series type. */
export function normType(type) {
  const t = String(type || '').toLowerCase().trim();
  if (t.includes('manhwa')) return 'manhwa';
  if (t.includes('manhua')) return 'manhua';
  if (t.includes('manga'))  return 'manga';
  return t || 'manhwa';
}

/** Stable hash from string (fnv1a). For comment IDs etc. */
export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** Format big numbers like 1.2k, 3.4m. */
export function compactNum(n) {
  n = Number(n) || 0;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0','') + 'm';
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace('.0','') + 'k';
  return String(n);
}

/** SVG icon helper — returns a string. */
export function icon(name, size = 20) {
  const s = `width="${size}" height="${size}"`;
  const map = {
    home:    `<svg xmlns="http://www.w3.org/2000/svg" ${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></svg>`,
    grid:    `<svg xmlns="http://www.w3.org/2000/svg" ${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    search:  `<svg xmlns="http://www.w3.org/2000/svg" ${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    bookmark:`<svg xmlns="http://www.w3.org/2000/svg" ${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
    bookmarkFill:`<svg xmlns="http://www.w3.org/2000/svg" ${s} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
    library: `<svg xmlns="http://www.w3.org/2000/svg" ${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    user:    `<svg xmlns="http://www.w3.org/2000/svg" ${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    menu:    `<svg xmlns="http://www.w3.org/2000/svg" ${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
    close:   `<svg xmlns="http://www.w3.org/2000/svg" ${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    arrowLeft: `<svg xmlns="http://www.w3.org/2000/svg" ${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
    arrowRight:`<svg xmlns="http://www.w3.org/2000/svg" ${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
    star:    `<svg xmlns="http://www.w3.org/2000/svg" ${s} viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>`,
    starOutline:`<svg xmlns="http://www.w3.org/2000/svg" ${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>`,
    share:   `<svg xmlns="http://www.w3.org/2000/svg" ${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
    settings:`<svg xmlns="http://www.w3.org/2000/svg" ${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    chevronUp:`<svg xmlns="http://www.w3.org/2000/svg" ${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`,
    chevronDown:`<svg xmlns="http://www.w3.org/2000/svg" ${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
    plus:    `<svg xmlns="http://www.w3.org/2000/svg" ${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    edit:    `<svg xmlns="http://www.w3.org/2000/svg" ${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>`,
    trash:   `<svg xmlns="http://www.w3.org/2000/svg" ${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>`,
    check:   `<svg xmlns="http://www.w3.org/2000/svg" ${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    eye:     `<svg xmlns="http://www.w3.org/2000/svg" ${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    drag:    `<svg xmlns="http://www.w3.org/2000/svg" ${s} viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>`,
    fire:    `🔥`,
    heart:   `❤️`,
    starE:   `⭐`,
    mind:    `🤯`,
    sad:     `😢`,
  };
  return map[name] || '';
}


/** Route image through same-origin proxy for edge caching.
 *  Used for cover thumbnails, hero images, and other small images that
 *  appear above-the-fold. Proxying them makes them same-origin (no extra
 *  DNS/TLS), and the Cloudflare CDN caches them at the edge.
 *  Chapter page images use proxyReaderImage() separately. */
export function proxyImage(url) {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('/api/')) return url;
  if (url.startsWith('data:'))  return url;
  // Don't proxy same-origin images
  try {
    const u = new URL(url);
    if (u.origin === location.origin) return url;
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  } catch { return url; }
}

/** Load chapter page images directly from external hosts.
 *  These are large, below-the-fold, and lazy-loaded — no need to proxy.
 *  The browser handles them fine with its own cache. */
export function proxyReaderImage(url) {
  return url;
}

// =====================================================
// setMeta — per-route SEO helper.
//
// Updates <title>, <meta description>, OG (og:*), Twitter (twitter:*),
// and <link rel="canonical"> in one call. Missing fields are skipped
// (the previous value for that tag, if any, stays put — except og:type
// which always resets to 'website' if not provided).
//
// Usage (typically at the end of a view, after data is loaded):
//   import { setMeta } from '../lib/utils.js';
//   setMeta({
//     title: 'Solo Raven Chapter 14 English | JayaScans',
//     description: 'Read chapter 14 of Solo Raven in English…',
//     image: 'https://…/cover.jpg',
//     url: location.href,
//     type: 'article'   // 'website' | 'article' | 'book'
//   });
// =====================================================
export function setMeta({ title, description, image, url, type } = {}) {
  if (title) document.title = title;

  // Canonical should strip query params and fragments to avoid duplicates
  if (url) {
    try {
      const canonical = new URL(url);
      canonical.search = '';
      canonical.hash = '';
      setLinkHref('canonical', canonical.href);
    } catch {
      setLinkHref('canonical', url);
    }
  }

  if (description) setMetaTag('name', 'description', description);

  // Open Graph
  if (title)       setMetaTag('property', 'og:title', title);
  if (description) setMetaTag('property', 'og:description', description);
  if (image)       setMetaTag('property', 'og:image', image);
  if (url)         setMetaTag('property', 'og:url', url);
  // Always set og:type so it doesn't leak across routes (default 'website')
  setMetaTag('property', 'og:type', type || 'website');

  // Twitter
  if (title)       setMetaTag('name', 'twitter:title', title);
  if (description) setMetaTag('name', 'twitter:description', description);
  if (image)       setMetaTag('name', 'twitter:image', image);
}

function setMetaTag(attr, key, value) {
  if (!value) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', String(value));
}

function setLinkHref(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', String(href));
}

/** Truncate a string to N chars on a word boundary, with ellipsis if cut. */
export function truncate(str, max = 160) {
  const s = String(str || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut) + '…';
}
