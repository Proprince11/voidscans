// =====================================================
// View: Search — debounced, URL-synced, ranked client-side
// =====================================================

import { fetchAllSeries, searchSeries } from '../lib/api.js';
import { esc, html, qs as getQS, debounce } from '../lib/utils.js';
import { seriesCard, emptyState, GENRES } from './_components.js';
import { skeletonGrid } from '../lib/ui.js';

const SUGGESTIONS = ['Action', 'Romance', 'Fantasy', 'Isekai', 'Martial Arts', 'Solo', 'Regression', 'Murim'];

export async function search(_params, ctx) {
  const initialQ = getQS('q') || '';

  ctx.outlet.innerHTML = html`
    <div class="container search-page">
      <div class="search-hero">
        <h1>Find your next obsession</h1>
        <p class="text-muted">Search by title, alt title, genre, or tag.</p>
        <div class="search-input" style="margin-top: var(--s-5);">
          <input type="search" id="qInput" class="input input-lg" placeholder="Type to search…" autocomplete="off" autofocus>
        </div>
      </div>
      <div id="results"></div>
    </div>
  `;

  const $q = document.getElementById('qInput');
  const $r = document.getElementById('results');

  $q.value = initialQ;

  let allSeries = [];
  try {
    allSeries = await fetchAllSeries({ limitTo: 500 });
  } catch (e) {
    $r.innerHTML = emptyState({ icon: '⚠', title: 'Could not load' });
    return { title: 'Search · VoidScans' };
  }

  function renderDefault() {
    $r.innerHTML = html`
      <div class="container">
        <h3 style="margin-bottom: var(--s-3); font-size: var(--fs-md);">Popular searches</h3>
        <div class="tag-row" id="suggest">
          ${SUGGESTIONS.map(s => `<button class="tag-pill" data-suggest="${esc(s)}">${esc(s)}</button>`).join('')}
        </div>
      </div>
    `;
    $r.querySelectorAll('[data-suggest]').forEach(b => {
      b.addEventListener('click', () => {
        $q.value = b.dataset.suggest;
        $q.dispatchEvent(new Event('input'));
      });
    });
  }

  function renderResults(q) {
    const matches = searchSeries(allSeries, q);
    $r.innerHTML = html`
      <div class="container">
        <p class="results-count" style="margin-bottom: var(--s-4);"><strong>${matches.length}</strong> result${matches.length === 1 ? '' : 's'} for "${esc(q)}"</p>
        ${matches.length === 0
          ? emptyState({ icon: '🔍', title: 'No matches', subtitle: 'Try fewer keywords or browse by genre.' })
          : `<div class="card-grid">${matches.map(s => seriesCard(s)).join('')}</div>`}
      </div>
    `;
  }

  const onInput = debounce(() => {
    const v = $q.value.trim();
    if (!v) {
      history.replaceState({}, '', '/search');
      renderDefault();
    } else {
      const u = new URL(location.href);
      u.searchParams.set('q', v);
      history.replaceState({}, '', u.pathname + '?' + u.searchParams.toString());
      renderResults(v);
    }
  }, 200);

  $q.addEventListener('input', onInput);

  if (initialQ) renderResults(initialQ);
  else renderDefault();

  return { title: initialQ ? `Search: ${initialQ} · VoidScans` : 'Search · VoidScans' };
}
