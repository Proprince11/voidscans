// =====================================================
// Shared view components: series card, status badge, etc.
// Returns HTML strings (used with innerHTML).
// =====================================================

import { esc, timeAgo, normStatus, proxyImage } from '../lib/utils.js';

export function statusBadge(status) {
  const s = normStatus(status);
  return `<span class="badge badge-${s}">${esc(s)}</span>`;
}

/** Single series card.
 *  opts.eager (bool)    - Use loading="eager" instead of "lazy" (for above-the-fold cards)
 *  opts.priority (bool) - Add fetchpriority="high" (use only for the LCP candidate, ie. the first card)
 */
export function seriesCard(series, opts = {}) {
  if (!series) return '';
  const { eager = false, priority = false } = opts;
  const { slug, title, cover, type, status, latestChapter, hot, new: isNew } = series;
  const href = `/series/${encodeURIComponent(slug)}`;
  const cover_ = esc(proxyImage(cover) || '/assets/images/placeholder.png');
  const loadingAttr = eager ? 'eager' : 'lazy';
  const priorityAttr = priority ? ' fetchpriority="high"' : '';
  return `
    <a href="${href}" class="card" aria-label="${esc(title)}">
      <div class="card-img-wrap">
        <img src="${cover_}" alt="${esc(title)}" class="card-img" loading="${loadingAttr}" decoding="async"${priorityAttr} width="200" height="300"
             onerror="this.style.background='var(--surface-3)';this.removeAttribute('src');">
        <div class="card-top-scrim"></div>
        ${hot ? `<div class="card-badge card-badge-right"><span class="badge badge-hot">HOT</span></div>` : ''}
        ${isNew && !hot ? `<div class="card-badge card-badge-right"><span class="badge badge-new">NEW</span></div>` : ''}
        ${latestChapter > 0 ? `<div class="card-chapter">Ch. ${esc(latestChapter)}</div>` : ''}
      </div>
      <div class="card-info">
        <div class="card-title">${esc(title)}</div>
        <div class="card-meta">
          ${status ? statusBadge(status) : ''}
          <span>${esc((type || 'Manhwa').replace(/^./, c => c.toUpperCase()))}</span>
        </div>
      </div>
    </a>
  `;
}

/** Compact "latest update" row with inline chapter list.
 *  If series.recentChapters is available (array of chapter objects),
 *  shows up to 4 chapters with timestamps. Otherwise falls back to single latest.
 */
export function updateRow(series) {
  if (!series) return '';
  const { slug, title, cover, latestChapter, latestChapterAt, recentChapters } = series;
  const seriesHref = `/series/${encodeURIComponent(slug)}`;

  // Build chapter links — prefer recentChapters array, fallback to single latest
  let chaptersHtml = '';
  if (Array.isArray(recentChapters) && recentChapters.length > 0) {
    chaptersHtml = recentChapters.map(ch => {
      const chHref = `/read/${encodeURIComponent(slug)}/${encodeURIComponent(ch.number)}`;
      const ago = ch.createdAt
        ? (ch.createdAt.toDate ? timeAgo(ch.createdAt.toDate()) : timeAgo(ch.createdAt))
        : '';
      const chTitle = ch.title ? ` - ${esc(ch.title)}` : '';
      return `
        <a href="${chHref}" class="update-ch-link">
          <span><strong>Ch. ${esc(ch.number)}</strong>${chTitle}</span>
          <span class="time">${esc(ago)}</span>
        </a>`;
    }).join('');
  } else {
    const href = `/read/${encodeURIComponent(slug)}/${encodeURIComponent(latestChapter)}`;
    const ago = latestChapterAt
      ? (latestChapterAt.toDate ? timeAgo(latestChapterAt.toDate()) : timeAgo(latestChapterAt))
      : '';
    chaptersHtml = `
      <a href="${href}" class="update-ch-link">
        <span><strong>Ch. ${esc(latestChapter)}</strong></span>
        <span class="time">${esc(ago)}</span>
      </a>`;
  }

  return `
    <div class="update-item">
      <a href="${seriesHref}" aria-label="${esc(title)}">
        <img src="${esc(proxyImage(cover))}" alt="${esc(title)}" class="update-thumb" loading="lazy" decoding="async" width="56" height="84"
             onerror="this.style.background='var(--surface-3)';this.removeAttribute('src');">
      </a>
      <div class="update-meta">
        <a href="${seriesHref}" class="update-title">${esc(title)}</a>
        <div class="update-chapters">
          ${chaptersHtml}
        </div>
      </div>
    </div>
  `;
}

/** Single carousel card for the Latest Updates horizontal carousel.
 *  Renders a portrait cover card with title overlay and chapter badge.
 *  Clicking the card navigates to the series detail page.
 *  Clicking the chapter badge navigates to the chapter reader.
 *  If no cover, shows a shimmer placeholder.
 */
export function updateCard(series) {
  if (!series) return '';
  const { slug, title, cover, latestChapter } = series;
  const seriesHref = `/series/${encodeURIComponent(slug)}`;
  const chapterHref = latestChapter > 0
    ? `/read/${encodeURIComponent(slug)}/${encodeURIComponent(latestChapter)}`
    : null;
  const cover_ = cover ? esc(proxyImage(cover)) : '';
  return `
    <div class="update-card" role="listitem">
      <a href="${seriesHref}" aria-label="${esc(title)}" class="update-card-link">
        ${cover_
          ? `<img src="${cover_}" alt="${esc(title)}" class="update-card-img" loading="lazy" decoding="async" width="150" height="225"
               onerror="this.style.display='none'; this.nextElementSibling && (this.nextElementSibling.style.display='block');">`
          : ''}
        ${!cover_ ? `<div class="update-card-shimmer skel"></div>` : ''}
        <div class="card-top-scrim"></div>
        <div class="update-card-title">${esc(title)}</div>
      </a>
      ${chapterHref ? `
        <a href="${chapterHref}" class="update-card-chapter" aria-label="Ch. ${esc(latestChapter)} of ${esc(title)}">
          Ch.${esc(latestChapter)}
        </a>` : ''}
    </div>
  `;
}

/** Numbered popularity ranking item. */
export function rankItem(series, rank) {
  if (!series) return '';
  const { slug, title, cover, type, views } = series;
  const seriesHref = `/series/${encodeURIComponent(slug)}`;
  const viewsStr = views >= 1000 ? `${(views / 1000).toFixed(1)}K` : String(views || 0);
  return `
    <a href="${seriesHref}" class="rank-item" aria-label="#${rank} ${esc(title)}">
      <span class="rank-number">${rank}</span>
      <div class="rank-thumb-wrap">
        <img src="${esc(proxyImage(cover))}" alt="${esc(title)}" class="rank-thumb" loading="lazy" decoding="async" width="56" height="84"
             onerror="this.style.background='var(--surface-3)';this.removeAttribute('src');">
      </div>
      <div class="rank-info">
        <div class="rank-title">${esc(title)}</div>
        <div class="rank-meta">
          <span style="color: var(--accent); font-weight: 500;">${esc((type || 'Manhwa').replace(/^./, c => c.toUpperCase()))}</span>
          <span class="rank-views" style="opacity: 0.7;">👁 ${viewsStr}</span>
        </div>
      </div>
    </a>
  `;
}

export const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Romance',
  'Martial Arts', 'School Life', 'Sci-Fi', 'Horror', 'Mystery',
  'Slice of Life', 'Supernatural', 'Isekai', 'Tragedy', 'Sports',
  'Mecha', 'Historical', 'Psychological', 'Thriller'
];

/** Genre tag pill row. */
export function genreStrip(active = '') {
  const items = ['', ...GENRES];
  return `
    <div class="tag-row scroll genre-strip" role="tablist" aria-label="Genres">
      ${items.map(g => {
        const slug = g === '' ? '' : g.toLowerCase().replace(/\s+/g, '-');
        const isActive = active === slug ? 'active' : '';
        const href = g === '' ? '/browse' : `/genre/${encodeURIComponent(slug)}`;
        return `<a href="${href}" class="tag-pill ${isActive}">${g === '' ? 'All' : esc(g)}</a>`;
      }).join('')}
    </div>
  `;
}

/** Genre icon map — used by genreGrid() for the homepage tile grid.
 *  The existing genreStrip() uses tag pills and is preserved for browse/series pages.
 */
export const GENRE_ICONS = {
  'All':          '📚',
  'Action':       '⚔️',
  'Adventure':    '🗺️',
  'Comedy':       '😂',
  'Drama':        '🎭',
  'Fantasy':      '🧙',
  'Romance':      '💕',
  'Martial Arts': '🥋',
  'School Life':  '🏫',
  'Sci-Fi':       '🚀',
  'Horror':       '👻',
  'Mystery':      '🔍',
  'Slice of Life':'☕',
  'Supernatural': '👁️',
  'Isekai':       '🌀',
  'Tragedy':      '💔',
  'Sports':       '🏆',
  'Mecha':        '🤖',
  'Historical':   '🏯',
  'Psychological':'🧠',
  'Thriller':     '🔪',
};

/** Genre tile grid for the homepage Browse by Genre section.
 *  Returns a .genre-grid div with .genre-tile anchors (emoji + label).
 */
export function genreGrid() {
  const items = ['All', ...GENRES];
  if (!items.length) return '';
  return `
    <div class="genre-grid" role="list" aria-label="Browse by genre">
      ${items.map(g => {
        const slug = g === 'All' ? 'all' : g.toLowerCase().replace(/\s+/g, '-');
        const href = g === 'All' ? '/browse' : `/genre/${encodeURIComponent(slug)}`;
        const icon = GENRE_ICONS[g] || '📖';
        return `
          <a href="${href}" class="genre-tile genre-${esc(slug)}" role="listitem" aria-label="${esc(g)}">
            <span class="genre-tile-label">${esc(g)}</span>
            <span class="genre-tile-icon" aria-hidden="true">${icon}</span>
          </a>`;
      }).join('')}
    </div>
  `;
}

/** Article card for the homepage "Latest Articles" section and the /articles listing page.
 *  Renders a horizontal card with cover, category badge, title, excerpt, and date.
 */
export function articleCard(article) {
  if (!article) return '';
  const { slug, title, excerpt, category, coverImage, publishedAt } = article;
  const href = `/articles/${encodeURIComponent(slug)}`;
  const dateStr = publishedAt?.toDate
    ? publishedAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : (publishedAt ? new Date(publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');
  const imgHtml = coverImage
    ? `<img src="${esc(coverImage)}" alt="${esc(title)}" class="article-card-img" loading="lazy" decoding="async"
           onerror="this.parentElement.classList.add('no-image'); this.remove();">`
    : '';
  return `
    <a href="${href}" class="article-card" aria-label="${esc(title)}">
      <div class="article-card-cover${coverImage ? '' : ' no-image'}">${imgHtml}</div>
      <div class="article-card-body">
        <span class="badge badge-accent">${esc(category || '')}</span>
        <h3 class="article-card-title">${esc(title)}</h3>
        <p class="article-card-excerpt">${esc(excerpt || '')}</p>
        <time class="article-card-date">${esc(dateStr)}</time>
      </div>
    </a>
  `;
}

/** Empty state. */
export function emptyState({ icon = '∅', title = 'Nothing here', subtitle = '', cta = '' } = {}) {
  return `
    <div class="empty-state">
      <div class="icon">${esc(icon)}</div>
      <h3>${esc(title)}</h3>
      ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
      ${cta || ''}
    </div>
  `;
}



// =====================================================
// RECOMMENDATION STRIPS — used by series.js and reader.js to keep
// readers in the catalog after they finish a chapter or browse a series.
// =====================================================

/**
 * Build a "You might also like / More {Type} / Popular Series" card grid.
 * Always returns something useful, even on fresh sites with no genre overlap.
 *
 * @param {object}     currentSeries  - the series the user is on (excluded from recs)
 * @param {object[]}   allSeries      - the full series catalog
 * @param {object}     opts
 * @param {number}     [opts.limit=6] - max cards to show
 * @returns {{ titleText: string, cards: string[] }}
 */
export function buildRecommendations(currentSeries, allSeries, opts = {}) {
  const limit = Math.max(1, Number(opts.limit) || 6);
  if (!Array.isArray(allSeries) || !allSeries.length || !currentSeries) {
    return { titleText: '', cards: [] };
  }

  const myGenres = new Set((currentSeries.genres || []).map(g => g.toLowerCase()));
  const others = allSeries.filter(x => x.slug !== currentSeries.slug);

  // 1) Genre overlap (best signal)
  let candidates = others
    .map(x => ({
      x,
      overlap: (x.genres || []).filter(g => myGenres.has(g.toLowerCase())).length
    }))
    .filter(r => r.overlap > 0)
    .sort((a, b) => {
      if (b.overlap !== a.overlap) return b.overlap - a.overlap;
      return (b.x.views || 0) - (a.x.views || 0);
    })
    .map(r => r.x);

  let titleText = 'You might also like';

  // 2) Same type fallback
  if (candidates.length === 0 && currentSeries.type) {
    candidates = others
      .filter(x => x.type === currentSeries.type)
      .sort((a, b) => (b.views || 0) - (a.views || 0));
    if (candidates.length) {
      titleText = `More ${currentSeries.type.charAt(0).toUpperCase() + currentSeries.type.slice(1)}`;
    }
  }

  // 3) Popular fallback
  if (candidates.length === 0) {
    candidates = others.sort((a, b) => (b.views || 0) - (a.views || 0));
    if (candidates.length) titleText = 'Popular Series';
  }

  return {
    titleText,
    cards: candidates.slice(0, limit).map(s => seriesCard(s))
  };
}

/**
 * Build a list of the most-recently-updated series, excluding the current one.
 * Used as a "Latest Updates" tail strip for global discovery.
 *
 * @returns {string[]} array of updateRow() HTML
 */
export function buildLatestUpdates(currentSlug, allSeries, opts = {}) {
  const limit = Math.max(1, Number(opts.limit) || 6);
  if (!Array.isArray(allSeries) || !allSeries.length) return [];
  return allSeries
    .filter(x => x.slug !== currentSlug && x.latestChapter > 0)
    .sort((a, b) => {
      const at = a.latestChapterAt?.toMillis ? a.latestChapterAt.toMillis()
        : (a.latestChapterAt ? new Date(a.latestChapterAt).getTime() || 0 : 0);
      const bt = b.latestChapterAt?.toMillis ? b.latestChapterAt.toMillis()
        : (b.latestChapterAt ? new Date(b.latestChapterAt).getTime() || 0 : 0);
      return bt - at;
    })
    .slice(0, limit)
    .map(s => updateRow(s));
}
