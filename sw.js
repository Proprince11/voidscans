// =====================================================
// Service Worker — VoidScans PWA
//
// Caching strategy:
//   - App shell (HTML/CSS/JS): network-first w/ cache fallback (3s timeout)
//   - Static assets (images on this origin, fonts): stale-while-revalidate
//   - Chapter page images (R2/Catbox/ImgBB/etc): cache-first (long-lived)
//   - Firestore/Auth/external scripts: no caching (always go through)
//
// Bumping CACHE_VERSION invalidates the old caches.
// =====================================================

const CACHE_VERSION = 'v3.0.1';
const SHELL_CACHE   = `shell-${CACHE_VERSION}`;
const ASSET_CACHE   = `asset-${CACHE_VERSION}`;
const IMAGE_CACHE   = `images-${CACHE_VERSION}`;

const SHELL_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/assets/css/tokens.css',
  '/assets/css/reset.css',
  '/assets/css/base.css',
  '/assets/css/components.css',
  '/assets/css/pages.css',
  '/assets/js/app.js',
  '/assets/js/lib/firebase.js',
  '/assets/js/lib/api.js',
  '/assets/js/lib/auth.js',
  '/assets/js/lib/router.js',
  '/assets/js/lib/library.js',
  '/assets/js/lib/ui.js',
  '/assets/js/lib/utils.js',
  '/assets/js/views/_components.js',
  '/assets/js/views/home.js',
  '/assets/js/views/browse.js',
  '/assets/js/views/search.js',
  '/assets/js/views/genre.js',
  '/assets/js/views/series.js',
  '/assets/js/views/reader.js',
  '/assets/js/views/library.js',
  '/assets/js/views/notFound.js',
  '/assets/images/favicon.svg',
  '/assets/images/logo.svg',
  '/assets/images/icon.svg'
];

// =====================================================
// INSTALL — precache shell
// =====================================================
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // addAll fails if any single URL fails — use individual adds
    await Promise.all(SHELL_URLS.map(url =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
    ));
    await self.skipWaiting();
  })());
});

// =====================================================
// ACTIVATE — clear old caches
// =====================================================
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => ![SHELL_CACHE, ASSET_CACHE, IMAGE_CACHE].includes(k))
      .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// =====================================================
// FETCH — strategy router
// =====================================================
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Don't intercept Firebase / Firestore / external auth APIs
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('googleusercontent.com')
  ) return;

  // Don't cache the admin shell (always fresh)
  if (url.pathname.startsWith('/admin')) {
    event.respondWith(networkOnly(req));
    return;
  }

  // Same-origin requests
  if (url.origin === self.location.origin) {
    // Navigation requests (SPA URLs) → network-first w/ shell fallback
    if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
      event.respondWith(navigationStrategy(req));
      return;
    }
    // Local images
    if (req.destination === 'image') {
      event.respondWith(staleWhileRevalidate(req, ASSET_CACHE));
      return;
    }
    // CSS / JS / fonts
    event.respondWith(staleWhileRevalidate(req, ASSET_CACHE));
    return;
  }

  // Cross-origin images (chapter pages from Catbox/R2/ImgBB/etc)
  if (req.destination === 'image') {
    event.respondWith(cacheFirst(req, IMAGE_CACHE));
    return;
  }

  // Cross-origin fonts
  if (req.destination === 'font') {
    event.respondWith(cacheFirst(req, ASSET_CACHE));
    return;
  }
});

// =====================================================
// STRATEGIES
// =====================================================

async function navigationStrategy(req) {
  // Try network with 3s timeout, fall back to cached shell, then offline page
  try {
    const fresh = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))
    ]);
    if (fresh && fresh.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put('/', fresh.clone());
      return fresh;
    }
    throw new Error('bad response');
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match('/index.html'))
        || (await cache.match('/'))
        || (await cache.match('/offline.html'))
        || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then((res) => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return cached || fetchPromise || new Response('', { status: 504 });
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

async function networkOnly(req) {
  try { return await fetch(req); }
  catch { return new Response('Offline', { status: 503 }); }
}

// =====================================================
// MESSAGES — let pages talk to SW (e.g. precache chapter)
// =====================================================
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'PRECACHE_IMAGES') {
    const urls = Array.isArray(data.urls) ? data.urls : [];
    event.waitUntil((async () => {
      const cache = await caches.open(IMAGE_CACHE);
      await Promise.all(urls.map(u => cache.add(u).catch(() => {})));
    })());
  }
  if (data.type === 'CLEAR_CACHE') {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    })());
  }
});
