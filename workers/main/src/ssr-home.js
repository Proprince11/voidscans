// =====================================================
// ssr-home.js — Server-side pre-render of the homepage.
//
// Builds a complete HTML page with real series data baked in.
// Stored in KV, served instantly to visitors. Client JS hydrates
// over the top seamlessly (replaces #app content on load).
//
// This eliminates the biggest PageSpeed bottleneck:
//   Old: blank page → JS loads → Firestore fetch → render (3-5s)
//   New: pre-built HTML served in <50ms → JS hydrates in background
//
// Refreshed every 5 minutes via cron trigger.
// =====================================================

import { listDocs } from './firestore.js';

const KV_KEY = 'homepage:html';

/**
 * Serve pre-rendered homepage if available in KV.
 * Returns null if no cached version exists (falls through to SPA).
 */
export async function servePrerenderedHome(request, env) {
  if (!env.HOMEPAGE_CACHE) return null;

  const html = await env.HOMEPAGE_CACHE.get(KV_KEY, { type: 'text' });
  if (!html) return null;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      'X-SSR': 'kv-prerender'
    }
  });
}

/**
 * Build and store the pre-rendered homepage in KV.
 * Called by the cron trigger every 5 minutes.
 */
export async function refreshHomepageCache(env) {
  if (!env.HOMEPAGE_CACHE) {
    console.log('[ssr] HOMEPAGE_CACHE KV not bound, skipping');
    return;
  }

  const projectId = env.FIREBASE_PROJECT_ID;

  // Fetch all series from Firestore
  let allSeries = [];
  try {
    const docs = await listDocs(projectId, 'series', { pageSize: 100 });
    allSeries = docs
      .map(d => normSeries(d))
      .filter(s => s.published !== false)
      .sort((a, b) => {
        const at = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bt - at;
      });
  } catch (e) {
    console.error('[ssr] Failed to fetch series:', e.message);
    return;
  }

  if (!allSeries.length) {
    console.log('[ssr] No series found, skipping cache refresh');
    return;
  }

  // Build sections
  const featured = allSeries.filter(s => s.featured);
  const hero = (featured.length ? featured : allSeries).slice(0, 3);
  const hot = allSeries.filter(s => s.hot);
  const popular = (hot.length ? hot : allSeries).slice(0, 12);
  const latest = allSeries
    .filter(s => s.latestChapter > 0)
    .sort((a, b) => {
      const at = a.latestChapterAt ? new Date(a.latestChapterAt).getTime() : 0;
      const bt = b.latestChapterAt ? new Date(b.latestChapterAt).getTime() : 0;
      return bt - at;
    })
    .slice(0, 12);

  const baseUrl = env.PUBLIC_BASE_URL || 'https://jayascans.online';

  // Build the pre-rendered content
  const ssrContent = buildHomepageHtml(hero, popular, latest, baseUrl);

  // Build a complete HTML page using the minimal shell (avoids ASSETS dependency in cron)
  const template = buildMinimalShell();

  // Inject pre-rendered content
  let injected = template.replace('PLACEHOLDER', ssrContent);

  // Inject LCP preload for the hero image
  if (hero[0]?.cover) {
    const preloadTag = `<link rel="preload" as="image" href="${esc(proxyImg(hero[0].cover))}" fetchpriority="high">`;
    injected = injected.replace('</head>', `  ${preloadTag}\n</head>`);
  }

  // Store in KV with 10-minute expiry (cron refreshes every 5 min)
  await env.HOMEPAGE_CACHE.put(KV_KEY, injected, { expirationTtl: 600 });
  console.log(`[ssr] Homepage cache refreshed (${allSeries.length} series, ${(injected.length / 1024).toFixed(1)}KB)`);
}

// =====================================================
// HTML BUILDERS — minimal, fast, no framework
// =====================================================

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function proxyImg(url) {
  if (!url) return '/assets/images/icon.svg';
  return url;
}

function buildHomepageHtml(hero, popular, latest, baseUrl) {
  const heroSlide = hero[0];
  if (!heroSlide) return '<div class="container section"><p>Loading...</p></div>';

  return `
    <!-- SSR Hero (first slide only for fast LCP) -->
    <section class="hero" id="hero" style="height:60vh;min-height:500px;max-height:700px;position:relative;overflow:hidden;background:var(--bg);">
      <div class="hero-slide active" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;top:-20%;right:-10%;width:70vw;height:140%;background-image:url('${esc(proxyImg(heroSlide.cover))}');background-size:cover;background-position:center;filter:blur(60px);opacity:0.3;mask-image:radial-gradient(ellipse at center,black 0%,transparent 70%);-webkit-mask-image:radial-gradient(ellipse at center,black 0%,transparent 70%);z-index:1;"></div>
        <div style="position:absolute;inset:0;background:linear-gradient(to right,var(--bg) 10%,rgba(10,10,12,0.8) 50%,transparent 100%);z-index:2;pointer-events:none;"></div>
        <div class="hero-content" style="position:relative;z-index:3;display:flex;flex-direction:row;align-items:center;justify-content:center;height:100%;width:100%;padding:40px 5%;max-width:1400px;margin:0 auto;gap:clamp(40px,8vw,120px);">
          <div class="hero-info" style="flex:1;max-width:650px;display:flex;flex-direction:column;gap:20px;">
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
              <span style="background:var(--accent);color:#fff;padding:4px 12px;border-radius:4px;font-weight:800;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Top Pick</span>
              ${heroSlide.latestChapter ? `<span style="color:#aaa;font-weight:600;font-size:14px;">CHAPTER ${esc(heroSlide.latestChapter)}</span>` : ''}
            </div>
            <h2 style="font-family:var(--font-display);font-size:clamp(2.5rem,5vw,4.5rem);font-weight:900;line-height:1.05;color:#fff;margin:0;text-transform:uppercase;letter-spacing:-1px;text-shadow:0 4px 12px rgba(0,0,0,0.5);">${esc(heroSlide.title)}</h2>
            <div style="display:flex;gap:16px;margin-top:10px;flex-wrap:wrap;">
              <a href="/series/${encodeURIComponent(heroSlide.slug)}" class="btn btn-primary" style="padding:14px 36px;font-size:16px;font-weight:800;border-radius:6px;display:flex;align-items:center;gap:10px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                READ NOW
              </a>
              <a href="/series/${encodeURIComponent(heroSlide.slug)}" class="btn" style="padding:14px 28px;font-size:16px;font-weight:600;border-radius:6px;background:rgba(255,255,255,0.1);color:#fff;backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);">Details</a>
            </div>
          </div>
          <div class="hero-poster" style="flex-shrink:0;display:flex;justify-content:flex-end;align-items:center;">
            <a href="/series/${encodeURIComponent(heroSlide.slug)}" style="display:block;width:clamp(220px,28vw,380px);aspect-ratio:2/3;border-radius:12px;overflow:hidden;box-shadow:-20px 20px 60px rgba(0,0,0,0.8),0 0 0 1px rgba(255,255,255,0.1);">
              <img src="${esc(proxyImg(heroSlide.cover))}" alt="${esc(heroSlide.title)}" style="width:100%;height:100%;object-fit:cover;" fetchpriority="high" loading="eager" width="320" height="480">
            </a>
          </div>
        </div>
      </div>
      <style>
        @media(max-width:768px){
          #hero{height:65vh!important;min-height:480px!important;}
          #hero .hero-content{flex-direction:column-reverse!important;justify-content:center!important;gap:20px!important;padding:0 5% 40px 5%!important;}
          #hero .hero-poster{width:100%!important;justify-content:center!important;}
          #hero .hero-poster>a{height:220px!important;width:146px!important;}
          #hero .hero-info{align-items:center;text-align:center;}
          #hero .hero-info h2{font-size:clamp(1.8rem,8vw,2.5rem)!important;line-height:1.1!important;}
          .hero-slide>div:nth-child(1){width:100%!important;right:0!important;opacity:0.4!important;}
          .hero-slide>div:nth-child(2){background:linear-gradient(to top,var(--bg) 0%,rgba(10,10,12,0.95) 55%,transparent 100%)!important;}
        }
      </style>
    </section>

    <!-- SSR Latest Updates -->
    <section class="section cv-deferred" id="latest">
      <div class="container">
        <div class="section-header"><h2 class="section-title">Latest Updates</h2><a href="/browse" class="section-link">View All</a></div>
        <div class="update-list">
          ${latest.map(s => `
            <div class="update-item">
              <a href="/series/${encodeURIComponent(s.slug)}">
                <img src="${esc(proxyImg(s.cover))}" alt="${esc(s.title)}" class="update-thumb" loading="lazy" decoding="async" width="56" height="84">
              </a>
              <div class="update-meta">
                <a href="/series/${encodeURIComponent(s.slug)}" class="update-title">${esc(s.title)}</a>
                <div class="update-chapters">
                  <a href="/read/${encodeURIComponent(s.slug)}/${s.latestChapter}" class="update-ch-link">
                    <span><strong>Ch. ${esc(s.latestChapter)}</strong></span>
                  </a>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- SSR Popular -->
    <section class="section cv-deferred" id="popular">
      <div class="container">
        <div class="section-header"><h2 class="section-title">Popular</h2><a href="/browse" class="section-link">View All</a></div>
        <div class="card-grid">
          ${popular.map((s, i) => `
            <a href="/series/${encodeURIComponent(s.slug)}" class="card">
              <div class="card-img-wrap">
                <img src="${esc(proxyImg(s.cover))}" alt="${esc(s.title)}" class="card-img" ${i < 4 ? 'loading="eager"' : 'loading="lazy"'} decoding="async" width="200" height="300">
                ${s.hot ? '<div class="card-badge card-badge-right"><span class="badge badge-hot">HOT</span></div>' : ''}
                ${s.latestChapter > 0 ? `<div class="card-chapter">Ch. ${esc(s.latestChapter)}</div>` : ''}
              </div>
              <div class="card-info">
                <div class="card-title">${esc(s.title)}</div>
                <div class="card-meta"><span>${esc((s.type || 'Manhwa').replace(/^./, c => c.toUpperCase()))}</span></div>
              </div>
            </a>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- Client JS will hydrate and add remaining sections (genres, articles, continue reading) -->
  `;
}

// Minimal normalizer for server-side use
function normSeries(d) {
  if (!d) return null;
  return {
    slug: d.slug || d._id,
    title: d.title || 'Untitled',
    cover: d.cover || '',
    type: (d.type || 'manhwa').toLowerCase(),
    status: (d.status || 'ongoing').toLowerCase(),
    latestChapter: d.latestChapter || d.latestChapterNumber || 0,
    latestChapterAt: d.latestChapterAt || d.updatedAt || d.createdAt || null,
    featured: !!d.featured,
    hot: !!d.hot,
    new: !!d.new,
    published: d.published !== false,
    views: d.views || 0,
    updatedAt: d.updatedAt || null,
    createdAt: d.createdAt || null
  };
}


/** Fallback HTML shell when ASSETS binding can't serve index.html (e.g. in cron context) */
function buildMinimalShell() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#0a0a0c">
  <title>JayaScans — Read Manhwa, Manga & Manhua Online Free</title>
  <meta name="description" content="Read manhwa, manga and manhua online for free on JayaScans. Premium reader with bookmarks, library, offline reading, and the latest chapters in English.">
  <link rel="canonical" href="https://jayascans.online/">
  <meta property="og:title" content="JayaScans — Read Manhwa, Manga & Manhua Online Free">
  <meta property="og:description" content="Premium reading experience for manhwa, manga and manhua. Free forever.">
  <meta property="og:url" content="https://jayascans.online/">
  <meta property="og:image" content="https://jayascans.online/assets/images/og-default.png">
  <link rel="icon" type="image/svg+xml" href="/assets/images/favicon.svg">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://files.catbox.moe" crossorigin>
  <link rel="preconnect" href="https://s4.anilist.co" crossorigin>
  <link rel="dns-prefetch" href="https://files.catbox.moe">
  <link rel="dns-prefetch" href="https://s4.anilist.co">
  <link rel="preload" href="https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" as="style">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" media="print" onload="this.media='all'">
  <style>
    :root{--bg:#0a0a0c;--surface-1:#111114;--accent:#f0b941;--font-display:'Syne',sans-serif;--font-body:'Inter',sans-serif}
    *,*::before,*::after{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:#e4e4e7;font-family:var(--font-body);-webkit-font-smoothing:antialiased}
    .navbar{position:sticky;top:0;z-index:100;background:rgba(10,10,12,.85);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,.06);height:60px;display:flex;align-items:center}
    .nav-inner{display:flex;align-items:center;width:100%;max-width:1400px;margin:0 auto;padding:0 1.25rem;gap:1rem}
    .nav-logo{display:flex;align-items:center;gap:.5rem;font-family:var(--font-display);font-weight:800;font-size:1.25rem;color:#fff;text-decoration:none}
    .nav-logo span{color:var(--accent)}
    .container{width:100%;max-width:1400px;margin:0 auto;padding:0 1.25rem}
    .section{padding:2rem 0}
  </style>
  <link rel="stylesheet" href="/assets/css/tokens.css">
  <link rel="stylesheet" href="/assets/css/reset.css">
  <link rel="stylesheet" href="/assets/css/base.css">
  <link rel="stylesheet" href="/assets/css/components.css">
  <link rel="stylesheet" href="/assets/css/pages.css">
</head>
<body class="has-bottom-nav">
  <header class="navbar" id="topnav" role="banner">
    <div class="nav-inner">
      <a href="/" class="nav-logo" aria-label="JayaScans home">JAYA<span>SCANS</span></a>
      <nav class="nav-links" aria-label="Main navigation">
        <a href="/" class="nav-link">Home</a>
        <a href="/browse" class="nav-link">Browse</a>
        <a href="/library" class="nav-link">Library</a>
      </nav>
    </div>
  </header>
  <main id="app" role="main">PLACEHOLDER</main>
  <script type="module" src="/assets/js/app.js"></script>
  <script>if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{});});}</script>
</body>
</html>`;
}
