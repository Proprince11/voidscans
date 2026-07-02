// =====================================================
// View: Articles listing page — /articles
// =====================================================

import { fetchArticles } from '../lib/api.js';
import { esc, setMeta } from '../lib/utils.js';
import { articleCard, emptyState } from './_components.js';
import { SITE } from '../lib/site.config.js';

export async function articles(_params, ctx) {
  ctx.outlet.innerHTML = `
    <div class="container section article-listing">
      <div class="article-listing-header">
        <h1>Articles</h1>
        <p style="color:var(--text-muted);">Editorials, recommendations, and announcements from the team.</p>
      </div>
      <div class="article-listing-grid" id="articles-grid">
        ${[0,1,2,3].map(() => `
          <div style="display:grid;grid-template-columns:100px 1fr;gap:var(--s-3);padding:var(--s-3);background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-md);">
            <div class="skel" style="aspect-ratio:16/9;border-radius:var(--r-sm);"></div>
            <div class="stack gap-2" style="justify-content:center;">
              <div class="skel skel-line short" style="height:10px;"></div>
              <div class="skel skel-line long" style="height:14px;"></div>
              <div class="skel skel-line" style="width:80%;height:10px;"></div>
            </div>
          </div>`).join('')}
      </div>
      <div id="articles-sentinel" class="article-listing-sentinel"></div>
    </div>
  `;

  setMeta({
    title: `Articles — ${SITE.name}`,
    description: `Read editorials, top picks, and announcements from the ${SITE.name} team.`,
    url: `${SITE.baseUrl}/articles`,
    type: 'website'
  });

  let lastDoc = null;
  let loading = false;
  let exhausted = false;

  async function loadMore() {
    if (loading || exhausted) return;
    loading = true;
    try {
      const batch = await fetchArticles({ limitTo: 12, startAfter: lastDoc });
      const grid = document.getElementById('articles-grid');
      if (!grid) return;
      if (!batch.length) {
        exhausted = true;
        if (!grid.children.length) {
          grid.innerHTML = emptyState({ icon: '📰', title: 'No articles yet', subtitle: 'Check back soon.' });
        }
        return;
      }
      // Clear skeletons on first load
      if (!lastDoc) grid.innerHTML = '';
      grid.insertAdjacentHTML('beforeend', batch.map(a => articleCard(a)).join(''));
      if (batch.length < 12) exhausted = true;
    } catch (e) {
      console.error('fetchArticles error:', e);
    } finally {
      loading = false;
    }
  }

  // Initial load
  await loadMore();

  // Infinite scroll sentinel
  const sentinel = document.getElementById('articles-sentinel');
  let io = null;
  if (sentinel) {
    io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '200px' });
    io.observe(sentinel);
  }

  return {
    title: `Articles — ${SITE.name}`,
    cleanup: () => { if (io) io.disconnect(); }
  };
}
