// =====================================================
// View: Reader — premium reader with zoom, fit modes,
// progress bar, settings drawer, keyboard nav, swipe.
// =====================================================

import { fetchChapter, fetchChapters, fetchSeriesBySlug, fetchAllSeries,
  trackChapterView, fetchChapterComments, postComment, likeComment,
  submitReport
} from '../lib/api.js';
import {
  recordRead, saveProgress, getProgress,
  getReaderPrefs, setReaderPrefs,
  hasLikedComment, markCommentLiked
} from '../lib/library.js';
import { getProfile } from '../lib/account.js';
import { esc, html, throttle, timeAgo, avatarLetter, isMobile, isTouch, proxyImage, setMeta, truncate } from '../lib/utils.js';
import { spinner, toast, drawer, share } from '../lib/ui.js';
import { SITE, pageTitle } from '../lib/site.config.js';
import { getSettings } from '../lib/settings.js';
import { applyBranding } from '../lib/branding.js';
import { navigate } from '../lib/router.js';
import { onAuthChange } from '../lib/auth.js';
import { buildRecommendations, buildLatestUpdates } from './_components.js';

export async function reader(params, ctx) {
  const slug = params.slug;
  const num  = Number(params.chapter);

  ctx.outlet.innerHTML = spinner();

  let s, ch, allChapters;
  try {
    [s, ch, allChapters] = await Promise.all([
      fetchSeriesBySlug(slug),
      fetchChapter(slug, num),
      fetchChapters(slug)
    ]);
  } catch (e) {
    ctx.outlet.innerHTML = `<div class="container section"><h2>Failed to load</h2></div>`;
    return { title: pageTitle('Reader') };
  }

  if (!s || !ch) {
    ctx.outlet.innerHTML = html`
      <div class="container section">
        <div class="empty-state">
          <div class="icon">📖</div>
          <h3>Chapter not found</h3>
          <p>This chapter doesn't exist or hasn't been published yet.</p>
          <a href="/series/${esc(slug)}" class="btn btn-primary">Back to series</a>
        </div>
      </div>
    `;
    return { title: pageTitle('Not found') };
  }

  // Sort chapters ascending for nav purposes
  const sorted = [...allChapters].sort((a, b) => a.number - b.number);
  const idx = sorted.findIndex(c => c.number === num);
  const prev = idx > 0 ? sorted[idx - 1] : null;
  const next = idx < sorted.length - 1 ? sorted[idx + 1] : null;

  // Read prefs
  const prefs = getReaderPrefs();

  // Build view
  ctx.outlet.innerHTML = renderReader(s, ch, prev, next, sorted, prefs);

  // Inject JSON-LD chapter schema for SEO
  injectChapterJsonLd(s, ch);

  // Per-route SEO meta — chapter pages are the long-tail money pages.
  setMeta({
    title: `${s.title} Chapter ${ch.number} English | ${SITE.name}`,
    description: truncate(
      `Read ${s.title} chapter ${ch.number}${ch.title ? ` (${ch.title})` : ''} in English on ${SITE.name}. ` +
      `Free, no ads on the reader, mobile-friendly with offline support.`,
      180
    ),
    image: proxyImage(ch.pages?.[0] || s.cover),
    url: location.href,
    type: 'article'
  });

  // Track chapter view (sessioned, fail-silent if rules reject)
  trackChapterView(slug, ch.number).catch(() => {});

  // Wire up
  const cleanup = wireUp(s, ch, prev, next, sorted, prefs);

  // Mark as read on entry (persistent)
  recordRead(slug, ch.number, ch.pages.length, 0);

  // Lazy-load chapter comments (don't block reader)
  loadChapterComments(s, ch);

  // Lazy-load recommendation strips at the bottom — keeps readers in
  // the catalog after they finish the chapter.
  loadReaderRecommendations(s);

  // Precache this chapter's images for offline reading
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'PRECACHE_IMAGES',
      urls: ch.pages
    });
  }

  // Apply admin-configured branding/ads to slots present in this view
  applyBranding();

  // Show Ko-fi widget if enabled in admin Settings → Monetization
  const settings = getSettings();
  if (settings?.features?.kofiEnabled && settings?.monetization?.kofi?.enabled) {
    const url = settings.monetization.kofi.url;
    if (url) {
      const wrap = document.getElementById('rSupport');
      const txt  = document.getElementById('rSupportText');
      const link = document.getElementById('rSupportLink');
      if (wrap && txt && link) {
        txt.textContent = settings.monetization.kofi.text || 'Enjoying our scans? Show some love.';
        link.href = url;
        wrap.style.display = 'block';
      }
    }
  }

  // Show "Report a problem" button if reports feature is enabled
  if (settings?.features?.reportsEnabled) {
    const row = document.getElementById('rReportRow');
    const btn = document.getElementById('rReportBtn');
    if (row && btn) {
      row.style.display = 'block';
      btn.addEventListener('click', () => openReportDialog(s, ch));
    }
  }

  // Restore progress
  getProgress(slug, ch.number).then(p => {
    if (p && p.page > 0 && p.page < ch.pages.length - 1) {
      const target = document.querySelectorAll('.manga-page')[p.page];
      target?.scrollIntoView({ behavior: 'instant', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  });

  return {
    title: `${s.title} Chapter ${num} English | ${SITE.name}`,
    cleanup
  };
}

// =====================================================
// RENDER
// =====================================================
function renderReader(s, ch, prev, next, all, prefs) {
  const fitClass = prefs.fit === 'height' ? 'fit-height' : 'fit-width';
  const gapClass = `gap-${prefs.gap}`;
  const zoomFactor = (Number(prefs.zoom) || 100) / 100;
  return html`
    <div class="reader-topbar" id="rTop">
      <div class="reader-topbar-inner">
        <a href="/series/${esc(s.slug)}" class="icon-btn" aria-label="Back to series">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </a>
        <div class="reader-info">
          <a href="/series/${esc(s.slug)}" class="reader-info-title">${esc(s.title)}</a>
          <div class="reader-info-chapter">
            Chapter ${esc(ch.number)} ${ch.title ? `· ${esc(ch.title)}` : ''}
          </div>
        </div>
        <div class="row gap-1">
          <button class="icon-btn" id="rShare" aria-label="Share">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
          <button class="icon-btn" id="rSettings" aria-label="Reader settings">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
      </div>
    </div>

    <div class="progress-bar" id="rProgress" style="width: 0%;"></div>

    <div class="reader-canvas ${fitClass} ${gapClass}" id="rCanvas" style="--mp-zoom: ${zoomFactor};">
      ${ch.pages.map((url, i) => `
        <div class="page-wrap" data-page="${i}">
          <div class="page-loader">
            <div class="page-spinner"></div>
            <span class="page-loader-text">${i < 3 ? 'Loading...' : ['Hold tight, otaku...', 'Loading your fix...', 'Patience, reader...', 'Almost there...', 'Worth the wait...', 'Loading panels...'][i % 6]}</span>
          </div>
          <img class="manga-page" ${i < 3 ? `src="${esc(proxyImage(url))}"` : `data-src="${esc(proxyImage(url))}"`} alt="Page ${i + 1}"
               loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async"
               data-page="${i}"
               onload="this.parentElement.classList.add('loaded')"
               onerror="this.onerror=null;this.parentElement.classList.add('error');this.alt='Failed to load';">
        </div>
        ${i === 4 ? '<div data-ad-slot="mid-chapter" style="display:none;"></div>' : ''}
      `).join('')}
    </div>

    <!-- Ko-fi / support bar (toggled in admin Settings → Monetization)
         Horizontal pill: [logo] [text line] [Support →] -->
    <div id="rSupport" class="kofi-bar" style="display: none;">
      <span class="kofi-bar-logo" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
          <line x1="6" y1="1" x2="6" y2="4"/>
          <line x1="10" y1="1" x2="10" y2="4"/>
          <line x1="14" y1="1" x2="14" y2="4"/>
        </svg>
      </span>
      <p class="kofi-bar-text" id="rSupportText"></p>
      <a id="rSupportLink" class="kofi-bar-btn" target="_blank" rel="noopener">
        Support
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 4px;"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </a>
    </div>

    <!-- User report button -->
    <div id="rReportRow" style="text-align: center; margin: var(--s-4) auto var(--s-6); display: none;">
      <button class="report-trigger" id="rReportBtn" type="button">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
        Report a problem with this chapter
      </button>
    </div>

    <div class="reader-bottombar">
      ${prev
        ? `<a href="/read/${esc(s.slug)}/${prev.number}" class="btn btn-outline">← Ch.${prev.number}</a>`
        : `<button class="btn btn-outline" disabled>← Prev</button>`}
      <select class="reader-chapter-select" id="rChapterSelect" aria-label="Jump to chapter">
        ${[...all].reverse().map(c => `<option value="${c.number}" ${c.number === ch.number ? 'selected' : ''}>Ch. ${c.number}${c.title ? ` — ${esc(c.title)}` : ''}</option>`).join('')}
      </select>
      ${next
        ? `<a href="/read/${esc(s.slug)}/${next.number}" class="btn btn-primary">Ch.${next.number} →</a>`
        : `<a href="/series/${esc(s.slug)}" class="btn btn-primary">All Done · Series</a>`}
    </div>

    <!-- Per-chapter comments -->
    <section class="container section" id="chapterCommentsSection" style="max-width: 800px;">
      <div class="section-header" style="margin-bottom: var(--s-4);">
        <h2 class="section-title">Chapter Comments</h2>
        <span class="results-count" id="chCommentCount"></span>
      </div>
      <div id="chCommentForm">
        <div class="field-row">
          <input type="text" class="input" id="chcName" placeholder="Your name (optional)" maxlength="40">
          <div></div>
        </div>
        <textarea class="textarea" id="chcText" placeholder="What did you think of this chapter? (2–1000 chars)" maxlength="1000"></textarea>
        <div class="row gap-3" style="margin-top: var(--s-2); align-items: center;">
          <span class="field-hint" id="chcCounter">0 / 1000</span>
          <span class="nav-spacer"></span>
          <button class="btn btn-primary" id="chcSubmit">Post Comment</button>
        </div>
      </div>
      <div class="comments-list" id="chCommentList" style="margin-top: var(--s-5);">${spinner('sm')}</div>
    </section>

    <!-- Discovery strips at the end of the chapter — keeps readers in
         the catalog instead of bouncing after the last page. -->
    <section class="container section cv-deferred" style="max-width: 800px; padding: 0 var(--s-4);" id="readerRecsSection" hidden>
      <div class="section-header">
        <h2 class="section-title" style="font-size: var(--fs-lg);" id="readerRecsTitle">You might also like</h2>
        <a href="/series/${esc(s.slug)}" class="section-link">All chapters →</a>
      </div>
      <div class="card-grid reader-recs-grid" id="readerRecsGrid"></div>
    </section>

    <section class="container section cv-deferred" style="max-width: 800px; padding: 0 var(--s-4);" id="readerLatestSection" hidden>
      <div class="section-header">
        <h2 class="section-title" style="font-size: var(--fs-lg);">Latest Updates</h2>
        <a href="/browse?sort=updated" class="section-link">View all →</a>
      </div>
      <div class="update-list" id="readerLatestList"></div>
    </section>
  `;
}

// =====================================================
// WIRE-UP
// =====================================================
function wireUp(s, ch, prev, next, all, prefs) {
  const cleanups = [];

  // Progress bar (scroll)
  const progress = document.getElementById('rProgress');
  let raf = null;
  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      const h = document.documentElement;
      const pct = Math.min(100, (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) * 100);
      progress.style.width = pct + '%';
      raf = null;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  cleanups.push(() => window.removeEventListener('scroll', onScroll));

  // Auto-hide topbar on scroll down, show on scroll up
  const top = document.getElementById('rTop');
  let lastY = window.scrollY;
  function onScrollHide() {
    const y = window.scrollY;
    if (y < 100) { top.classList.remove('hidden'); }
    else if (y > lastY + 8) top.classList.add('hidden');
    else if (y < lastY - 8) top.classList.remove('hidden');
    lastY = y;
  }
  const onScrollHideT = throttle(onScrollHide, 80);
  window.addEventListener('scroll', onScrollHideT, { passive: true });
  cleanups.push(() => window.removeEventListener('scroll', onScrollHideT));

  // Save reading position (debounced via throttle)
  let lastVisibleIdx = 0;
  const observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        const i = Number(e.target.dataset.page);
        if (i > lastVisibleIdx) lastVisibleIdx = i;
      }
    }
    saveProgress(s.slug, ch.number, lastVisibleIdx, ch.pages.length);
  }, { threshold: 0.5 });
  document.querySelectorAll('.page-wrap').forEach(el => observer.observe(el));
  cleanups.push(() => observer.disconnect());

  // Sequential image loading — load images one by one as user scrolls near them.
  // First 3 are already loaded (have src). The rest get src set when they're
  // within 2 screens of the viewport (loads ahead smoothly).
  const lazyImages = document.querySelectorAll('.manga-page[data-src]');
  if (lazyImages.length > 0) {
    const loadObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            delete img.dataset.src;
            img.removeAttribute('data-src');
          }
          loadObserver.unobserve(img);
        }
      }
    }, { rootMargin: '250% 0px' }); // Start loading when within 2.5 screens (aggressive preload)
    lazyImages.forEach(img => loadObserver.observe(img));
    cleanups.push(() => loadObserver.disconnect());
  }

  // Tap top half / bottom half to scroll on mobile (optional UX)
  // We rely on natural scroll, no tap-zones to avoid surprise.

  // Keyboard nav
  function onKey(e) {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (e.key === 'ArrowLeft' || e.key === 'a') {
      if (prev) navigate(`/read/${encodeURIComponent(s.slug)}/${prev.number}`);
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === ' ') {
      if (next) { e.preventDefault(); navigate(`/read/${encodeURIComponent(s.slug)}/${next.number}`); }
    } else if (e.key === 'Home') { window.scrollTo({ top: 0 }); }
    else if (e.key === 'End') { window.scrollTo({ top: document.body.scrollHeight }); }
  }
  document.addEventListener('keydown', onKey);
  cleanups.push(() => document.removeEventListener('keydown', onKey));

  // Touch swipe (left = next, right = prev) — only single-finger horizontal swipe
  // Multi-finger gestures (pinch-zoom) are handled separately below.
  if (isTouch()) {
    let sx = 0, sy = 0, swiping = false;
    function ts(e) {
      // Only track single-finger touches for swipe navigation
      if (e.touches.length !== 1) { swiping = false; return; }
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; swiping = true;
    }
    function te(e) {
      if (!swiping) return; swiping = false;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 80 && Math.abs(dy) < 60) {
        if (dx < 0 && next) navigate(`/read/${encodeURIComponent(s.slug)}/${next.number}`);
        if (dx > 0 && prev) navigate(`/read/${encodeURIComponent(s.slug)}/${prev.number}`);
      }
    }
    function tm(e) {
      // Cancel swipe if user adds a second finger (pinch)
      if (e.touches.length > 1) swiping = false;
    }
    document.addEventListener('touchstart', ts, { passive: true });
    document.addEventListener('touchmove', tm, { passive: true });
    document.addEventListener('touchend', te, { passive: true });
    cleanups.push(() => {
      document.removeEventListener('touchstart', ts);
      document.removeEventListener('touchmove', tm);
      document.removeEventListener('touchend', te);
    });

  }

  // Chapter dropdown
  document.getElementById('rChapterSelect')?.addEventListener('change', (e) => {
    navigate(`/read/${encodeURIComponent(s.slug)}/${e.target.value}`);
  });

  // Share
  document.getElementById('rShare')?.addEventListener('click', () => {
    share({
      title: `${s.title} — Ch.${ch.number}`,
      text: `Reading ${s.title} chapter ${ch.number} on ${SITE.name}`,
      url: location.href
    });
  });

  // Settings drawer
  document.getElementById('rSettings')?.addEventListener('click', () => openSettingsDrawer(prefs));

  return () => cleanups.forEach(fn => { try { fn(); } catch {} });
}

// =====================================================
// SETTINGS DRAWER
// =====================================================
function openSettingsDrawer(prefs) {
  const cur = getReaderPrefs();
  const dw = drawer(html`
    <h3 style="margin-bottom: var(--s-3);">Reader Settings</h3>

    <div class="field">
      <label class="field-label">Image Fit</label>
      <div class="row gap-2" id="rFit">
        ${['width', 'height'].map(v => `<button class="tag-pill ${cur.fit === v ? 'active' : ''}" data-v="${v}">${v === 'width' ? 'Fit width' : 'Fit height'}</button>`).join('')}
      </div>
    </div>

    <div class="field" id="zoomField">
      <label class="field-label">Zoom · <span id="zoomVal">${cur.zoom || 100}%</span></label>
      <div class="row gap-2" style="align-items: center;">
        <button class="btn btn-outline btn-icon" id="zoomOut" aria-label="Zoom out" type="button">−</button>
        <input type="range" id="zoomRange" min="40" max="200" step="10" value="${cur.zoom || 100}" style="flex: 1; accent-color: var(--accent);">
        <button class="btn btn-outline btn-icon" id="zoomIn" aria-label="Zoom in" type="button">+</button>
      </div>
      <div class="row gap-2" style="margin-top: var(--s-2); flex-wrap: wrap;">
        ${[50, 75, 100, 125, 150].map(v => `<button class="tag-pill" data-zoom="${v}">${v}%</button>`).join('')}
        <button class="tag-pill" data-zoom="100" id="zoomResetPill">Reset</button>
      </div>
      <span class="field-hint" style="margin-top: var(--s-2);">Works both ways — drag left to zoom out, right to zoom in. Only applies in Fit width.</span>
    </div>

    <div class="field">
      <label class="field-label">Page Gap</label>
      <div class="row gap-2" id="rGap">
        ${['small', 'medium', 'large'].map(v => `<button class="tag-pill ${cur.gap === v ? 'active' : ''}" data-v="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}
      </div>
    </div>

    <div class="field-hint" style="margin-top: var(--s-3);">
      Tip: ←/→ keys to switch chapters. Swipe horizontally on mobile.
    </div>

    <button class="btn btn-primary btn-block" data-drawer-close style="margin-top: var(--s-4);">Done</button>
  `);

  const canvas = () => document.getElementById('rCanvas');
  const range = dw.el.querySelector('#zoomRange');
  const zoomVal = dw.el.querySelector('#zoomVal');
  const zoomField = dw.el.querySelector('#zoomField');

  function setFit(fit) {
    setReaderPrefs({ fit });
    const c = canvas();
    c.classList.toggle('fit-height', fit === 'height');
    c.classList.toggle('fit-width', fit !== 'height');
    dw.el.querySelectorAll('#rFit .tag-pill').forEach(x => x.classList.toggle('active', x.dataset.v === fit));
    // Zoom only matters in fit-width
    zoomField.style.opacity = fit === 'height' ? '0.4' : '1';
    zoomField.style.pointerEvents = fit === 'height' ? 'none' : '';
  }

  function applyZoom(z) {
    z = Math.max(40, Math.min(200, Math.round(z / 10) * 10));
    setReaderPrefs({ zoom: z, fit: 'width' });
    const c = canvas();
    c.classList.remove('fit-height');
    c.classList.add('fit-width');
    c.style.setProperty('--mp-zoom', z / 100);
    range.value = z;
    zoomVal.textContent = z + '%';
    dw.el.querySelectorAll('#rFit .tag-pill').forEach(x => x.classList.toggle('active', x.dataset.v === 'width'));
    zoomField.style.opacity = '1';
    zoomField.style.pointerEvents = '';
  }

  // Fit
  dw.el.querySelector('#rFit').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    setFit(b.dataset.v);
  });

  // Zoom: slider, steppers, presets
  range.addEventListener('input', () => applyZoom(Number(range.value)));
  dw.el.querySelector('#zoomOut').addEventListener('click', () => applyZoom(Number(range.value) - 10));
  dw.el.querySelector('#zoomIn').addEventListener('click', () => applyZoom(Number(range.value) + 10));
  dw.el.querySelectorAll('[data-zoom]').forEach(b =>
    b.addEventListener('click', () => applyZoom(Number(b.dataset.zoom))));

  // Gap
  dw.el.querySelector('#rGap').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    setReaderPrefs({ gap: b.dataset.v });
    const c = canvas();
    c.classList.remove('gap-small', 'gap-medium', 'gap-large');
    c.classList.add(`gap-${b.dataset.v}`);
    dw.el.querySelectorAll('#rGap .tag-pill').forEach(x => x.classList.toggle('active', x.dataset.v === b.dataset.v));
  });

  // Init disabled state if fit-height
  if (cur.fit === 'height') { zoomField.style.opacity = '0.4'; zoomField.style.pointerEvents = 'none'; }
}


// =====================================================
// JSON-LD CHAPTER SCHEMA (SEO)
// Adds Schema.org BlogPosting / Chapter entity so search engines
// understand chapter pages as discrete content.
// =====================================================
function injectChapterJsonLd(s, ch) {
  document.querySelectorAll('script[data-vs-jsonld]').forEach(el => el.remove());
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Chapter',
    name: `${s.title} — Chapter ${ch.number}${ch.title ? `: ${ch.title}` : ''}`,
    isPartOf: { '@type': 'Book', name: s.title, image: s.cover },
    position: ch.number,
    image: ch.pages?.[0],
    inLanguage: 'en',
    url: location.href,
    datePublished: ch.createdAt?.toDate
      ? ch.createdAt.toDate().toISOString()
      : (ch.createdAt?.seconds ? new Date(ch.createdAt.seconds * 1000).toISOString() : undefined)
  };
  Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.dataset.vsJsonld = '1';
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

// =====================================================
// PER-CHAPTER COMMENTS
// Stored under /series/{slug}/comments with chapter field.
// =====================================================
async function loadChapterComments(s, ch) {
  const list = document.getElementById('chCommentList');
  if (!list) return;

  let items = [];
  try {
    items = await fetchChapterComments(s.slug, ch.number, 30);
  } catch (e) {
    list.innerHTML = `<p class="text-muted" style="text-align:center;">Couldn't load comments.</p>`;
    return;
  }

  // Pre-fill name from profile
  const profile = getProfile();
  const nameInput = document.getElementById('chcName');
  if (profile?.displayName && nameInput && !nameInput.value) {
    nameInput.value = profile.displayName;
  }

  // Counter
  const txt = document.getElementById('chcText');
  const counter = document.getElementById('chcCounter');
  txt?.addEventListener('input', () => {
    counter.textContent = `${txt.value.length} / 1000`;
  });

  // Submit
  document.getElementById('chcSubmit')?.addEventListener('click', async () => {
    const name = nameInput?.value.trim() || 'Anonymous';
    const text = txt.value.trim();
    const last = Number(localStorage.getItem('vs:lastComment') || 0);
    if (Date.now() - last < 60_000) { toast('Please wait a minute before commenting again', 'error'); return; }
    if (text.length < 2) { toast('Comment too short', 'error'); return; }
    try {
      await postComment(s.slug, { authorName: name, text, chapter: Number(ch.number) });
      localStorage.setItem('vs:lastComment', String(Date.now()));
      txt.value = ''; counter.textContent = '0 / 1000';
      toast('Posted!', 'success');
      const fresh = await fetchChapterComments(s.slug, ch.number, 30);
      paintChapterComments(s, fresh);
    } catch (e) {
      console.error(e);
      toast(e.message || 'Could not post', 'error');
    }
  });

  paintChapterComments(s, items);
}

function paintChapterComments(s, items) {
  const list = document.getElementById('chCommentList');
  const counter = document.getElementById('chCommentCount');
  if (!list) return;
  if (counter) counter.innerHTML = `<strong>${items.length}</strong> comment${items.length === 1 ? '' : 's'}`;
  if (!items.length) {
    list.innerHTML = `<p class="text-muted" style="text-align:center;padding:var(--s-5);">Be the first to comment on this chapter!</p>`;
    return;
  }
  list.innerHTML = items.map(c => {
    const ts = c.createdAt?.toDate ? timeAgo(c.createdAt.toDate()) : '';
    const liked = hasLikedComment(c.id);
    return `
      <article class="comment">
        <div class="comment-avatar" aria-hidden="true">${esc(avatarLetter(c.authorName))}</div>
        <div class="comment-body">
          <div class="comment-head">
            <span class="comment-name">${esc(c.authorName || 'Anonymous')}</span>
            <span class="comment-time">${esc(ts)}</span>
          </div>
          <div class="comment-text">${esc(c.text)}</div>
          <div class="comment-actions">
            <button class="comment-action ${liked ? 'active' : ''}" data-like="${esc(c.id)}">
              👍 <span>${esc(c.likes || 0)}</span>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');
  list.querySelectorAll('[data-like]').forEach(b => {
    b.addEventListener('click', async () => {
      const id = b.dataset.like;
      if (hasLikedComment(id)) { toast('Already liked', 'info'); return; }
      try {
        await likeComment(s.slug, id);
        markCommentLiked(id);
        const span = b.querySelector('span');
        span.textContent = String(Number(span.textContent) + 1);
        b.classList.add('active');
      } catch {
        toast('Could not like', 'error');
      }
    });
  });
}



// =====================================================
// REPORT DIALOG — user-submitted issue report on chapter
// =====================================================
function openReportDialog(s, ch) {
  // Lightweight modal — we don't have a generic openModal helper, so build inline
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 200;
    background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
    display: grid; place-items: center; padding: var(--s-4);
  `;
  overlay.innerHTML = `
    <div style="background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--r-lg); padding: var(--s-6); width: 100%; max-width: 480px;">
      <h3 style="margin: 0 0 var(--s-4); font-family: var(--font-display); font-weight: 700;">Report a problem</h3>
      <p style="font-size: var(--fs-sm); color: var(--text-muted); margin-bottom: var(--s-4);">Thanks for helping us improve. We'll review every report.</p>

      <div class="field" style="margin-bottom: var(--s-3);">
        <label class="field-label">What's wrong?</label>
        <select id="repReason" class="field-input">
          <option value="broken_image">Broken / missing image</option>
          <option value="wrong_chapter">Wrong chapter or order</option>
          <option value="bad_translation">Bad / unreadable translation</option>
          <option value="spam_comment">Spam in comments</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div class="field" style="margin-bottom: var(--s-3);">
        <label class="field-label">Details (optional)</label>
        <textarea id="repDetails" class="field-input" rows="3" maxlength="1000" placeholder="e.g. page 5 doesn't load, or page 12 looks like it's from another chapter"></textarea>
      </div>

      <div class="field" style="margin-bottom: var(--s-4);">
        <label class="field-label">Your email (optional, so we can reply)</label>
        <input type="email" id="repEmail" class="field-input" placeholder="you@example.com">
      </div>

      <div style="display: flex; gap: var(--s-3); justify-content: flex-end;">
        <button class="btn btn-ghost" id="repCancel" type="button">Cancel</button>
        <button class="btn btn-primary" id="repSubmit" type="button">Submit Report</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('#repCancel').addEventListener('click', close);

  overlay.querySelector('#repSubmit').addEventListener('click', async () => {
    const btn = overlay.querySelector('#repSubmit');
    btn.disabled = true;
    btn.textContent = 'Submitting…';
    try {
      const profile = getProfile();
      await submitReport({
        seriesSlug: s.slug,
        chapter: ch.number,
        reason: overlay.querySelector('#repReason').value,
        details: overlay.querySelector('#repDetails').value,
        authorName: profile?.displayName || '',
        authorEmail: overlay.querySelector('#repEmail').value
      });
      toast('Report sent. Thank you!', 'success');
      close();
    } catch (e) {
      console.error(e);
      toast(`Could not send: ${e.message}`, 'error');
      btn.disabled = false;
      btn.textContent = 'Submit Report';
    }
  });
}



// =====================================================
// READER RECOMMENDATIONS — "You might also like" + "Latest Updates"
// rendered after comments. Best-effort: failures fail silently so they
// never block the reader experience.
// =====================================================
async function loadReaderRecommendations(currentSeries) {
  let allSeries = [];
  try {
    allSeries = await fetchAllSeries({ limitTo: 200 });
  } catch (e) {
    console.debug('loadReaderRecommendations: fetchAllSeries failed', e?.message);
    return;
  }
  if (!allSeries.length) return;

  // 1) "You might also like" / "More {Type}" / "Popular Series"
  const recs = buildRecommendations(currentSeries, allSeries, { limit: 6 });
  if (recs.cards.length) {
    const sec = document.getElementById('readerRecsSection');
    const titleEl = document.getElementById('readerRecsTitle');
    const grid = document.getElementById('readerRecsGrid');
    if (sec && grid) {
      if (titleEl) titleEl.textContent = recs.titleText;
      grid.innerHTML = recs.cards.join('');
      sec.hidden = false;
    }
  }

  // 2) "Latest Updates" — global discovery
  const updates = buildLatestUpdates(currentSeries.slug, allSeries, { limit: 6 });
  if (updates.length) {
    const sec = document.getElementById('readerLatestSection');
    const list = document.getElementById('readerLatestList');
    if (sec && list) {
      list.innerHTML = updates.join('');
      sec.hidden = false;
    }
  }
}
