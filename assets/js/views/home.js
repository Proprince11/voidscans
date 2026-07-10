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
      <div class="hero-content centered-hero">
        <div class="skel" style="width: 90vw; max-width: 320px; aspect-ratio: 2/3; border-radius: var(--r-lg);"></div>
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

  // Netflix-style Billboard Hero Slider
  const heroHtml = heroItems.length === 0 ? '' : html`
    <section class="hero" id="hero" style="height: 60vh; min-height: 500px; max-height: 700px; position:relative; overflow:hidden; background: var(--bg); display: block;">
      ${heroItems.slice(0, 5).map((s, i) => `
        <div class="hero-slide ${i === 0 ? 'active' : ''}" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
          
          <!-- Cinematic Background Glow / Abstract Art -->
          <div style="position:absolute; top:-20%; right:-10%; width:70vw; height:140%; background-image:url('${esc(proxyImage(s.cover))}'); background-size:cover; background-position: center; filter:blur(60px); opacity:0.3; mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%); -webkit-mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%); z-index: 1;"></div>
          
          <!-- Left-to-Right Dark Gradient for Text Legibility -->
          <div style="position:absolute; inset:0; background: linear-gradient(to right, var(--bg) 10%, rgba(10,10,12,0.8) 50%, transparent 100%); z-index: 2; pointer-events:none;"></div>

          <div class="hero-content" style="position: relative; z-index: 3; display: flex; flex-direction: row; align-items: center; justify-content: center; height: 100%; width: 100%; padding: 40px 5%; max-width: 1400px; margin: 0 auto; gap: clamp(40px, 8vw, 120px);">
            
            <!-- Left Info Area -->
            <div class="hero-info" style="flex: 1; max-width: 650px; display: flex; flex-direction: column; gap: 20px;">
              
              <!-- Badges -->
              <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                <span style="background: var(--accent); color: #fff; padding: 4px 12px; border-radius: 4px; font-weight: 800; font-size: 12px; letter-spacing: 1px; text-transform: uppercase;">Top Pick</span>
                ${s.latestChapter ? `<span style="color: #aaa; font-weight: 600; font-size: 14px; letter-spacing: 0.5px;">CHAPTER ${esc(s.latestChapter)}</span>` : ''}
              </div>

              <!-- Title -->
              <h2 style="font-family: var(--font-display); font-size: clamp(2.5rem, 5vw, 4.5rem); font-weight: 900; line-height: 1.05; color: #fff; margin: 0; text-transform: uppercase; letter-spacing: -1px; text-shadow: 0 4px 12px rgba(0,0,0,0.5);">${esc(s.title)}</h2>
              
              <!-- Synopsis -->
              ${s.synopsis ? `<p style="font-size: 17px; color: #bbb; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin: 0;">${esc(s.synopsis)}</p>` : ''}
              
              <!-- Action Buttons -->
              <div style="display: flex; gap: 16px; margin-top: 10px; flex-wrap: wrap;">
                <a href="/series/${encodeURIComponent(s.slug)}" class="btn btn-primary" style="padding: 14px 36px; font-size: 16px; font-weight: 800; border-radius: 6px; display: flex; align-items: center; gap: 10px; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 4px 15px rgba(var(--accent-rgb), 0.4);">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  READ NOW
                </a>
                <a href="/series/${encodeURIComponent(s.slug)}" class="btn" style="padding: 14px 28px; font-size: 16px; font-weight: 600; border-radius: 6px; background: rgba(255,255,255,0.1); color: #fff; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 8px; transition: background 0.2s;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                  Details
                </a>
              </div>
            </div>

            <!-- Right Poster Area -->
            <div class="hero-poster" style="flex-shrink: 0; display: flex; justify-content: flex-end; align-items: center; perspective: 1000px; position: relative;">
              
              <!-- Background Glow behind the poster -->
              <div style="position: absolute; width: clamp(220px, 28vw, 380px); aspect-ratio: 2/3; background-image: url('${esc(proxyImage(s.cover))}'); background-size: cover; background-position: center; filter: blur(35px); opacity: 0.85; z-index: 0; border-radius: 12px; transform: rotateY(-15deg) rotateX(5deg) scale(1.05); transition: transform 0.4s ease, opacity 0.4s ease;"></div>
              
              <a href="/series/${encodeURIComponent(s.slug)}" style="position: relative; z-index: 1; display: block; width: clamp(220px, 28vw, 380px); aspect-ratio: 2/3; border-radius: 12px; overflow: hidden; box-shadow: -20px 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1); transform: rotateY(-15deg) rotateX(5deg); transition: transform 0.4s ease, box-shadow 0.4s ease;" onmouseover="this.style.transform='rotateY(0deg) rotateX(0deg) scale(1.05)'; this.style.boxShadow='0 30px 60px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.2)'; this.previousElementSibling.style.transform='rotateY(0deg) rotateX(0deg) scale(1.15)'; this.previousElementSibling.style.opacity='1';" onmouseout="this.style.transform='rotateY(-15deg) rotateX(5deg)'; this.style.boxShadow='-20px 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)'; this.previousElementSibling.style.transform='rotateY(-15deg) rotateX(5deg) scale(1.05)'; this.previousElementSibling.style.opacity='0.85';">
                <img src="${esc(proxyImage(s.cover))}" alt="${esc(s.title)}" style="width: 100%; height: 100%; object-fit: cover;">
              </a>
            </div>

          </div>
        </div>
      `).join('')}

      <!-- Responsive CSS overrides for mobile -->
      <style>
        @media (max-width: 768px) {
          #hero .hero-poster { display: none !important; }
          #hero .hero-arrow { display: none !important; }
          #hero .hero-info { align-items: center; text-align: center; }
          #hero > div:first-child > div:nth-child(1) { width: 100% !important; right: 0 !important; top: -10% !important; opacity: 0.5 !important; }
          #hero > div:first-child > div:nth-child(2) { background: linear-gradient(to top, var(--bg) 0%, rgba(10,10,12,0.8) 50%, transparent 100%) !important; }
        }
        #hero .hero-arrow:hover { background: rgba(255,255,255,0.1) !important; }
      </style>

      ${heroItems.length > 1 ? `
        <!-- Navigation Controls -->
        <button class="hero-arrow prev" aria-label="Previous" style="position:absolute; left: 20px; top: 50%; transform: translateY(-50%); z-index:10; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 50%; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; color: white; cursor: pointer; backdrop-filter: blur(10px); transition: all 0.2s;">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        
        <button class="hero-arrow next" aria-label="Next" style="position:absolute; right: 20px; top: 50%; transform: translateY(-50%); z-index:10; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 50%; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; color: white; cursor: pointer; backdrop-filter: blur(10px); transition: all 0.2s;">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>

        <div class="hero-nav" style="position:absolute; bottom:30px; left:5%; z-index:10; display:flex; gap:10px; align-items:center; width: 100%; justify-content: flex-start;">
          ${heroItems.slice(0, 5).map((_, i) => `
            <button class="hero-dot ${i === 0 ? 'active' : ''}" data-idx="${i}" aria-label="Slide ${i + 1}" style="width: 40px; height: 4px; border-radius: 2px; border:none; background: rgba(255,255,255,0.2); cursor:pointer; padding:0; position:relative; overflow:hidden; transition: width 0.3s;">
              <div class="dot-progress" style="position:absolute; left:0; top:0; bottom:0; background:#fff; width: var(--dot-progress, 0%); border-radius: 3px;"></div>
            </button>
          `).join('')}
        </div>
      ` : ''}
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
        <div class="card-grid card-grid-horizontal">
          ${continueReading.map(s => `
            <a href="/read/${esc(s.slug)}/${esc(s.lastReadChapter)}" class="card" aria-label="Continue ${esc(s.title)}">
              <div class="card-img-wrap">
                <img src="${esc(proxyImage(s.cover) || '/assets/images/placeholder.png')}" alt="${esc(s.title)}" class="card-img" loading="lazy" decoding="async"
                     onerror="this.style.background='var(--surface-3)';this.removeAttribute('src');">
                <div class="card-chapter">Continue · Ch. ${esc(s.lastReadChapter)}</div>
                ${(s.latestChapter && s.latestChapter > 0) ? `
                  <div class="progress-bar-wrap">
                    <div class="progress-bar-fill" style="width: ${Math.min(100, (s.lastReadChapter / s.latestChapter) * 100)}%;"></div>
                  </div>
                ` : ''}
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
