// =====================================================
// Shared view components: series card, status badge, etc.
// Returns HTML strings (used with innerHTML).
// =====================================================

import { esc, timeAgo, normStatus } from '../lib/utils.js';

export function statusBadge(status) {
  const s = normStatus(status);
  return `<span class="badge badge-${s}">${esc(s)}</span>`;
}

/** Single series card. */
export function seriesCard(series, opts = {}) {
  if (!series) return '';
  const { slug, title, cover, type, status, latestChapter, hot, new: isNew } = series;
  const href = `/series/${encodeURIComponent(slug)}`;
  const cover_ = esc(cover || '/assets/images/placeholder.png');
  return `
    <a href="${href}" class="card" aria-label="${esc(title)}">
      <div class="card-img-wrap">
        <img src="${cover_}" alt="${esc(title)}" class="card-img" loading="lazy"
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
        <img src="${esc(cover)}" alt="${esc(title)}" class="update-thumb" loading="lazy"
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
