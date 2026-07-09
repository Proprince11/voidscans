// =====================================================
// View: Home — hero slider, latest updates carousel, popular, new
// Updated: 2025 redesign — carousel, genre grid, articles
// =====================================================

import { fetchHomeSections, fetchArticles } from '../lib/api.js';
import { getHistory } from '../lib/library.js';
import { esc, html, proxyImage, setMeta } from '../lib/utils.js';
import { skeletonGrid } from '../lib/ui.js';
import { seriesCard, updateCard, rankItem, genreGrid, articleCard, emptyState, statusBadge } from './_components.js';
import { SITE, pageTitle } from '../lib/site.config.js';

export async function home(_params, ctx) {
  // Initial frame: skeleton
  ctx.outlet.innerHTML = html`
    <section class="hero" style="background: var(--surface-1);">
      <div class="hero-content">
        <div class="skel" style="aspect-ratio:2/3; width:160px; border-radius:var(--r-md);"></div>
        <div class="stack gap-3">
          <div class="skel skel-line long" style="height:32px;"></div>
          <div class="skel skel-line short"></div>
          <div class="skel skel-line long"></div>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div class="section-header"><h2 class="section-title">Latest Updates</h2></div>
        <div style="display:flex; gap:var(--s-3); overflow:hidden;">
          ${[0,0,0,0,0].map(() => `<div class="skel" style="width:120px;aspect-ratio:2/3;border-radius:var(--r-md);flex-shrink:0;"></div>`).join('')}
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div class="section-header"><h2 class="section-title">Popular</h2></div>
        ${skeletonGrid(8)}
      </div>
    </section>
  `;

  let sections;
  try {
    sections = await fetchHomeSections();
  } catch (e) {
    console.error(e);
    ctx.outlet.innerHTML = html`
      <div class="container section">
        <div class="empty-state">
          <div class="icon">📡</div>
          <h3>Couldn't load content</h3>
          <p style="color: var(--text-muted); max-width: 36ch;">Check your internet connection and try again.</p>
          <div style="display: flex; gap: var(--s-3); justify-content: center; margin-top: var(--s-4);">
            <button class="btn btn-primary" onclick="location.reload()">Retry</button>
          </div>
        </div>
      </div>
    `;
    return { title: pageTitle() };
  }

  const { hero: heroItems, popular, newlyAdded, latest, topSeries, all } = sections;

  // Continue Reading strip
  let continueReading = [];
  try {
    const history = await getHistory({ limit: 30 });
    const seen = new Set();
    const seriesBySlug = new Map(all.map(s => [s.slug, s]));
    for (const h of history) {
      if (seen.has(h.seriesId)) continue;
      const meta = seriesBySlug.get(h.seriesId);
      if (!meta) continue;
      seen.add(h.seriesId);
      continueReading.push({ ...meta, lastReadChapter: h.chapter, readAt: h.readAt });
      if (continueReading.length >= 6) break;
    }
  } catch (e) { /* ignore */ }

  // Latest Articles for homepage section (featured first, max 3)
  let latestArticles = [];
  try {
    const allArticles = await fetchArticles({ limitTo: 10 });
    const featured = allArticles.filter(a => a.featured);
    const nonFeatured = allArticles.filter(a => !a.featured);
    latestArticles = [...featured, ...nonFeatured].slice(0, 3);
  } catch (e) { /* ignore — section just won't render */ }

  // Build hero slider
  const heroHtml = heroItems.length === 0 ? '' : html`
    <section class="hero" id="hero">
      ${heroItems.map((s, i) => `
        <div class="hero-slide ${i === 0 ? 'active' : ''}" data-idx="${i}">
          <div class="hero-bg" style="background-image: url('${esc(proxyImage(s.cover))}');"></div>
          <div class="hero-content">
            <div class="hero-cover">
              <a href="/series/${encodeURIComponent(s.slug)}" aria-label="View ${esc(s.title)}" tabindex="-1">
                <img src="${esc(proxyImage(s.cover))}" alt="${esc(s.title)}" loading="eager" decoding="async" fetchpriority="${i === 0 ? 'high' : 'auto'}">
              </a>
            </div>
            <div class="hero-meta">
              <div class="badges">
                ${statusBadge(s.status)}
                ${s.hot ? `<span class="badge badge-hot">HOT</span>` : ''}
                ${s.new ? `<span class="badge badge-new">NEW</span>` : ''}
              </div>
              <h1 class="hero-title"><a href="/series/${encodeURIComponent(s.slug)}" style="color:inherit;text-decoration:none;">${esc(s.title)}</a></h1>
              <div class="hero-genres">
                ${(s.genres || []).slice(0, 4).map(g => `<span class="tag-pill">${esc(g)}</span>`).join('')}
              </div>
              <p class="hero-desc">${esc(s.description || '')}</p>
              <div class="hero-actions">
                <a href="/series/${encodeURIComponent(s.slug)}" class="btn btn-primary">View Details</a>
                ${s.latestChapter > 0
                  ? `<a href="/read/${encodeURIComponent(s.slug)}/${s.latestChapter}" class="btn btn-outline">Read Latest · Ch.${s.latestChapter}</a>`
                  : ''}
              </div>
            </div>
          </div>
        </div>
      `).join('')}
      <button class="hero-arrow prev" aria-label="Previous slide">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <button class="hero-arrow next" aria-label="Next slide">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      <div class="hero-dots">
        ${heroItems.map((_, i) => `<button class="hero-dot ${i === 0 ? 'active' : ''}" data-idx="${i}" aria-label="Slide ${i + 1}"></button>`).join('')}
      </div>
    </section>
  `;

  // Build the rest
  ctx.outlet.innerHTML = html`
    ${heroHtml}

    ${continueReading.length > 0 ? html`
    <section class="section cv-deferred" id="continue-reading">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Continue Reading</h2>
          <a href="/library?tab=history" class="section-link">View history →</a>
        </div>
        <div class="card-grid">
          ${continueReading.map(s => `
            <a href="/read/${esc(s.slug)}/${esc(s.lastReadChapter)}" class="card" aria-label="Continue ${esc(s.title)}">
              <div class="card-img-wrap">
                <img src="${esc(proxyImage(s.cover) || '/assets/images/placeholder.png')}" alt="${esc(s.title)}" class="card-img" loading="lazy" decoding="async"
                     onerror="this.style.background='var(--surface-3)';this.removeAttribute('src');">
                <div class="card-chapter">Continue · Ch. ${esc(s.lastReadChapter)}</div>
              </div>
              <div class="card-info">
                <div class="card-title">${esc(s.title)}</div>
                <div class="card-meta"><span style="color: var(--accent);">▶ Resume</span></div>
              </div>
            </a>
          `).join('')}
        </div>
      </div>
    </section>
    ` : ''}

    <section class="section cv-deferred" id="latest">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Latest Updates</h2>
          <a href="/browse?sort=updated" class="section-link">View all →</a>
        </div>
        ${latest.length === 0
          ? emptyState({ icon: '📚', title: 'No updates yet', subtitle: 'Add your first series in the admin panel.' })
          : `<div class="updates-carousel-wrap" id="updates-carousel-wrap">
              <div class="updates-carousel" id="updates-carousel" role="list">
                ${latest.map(s => updateCard(s)).join('')}
              </div>
            </div>
            <div class="updates-carousel-dots" id="updates-carousel-dots"></div>`}
      </div>
    </section>

    ${topSeries.length > 0 ? html`
    <section class="section cv-deferred" id="top-series">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Top Series</h2>
          <a href="/browse?sort=popular" class="section-link">View all →</a>
        </div>
        <div class="rank-list">
          ${topSeries.map((s, i) => rankItem(s, i + 1)).join('')}
        </div>
      </div>
    </section>
    ` : ''}

    ${newlyAdded.length >= 4 ? html`
    <section class="section cv-deferred">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">New Arrivals</h2>
          <a href="/browse?sort=new" class="section-link">View all →</a>
        </div>
        <div class="card-grid">${newlyAdded.slice(0, 12).map((s, i) => seriesCard(s, { eager: i < 6 })).join('')}</div>
      </div>
    </section>
    ` : ''}

    <section class="section cv-deferred">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Popular Now</h2>
          <a href="/browse?sort=popular" class="section-link">View all →</a>
        </div>
        ${popular.length < 4
          ? emptyState({ icon: '⭐', title: 'No series yet', cta: '<a href="/admin" class="btn btn-primary">Open Admin</a>' })
          : `<div class="card-grid">${popular.slice(0, 12).map((s, i) => seriesCard(s, { eager: i < 6, priority: i === 0 })).join('')}</div>`}
      </div>
    </section>

    ${latestArticles.length > 0 ? html`
    <section class="section cv-deferred" id="latest-articles">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Latest Articles</h2>
          <a href="/articles" class="section-link">View all →</a>
        </div>
        <div class="article-listing-grid">
          ${latestArticles.map(a => articleCard(a)).join('')}
        </div>
      </div>
    </section>
    ` : ''}

    <section class="section cv-deferred">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Browse by Genre</h2>
        </div>
        ${genreGrid()}
      </div>
    </section>
  `;

  const heroCleanup = setupHeroSlider();
  const carouselCleanup = setupCarousel();
  const cleanup = () => { heroCleanup(); carouselCleanup(); };

  setMeta({
    title: `${SITE.name} — Read Manhwa, Manga & Manhua Online Free`,
    description: `Read manhwa, manga and manhua online for free on ${SITE.name}. ${SITE.tagline}`,
    url: SITE.baseUrl + '/',
    type: 'website'
  });

  return {
    title: `${SITE.name} — Read Manhwa, Manga & Manhua Online Free`,
    cleanup
  };
}

// =====================================================
// Latest Updates Carousel
// =====================================================
function setupCarousel() {
  const wrap = document.getElementById('updates-carousel-wrap');
  const carousel = document.getElementById('updates-carousel');
  const dotsEl  = document.getElementById('updates-carousel-dots');
  if (!wrap || !carousel) return () => {};

  const cards = [...carousel.querySelectorAll('.update-card')];
  if (!cards.length) return () => {};

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function cardW() { return (cards[0]?.offsetWidth || 120) + 12; }
  function visibleCount() { return Math.max(1, Math.floor(carousel.clientWidth / cardW())); }
  function totalGroups() { return Math.ceil(cards.length / visibleCount()); }

  function renderDots() {
    if (!dotsEl) return;
    const g = totalGroups();
    if (g <= 1) { dotsEl.innerHTML = ''; return; }
    dotsEl.innerHTML = Array.from({ length: g }, (_, i) =>
      `<button class="updates-carousel-dot${i === 0 ? ' active' : ''}" data-idx="${i}" aria-label="Group ${i + 1}"></button>`
    ).join('');
    dotsEl.querySelectorAll('.updates-carousel-dot').forEach(d => {
      d.addEventListener('click', () => { goToGroup(Number(d.dataset.idx)); pauseAndResume(); });
    });
  }

  function goToGroup(idx) {
    carousel.scrollTo({ left: idx * visibleCount() * cardW(), behavior: 'smooth' });
    updateActiveDot(idx);
  }

  function currentGroupIdx() {
    return Math.round(carousel.scrollLeft / (visibleCount() * cardW()));
  }

  function updateActiveDot(idx) {
    dotsEl?.querySelectorAll('.updates-carousel-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
  }

  renderDots();

  // Staggered entrance (IntersectionObserver)
  if (!reducedMotion) {
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        cards.forEach((c, i) => { c.style.animationDelay = `${i * 60}ms`; });
        io.disconnect();
      }
    }, { threshold: 0.1 });
    io.observe(wrap);
  }

  // Don't auto-rotate when all cards fit or reduced motion
  if (reducedMotion || cards.length <= visibleCount()) return () => {};

  let timer = null;
  let pauseTimer = null;
  let groupIdx = 0;

  function advance() {
    groupIdx = (groupIdx + 1) % totalGroups();
    goToGroup(groupIdx);
  }

  function pauseAndResume() {
    clearInterval(timer); timer = null;
    clearTimeout(pauseTimer);
    pauseTimer = setTimeout(startRotation, 8000);
  }

  function startRotation() {
    clearInterval(timer);
    timer = setInterval(advance, 4000);
  }

  carousel.addEventListener('scroll', () => updateActiveDot(currentGroupIdx()), { passive: true });
  carousel.addEventListener('touchstart', pauseAndResume, { passive: true });

  function onVisibility() {
    if (document.visibilityState === 'visible') startRotation();
    else { clearInterval(timer); timer = null; }
  }
  document.addEventListener('visibilitychange', onVisibility);

  startRotation();
  return () => {
    clearInterval(timer);
    clearTimeout(pauseTimer);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

// =====================================================
// Hero Slider (unchanged from original)
// =====================================================
function setupHeroSlider() {
  const hero = document.getElementById('hero');
  if (!hero) return () => {};
  const slides = [...hero.querySelectorAll('.hero-slide')];
  const dots   = [...hero.querySelectorAll('.hero-dot')];
  const prev   = hero.querySelector('.hero-arrow.prev');
  const next   = hero.querySelector('.hero-arrow.next');
  if (slides.length <= 1) return () => {};

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const ROTATE_MS = 3000;

  let idx = 0;
  let timer = null;
  let progressStart = 0;

  function go(i) {
    idx = (i + slides.length) % slides.length;
    slides.forEach((s, k) => s.classList.toggle('active', k === idx));
    dots.forEach((d, k) => d.classList.toggle('active', k === idx));
    progressStart = performance.now();
    setActiveDotProgress(0);
  }

  function setActiveDotProgress(pct) {
    const active = hero.querySelector('.hero-dot.active');
    if (active) active.style.setProperty('--dot-progress', `${pct * 100}%`);
  }

  let rafId = null;
  function tickProgress() {
    if (!timer) { rafId = null; return; }
    const elapsed = performance.now() - progressStart;
    setActiveDotProgress(Math.min(1, elapsed / ROTATE_MS));
    rafId = requestAnimationFrame(tickProgress);
  }

  function start() {
    stop();
    if (reducedMotion) return;
    progressStart = performance.now();
    timer = setInterval(() => go(idx + 1), ROTATE_MS);
    rafId = requestAnimationFrame(tickProgress);
  }
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    setActiveDotProgress(0);
  }

  function onVisibility() {
    if (document.visibilityState === 'visible') start();
    else stop();
  }
  document.addEventListener('visibilitychange', onVisibility);

  hero.addEventListener('mouseenter', stop);
  hero.addEventListener('mouseleave', start);
  hero.addEventListener('focusin', stop);
  hero.addEventListener('focusout', start);
  prev?.addEventListener('click', () => { go(idx - 1); start(); });
  next?.addEventListener('click', () => { go(idx + 1); start(); });
  dots.forEach(d => d.addEventListener('click', () => { go(Number(d.dataset.idx)); start(); }));

  let sx = 0;
  hero.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; stop(); }, { passive: true });
  hero.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) { dx < 0 ? go(idx + 1) : go(idx - 1); }
    start();
  });

  start();
  return () => {
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
