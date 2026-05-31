// =====================================================
// View: Library — bookmarks, history, status filters.
// All local (IndexedDB) — Phase 2 will sync to Firestore.
// =====================================================

import { getLibrary, getHistory, removeFromLibrary, setLibraryStatus } from '../lib/library.js';
import { fetchAllSeries } from '../lib/api.js';
import { esc, html, timeAgo, qs as getQS, proxyImage } from '../lib/utils.js';
import { seriesCard, emptyState } from './_components.js';
import { toast, confirmModal } from '../lib/ui.js';
import { pageTitle } from '../lib/site.config.js';

const TABS = [
  { key: 'reading',   label: 'Reading' },
  { key: 'completed', label: 'Completed' },
  { key: 'planned',   label: 'Plan to Read' },
  { key: 'dropped',   label: 'Dropped' },
  { key: 'all',       label: 'All Bookmarks' },
  { key: 'history',   label: 'History' }
];

export async function library(_params, ctx) {
  const initial = getQS('tab') || 'reading';

  ctx.outlet.innerHTML = html`
    <div class="container section">
      <h1 style="margin-bottom: var(--s-2);">My Library</h1>
      <p class="text-muted" style="margin-bottom: var(--s-5);">Saved on this device. Sign in (coming soon) to sync across devices.</p>

      <div class="library-tabs" id="libTabs" role="tablist">
        ${TABS.map(t => `<button class="tab ${t.key === initial ? 'active' : ''}" data-key="${t.key}">${esc(t.label)}</button>`).join('')}
      </div>

      <div id="libContent"></div>
    </div>
  `;

  const tabs = document.querySelectorAll('#libTabs .tab');
  const $content = document.getElementById('libContent');
  let current = initial;

  async function paint(key) {
    current = key;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.key === key));
    const u = new URL(location.href); u.searchParams.set('tab', key);
    history.replaceState({}, '', u.pathname + '?' + u.searchParams.toString());

    if (key === 'history') {
      const hist = await getHistory({ limit: 50 });
      if (!hist.length) {
        $content.innerHTML = emptyState({ icon: '🕘', title: 'No reading history yet', subtitle: 'Pages you read will appear here.', cta: '<a href="/browse" class="btn btn-primary">Browse series</a>' });
        return;
      }
      $content.innerHTML = `
        <div class="stack gap-2">
          ${hist.map(h => html`
            <a href="/read/${esc(h.seriesId)}/${h.chapter}" class="update-item">
              <div style="grid-column: 1 / -1; padding: var(--s-3); background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--r-md); display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <div class="update-title">${esc(h.seriesId.replace(/-/g, ' '))}</div>
                  <div class="text-muted" style="font-size: var(--fs-xs); margin-top: 4px;">Chapter ${esc(h.chapter)} · ${esc(timeAgo(h.readAt))}</div>
                </div>
                <span class="btn btn-outline btn-sm">Continue</span>
              </div>
            </a>
          `).join('')}
        </div>
      `;
      return;
    }

    // Library tabs
    const filter = key === 'all' ? 'all' : key;
    const items = await getLibrary(filter);
    if (!items.length) {
      $content.innerHTML = emptyState({
        icon: '⭐',
        title: `Nothing in "${TABS.find(t => t.key === key).label}" yet`,
        subtitle: 'Bookmark series from their detail page.',
        cta: '<a href="/browse" class="btn btn-primary">Browse series</a>'
      });
      return;
    }

    $content.innerHTML = `
      <div class="card-grid">
        ${items.map(item => `
          <div class="card" style="position: relative;">
            <a href="/series/${esc(item.seriesId)}" class="card-img-wrap">
              <img src="${esc(proxyImage(item.cover))}" class="card-img" alt="${esc(item.title)}" loading="lazy">
              ${item.currentChapter > 0 ? `<div class="card-chapter">Last: Ch. ${esc(item.currentChapter)}</div>` : ''}
            </a>
            <div class="card-info">
              <a href="/series/${esc(item.seriesId)}" class="card-title">${esc(item.title)}</a>
              <div class="card-meta" style="justify-content: space-between;">
                <select class="select" data-status="${esc(item.seriesId)}" style="font-size: var(--fs-xs); padding: 4px 6px; height: auto;">
                  <option value="reading"   ${item.status === 'reading'   ? 'selected' : ''}>Reading</option>
                  <option value="completed" ${item.status === 'completed' ? 'selected' : ''}>Completed</option>
                  <option value="planned"   ${item.status === 'planned'   ? 'selected' : ''}>Plan to Read</option>
                  <option value="dropped"   ${item.status === 'dropped'   ? 'selected' : ''}>Dropped</option>
                </select>
                <button class="icon-btn btn-sm" data-remove="${esc(item.seriesId)}" aria-label="Remove" title="Remove">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Wire up status changes
    $content.querySelectorAll('[data-status]').forEach(sel => {
      sel.addEventListener('change', async () => {
        await setLibraryStatus(sel.dataset.status, sel.value);
        toast('Status updated', 'success');
        paint(current);
      });
    });
    $content.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await confirmModal({ title: 'Remove from library?', message: 'You can add it again any time.', confirmLabel: 'Remove', danger: true });
        if (!ok) return;
        await removeFromLibrary(btn.dataset.remove);
        toast('Removed', 'info');
        paint(current);
      });
    });
  }

  tabs.forEach(t => t.addEventListener('click', () => paint(t.dataset.key)));
  paint(initial);

  return { title: pageTitle('Library') };
}
