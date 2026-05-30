// =====================================================
// View: Home — hero slider, latest updates, popular, new
// =====================================================

import { fetchHomeSections } from '../lib/api.js';
import { esc, html } from '../lib/utils.js';
import { skeletonGrid } from '../lib/ui.js';
import { seriesCard, updateRow, genreStrip, emptyState, statusBadge } from './_components.js';

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
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--s-3);">
          ${[0,0,0,0,0,0].map(() => `<div class="skel" style="height:90px; border-radius:var(--r-md);"></div>`).join('')}
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
        ${emptyState({ icon: '⚠', title: 'Could not load', subtitle: 'Database connection failed. Try again in a moment.', cta: '<button class="btn btn-primary" onclick="location.reload()">Reload</button>' })}
      </div>
    `;
    return { title: 'VoidScans' };
  }

  const { hero: heroItems, popular, newlyAdded, latest, all } = sections;

  // Build hero slider
  const heroHtml = heroItems.length === 0 ? '' : html`
    <section class="hero" id="hero">
      ${heroItems.map((s, i) => `
        <div class="hero-slide ${i === 0 ? 'active' : ''}" data-idx="${i}">
          <div class="hero-bg" style="background-image: url('${esc(s.cover)}');"></div>
          <div class="hero-content">
            <div class="hero-cover">
              <img src="${esc(s.cover)}" alt="${esc(s.title)}" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async"${i === 0 ? ' fetchpriority="high"' : ''}>
            </div>
            <div class="hero-meta">
              <div class="badges">
                ${statusBadge(s.status)}
                ${s.hot ? `<span class="badge badge-hot">HOT</span>` : ''}
                ${s.new ? `<span class="badge badge-new">NEW</span>` : ''}
              </div>
              <h1 class="hero-title">${esc(s.title)}</h1>
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

    <section class="section" id="latest">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Latest Updates</h2>
          <a href="/browse?sort=updated" class="section-link">View all →</a>
        </div>
        ${latest.length === 0
          ? emptyState({ icon: '📚', title: 'No updates yet', subtitle: 'Add your first series in the admin panel.' })
          : `<div class="update-list">${latest.map(updateRow).join('')}</div>`}
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Browse by Genre</h2>
        </div>
        ${genreStrip()}
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Popular Now</h2>
          <a href="/browse?sort=popular" class="section-link">View all →</a>
        </div>
        ${popular.length === 0
          ? emptyState({ icon: '⭐', title: 'No series yet', cta: '<a href="/admin" class="btn btn-primary">Open Admin</a>' })
          : `<div class="card-grid">${popular.map((s, i) => seriesCard(s, { eager: i < 6, priority: i === 0 })).join('')}</div>`}
      </div>
    </section>

    ${newlyAdded.length > 0 ? html`
    <section class="section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">New Arrivals</h2>
          <a href="/browse?sort=new" class="section-link">View all →</a>
        </div>
        <div class="card-grid">${newlyAdded.slice(0, 12).map((s, i) => seriesCard(s, { eager: i < 6 })).join('')}</div>
      </div>
    </section>
    ` : ''}
  `;

  // Hero slider behavior
  const cleanup = setupHeroSlider();

  return {
    title: 'VoidScans — Read Manhwa, Manga & Manhua',
    cleanup
  };
}

function setupHeroSlider() {
  const hero = document.getElementById('hero');
  if (!hero) return () => {};
  const slides = [...hero.querySelectorAll('.hero-slide')];
  const dots   = [...hero.querySelectorAll('.hero-dot')];
  const prev   = hero.querySelector('.hero-arrow.prev');
  const next   = hero.querySelector('.hero-arrow.next');
  if (slides.length <= 1) return () => {};

  let idx = 0;
  let timer = null;

  function go(i) {
    idx = (i + slides.length) % slides.length;
    slides.forEach((s, k) => s.classList.toggle('active', k === idx));
    dots.forEach((d, k) => d.classList.toggle('active', k === idx));
  }
  function start() { stop(); timer = setInterval(() => go(idx + 1), 6000); }
  function stop()  { if (timer) { clearInterval(timer); timer = null; } }

  hero.addEventListener('mouseenter', stop);
  hero.addEventListener('mouseleave', start);
  prev?.addEventListener('click', () => { go(idx - 1); start(); });
  next?.addEventListener('click', () => { go(idx + 1); start(); });
  dots.forEach(d => d.addEventListener('click', () => { go(Number(d.dataset.idx)); start(); }));

  // Touch swipe
  let sx = 0;
  hero.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  hero.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) { dx < 0 ? go(idx + 1) : go(idx - 1); start(); }
  });

  start();
  return () => stop();
}
