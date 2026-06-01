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
        <img src="${cover_}" alt="${esc(title)}" class="card-img" loading="${loadingAttr}" decoding="async"${priorityAttr}
             onerror="this.style.background='var(--surface-3)';this.removeAttribute('src');">
        ${status ? `<div class="card-badge">${statusBadge(status)}</div>` : ''}
        ${hot ? `<div class="card-badge card-badge-right"><span class="badge badge-hot">HOT</span></div>` : ''}
        ${isNew && !hot ? `<div class="card-badge card-badge-right"><span class="badge badge-new">NEW</span></div>` : ''}
        ${latestChapter > 0 ? `<div class="card-chapter">Ch. ${esc(latestChapter)}</div>` : ''}
      </div>
      <div class="card-info">
        <div class="card-title">${esc(title)}</div>
        <div class="card-meta">
          <span>${esc((type || 'Manhwa').replace(/^./, c => c.toUpperCase()))}</span>
        </div>
      </div>
    </a>
  `;
}

/** Compact "latest update" row. */
export function updateRow(series) {
  if (!series) return '';
  const { slug, title, cover, latestChapter, latestChapterAt } = series;
  const href = `/read/${encodeURIComponent(slug)}/${encodeURIComponent(latestChapter)}`;
  const seriesHref = `/series/${encodeURIComponent(slug)}`;
  const ago = latestChapterAt
    ? (latestChapterAt.toDate ? timeAgo(latestChapterAt.toDate()) : timeAgo(latestChapterAt))
    : '';
  return `
    <div class="update-item">
      <a href="${seriesHref}" aria-label="${esc(title)}">
        <img src="${esc(proxyImage(cover))}" alt="${esc(title)}" class="update-thumb" loading="lazy" decoding="async"
             onerror="this.style.background='var(--surface-3)';this.removeAttribute('src');">
      </a>
      <div class="update-meta">
        <a href="${seriesHref}" class="update-title">${esc(title)}</a>
        <div class="update-chapters">
          <a href="${href}" class="update-ch-link">
            <span><strong>Ch. ${esc(latestChapter)}</strong></span>
            <span class="time">${esc(ago)}</span>
          </a>
        </div>
      </div>
    </div>
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
