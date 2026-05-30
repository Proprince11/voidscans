// =====================================================
// View: Browse — filter + sort + paginated grid
// =====================================================

import { fetchAllSeries } from '../lib/api.js';
import { esc, html, qs as getQS, debounce } from '../lib/utils.js';
import { seriesCard, genreStrip, emptyState, GENRES } from './_components.js';
import { skeletonGrid } from '../lib/ui.js';

const PAGE_SIZE = 24;

export async function browse(_params, ctx) {
  // Initial skeleton
  ctx.outlet.innerHTML = html`
    <div class="container section">
      <div class="section-header"><h2 class="section-title">Browse</h2></div>
      ${genreStrip()}
      <div style="margin-top: var(--s-5);">${skeletonGrid(12)}</div>
    </div>
  `;

  let allSeries;
  try {
    allSeries = await fetchAllSeries({ limitTo: 500 });
  } catch (e) {
    console.error(e);
    ctx.outlet.innerHTML = `<div class="container section">${emptyState({ icon: '⚠', title: 'Failed to load' })}</div>`;
    return { title: 'Browse · VoidScans' };
  }

  const initialGenre  = getQS('genre') || '';
  const initialType   = getQS('type') || '';
  const initialStatus = getQS('status') || '';
  const initialSort   = getQS('sort') || 'updated';

  ctx.outlet.innerHTML = html`
    <div class="container section">
      <div class="section-header">
        <h2 class="section-title">Browse Series</h2>
        <span class="results-count" id="rcount"><strong>0</strong> results</span>
      </div>

      ${genreStrip(initialGenre)}

      <div class="browse-layout" style="margin-top: var(--s-5);">
        <aside class="filter-panel">
          <div class="filter-group">
            <h4>Type</h4>
            <select class="select" id="filterType">
              <option value="">All Types</option>
              <option value="manhwa">Manhwa</option>
              <option value="manga">Manga</option>
              <option value="manhua">Manhua</option>
            </select>
          </div>
          <div class="filter-group">
            <h4>Status</h4>
            <select class="select" id="filterStatus">
              <option value="">Any</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="hiatus">Hiatus</option>
              <option value="dropped">Dropped</option>
            </select>
          </div>
          <div class="filter-group">
            <h4>Sort</h4>
            <select class="select" id="filterSort">
              <option value="updated">Recently Updated</option>
              <option value="new">Newest</option>
              <option value="popular">Most Popular</option>
              <option value="title">Title A–Z</option>
            </select>
          </div>
        </aside>

        <div>
          <div class="results-toolbar mobile-only">
            <select class="select" id="filterTypeM" style="max-width:150px;">
              <option value="">All Types</option>
              <option value="manhwa">Manhwa</option>
              <option value="manga">Manga</option>
              <option value="manhua">Manhua</option>
            </select>
            <select class="select" id="filterSortM" style="max-width:200px;">
              <option value="updated">Recently Updated</option>
              <option value="new">Newest</option>
              <option value="popular">Most Popular</option>
              <option value="title">Title A–Z</option>
            </select>
          </div>
          <div id="grid"></div>
          <div class="center" style="margin-top: var(--s-6);">
            <button class="btn btn-outline" id="loadMore" style="display:none;">Load more</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Wire up filters
  const $ = (id) => document.getElementById(id);
  const elGenre  = initialGenre;
  $('filterType').value   = initialType;
  $('filterStatus').value = initialStatus;
  $('filterSort').value   = initialSort;
  $('filterTypeM') && ($('filterTypeM').value = initialType);
  $('filterSortM') && ($('filterSortM').value = initialSort);

  let visible = PAGE_SIZE;
  let filtered = [];

  function syncMobile() {
    if ($('filterTypeM')) $('filterType').value = $('filterTypeM').value;
    if ($('filterSortM')) $('filterSort').value = $('filterSortM').value;
  }

  function applyFilter() {
    syncMobile();
    const type   = $('filterType').value;
    const status = $('filterStatus').value;
    const sort   = $('filterSort').value;

    filtered = allSeries.filter(s => {
      if (elGenre && !(s.genres || []).map(g => g.toLowerCase().replace(/\s+/g, '-')).includes(elGenre)) return false;
      if (type && s.type !== type) return false;
      if (status && s.status !== status) return false;
      return true;
    });

    if (sort === 'title') filtered.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'popular') filtered.sort((a, b) => (b.rating?.average || 0) - (a.rating?.average || 0) || (b.followers || 0) - (a.followers || 0));
    else if (sort === 'new') filtered.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
    else /* updated */ filtered.sort((a, b) => toMs(b.latestChapterAt || b.updatedAt) - toMs(a.latestChapterAt || a.updatedAt));

    visible = PAGE_SIZE;
    render();
  }

  function render() {
    const grid = $('grid');
    const slice = filtered.slice(0, visible);
    grid.innerHTML = slice.length === 0
      ? emptyState({ icon: '🔍', title: 'No results', subtitle: 'Try clearing filters.' })
      : `<div class="card-grid">${slice.map((s, i) => seriesCard(s, { eager: i < 6, priority: i === 0 })).join('')}</div>`;
    $('rcount').innerHTML = `<strong>${filtered.length}</strong> result${filtered.length === 1 ? '' : 's'}`;
    $('loadMore').style.display = visible < filtered.length ? '' : 'none';
  }

  ['filterType','filterStatus','filterSort','filterTypeM','filterSortM'].forEach(id => {
    $(id)?.addEventListener('change', applyFilter);
  });
  $('loadMore').addEventListener('click', () => { visible += PAGE_SIZE; render(); });

  applyFilter();

  return { title: 'Browse · VoidScans' };
}

function toMs(t) {
  if (!t) return 0;
  if (t.toMillis) return t.toMillis();
  if (t.seconds) return t.seconds * 1000;
  return new Date(t).getTime() || 0;
}
