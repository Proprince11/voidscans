// =====================================================
// View: Genre — single template, ?slug=action style.
// =====================================================

import { fetchAllSeries } from '../lib/api.js';
import { esc, html, unslug } from '../lib/utils.js';
import { seriesCard, genreStrip, emptyState } from './_components.js';
import { skeletonGrid } from '../lib/ui.js';

export async function genre(params, ctx) {
  const slug = (params.slug || '').toLowerCase();
  const niceName = unslug(slug);

  ctx.outlet.innerHTML = html`
    <div class="container section">
      <h1 style="margin-bottom: var(--s-2);">${esc(niceName)}</h1>
      <p class="text-muted" style="margin-bottom: var(--s-5);">Series tagged with ${esc(niceName.toLowerCase())}</p>
      ${genreStrip(slug)}
      <div id="grid" style="margin-top: var(--s-5);">${skeletonGrid(12)}</div>
    </div>
  `;

  let series = [];
  try {
    const all = await fetchAllSeries({ limitTo: 500 });
    series = all.filter(s => (s.genres || []).map(g => g.toLowerCase().replace(/\s+/g, '-')).includes(slug));
  } catch (e) {
    document.getElementById('grid').innerHTML = emptyState({ icon: '⚠', title: 'Could not load' });
    return { title: `${niceName} · VoidScans` };
  }

  const grid = document.getElementById('grid');
  if (series.length === 0) {
    grid.innerHTML = emptyState({
      icon: '∅',
      title: `No ${niceName.toLowerCase()} series yet`,
      subtitle: 'Try a different genre or browse all.',
      cta: '<a href="/browse" class="btn btn-primary">Browse All</a>'
    });
  } else {
    grid.innerHTML = `<div class="card-grid">${series.map(s => seriesCard(s)).join('')}</div>`;
  }

  return { title: `${niceName} · VoidScans` };
}
