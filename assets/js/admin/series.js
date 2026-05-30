// Admin: Series CRUD
import {
  fetchAllSeries, createSeries, updateSeries, deleteSeries, fetchSeriesBySlug
} from '../lib/api.js';
import { esc, html, slugify, timeAgo } from '../lib/utils.js';
import { toast, confirmModal, spinner } from '../lib/ui.js';
import { GENRES } from '../views/_components.js';

const TYPES = ['manhwa', 'manga', 'manhua'];
const STATUSES = ['ongoing', 'completed', 'hiatus', 'dropped'];

export async function seriesAdmin({ outlet }) {
  let series = [];
  try { series = await fetchAllSeries({ limitTo: 500 }); }
  catch (e) { outlet.innerHTML = `<p>Failed to load: ${esc(e.message)}</p>`; return; }

  let filterText = '';
  let editingId = null;

  function render() {
    const filtered = filterText
      ? series.filter(s => s.title.toLowerCase().includes(filterText) || s.slug.toLowerCase().includes(filterText))
      : series;

    outlet.innerHTML = html`
      <header class="admin-header">
        <h1>Series <span class="text-muted" style="font-weight:400; font-size:var(--fs-sm);">(${series.length})</span></h1>
        <button class="btn btn-primary" id="newBtn">+ New Series</button>
      </header>

      <div class="admin-card" style="margin-bottom: var(--s-4);">
        <input class="input" placeholder="Search by title or slug…" id="search" value="${esc(filterText)}">
      </div>

      <div class="admin-card">
        ${filtered.length === 0 ? `<p class="text-muted">No matches.</p>` : `
          <table class="admin-table">
            <thead><tr><th></th><th>Title</th><th>Type</th><th>Status</th><th>Latest</th><th>Genres</th><th class="actions"></th></tr></thead>
            <tbody>
              ${filtered.map(s => `
                <tr>
                  <td><img class="admin-row-thumb" src="${esc(s.cover)}" alt="" loading="lazy"></td>
                  <td><strong>${esc(s.title)}</strong><br><small class="text-muted">/${esc(s.slug)}</small></td>
                  <td>${esc(s.type)}</td>
                  <td><span class="badge badge-${esc(s.status)}">${esc(s.status)}</span></td>
                  <td>${s.latestChapter > 0 ? 'Ch.' + esc(s.latestChapter) : '—'}</td>
                  <td>
                    <div class="row gap-1" style="flex-wrap:wrap;">
                      ${(s.genres || []).slice(0, 3).map(g => `<span class="tag-pill" style="font-size:11px;padding:2px 6px;">${esc(g)}</span>`).join('')}
                    </div>
                  </td>
                  <td class="actions">
                    <a href="/series/${esc(s.slug)}" target="_blank" rel="noopener" class="icon-btn btn-sm" title="View">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </a>
                    <button class="icon-btn btn-sm" data-edit="${esc(s.id)}" title="Edit">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                    </button>
                    <button class="icon-btn btn-sm" data-del="${esc(s.id)}" data-slug="${esc(s.slug)}" data-title="${esc(s.title)}" title="Delete" style="color: var(--danger);">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;

    document.getElementById('newBtn').addEventListener('click', () => openForm(null));
    document.getElementById('search').addEventListener('input', (e) => {
      filterText = e.target.value.toLowerCase().trim();
      render();
    });
    outlet.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openForm(b.dataset.edit)));
    outlet.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      const ok = await confirmModal({
        title: `Delete "${b.dataset.title}"?`,
        message: 'This will also delete all chapters. Cannot be undone.',
        confirmLabel: 'Delete', danger: true
      });
      if (!ok) return;
      try {
        await deleteSeries(b.dataset.del, b.dataset.slug);
        toast('Deleted', 'success');
        series = await fetchAllSeries({ limitTo: 500 });
        render();
      } catch (e) {
        console.error(e);
        toast('Delete failed: ' + e.message, 'error');
      }
    }));
  }

  function openForm(id) {
    editingId = id;
    const s = id ? series.find(x => x.id === id) : null;

    outlet.innerHTML = html`
      <header class="admin-header">
        <h1>${id ? 'Edit Series' : 'New Series'}</h1>
        <button class="btn btn-ghost" id="backBtn">← Back to list</button>
      </header>

      <form class="admin-card" id="seriesForm">
        <div class="field-row">
          <div class="field">
            <label class="field-label" for="f-title">Title *</label>
            <input class="input" id="f-title" required value="${esc(s?.title || '')}">
          </div>
          <div class="field">
            <label class="field-label" for="f-slug">Slug *</label>
            <input class="input" id="f-slug" required value="${esc(s?.slug || '')}" placeholder="solo-raven">
            <span class="field-hint">Used in URL: /series/[slug]. Lowercase, dashes only.</span>
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="f-cover">Cover Image URL *</label>
          <input class="input" id="f-cover" type="url" required value="${esc(s?.cover || '')}" placeholder="https://r2.../cover.jpg">
        </div>
        <img id="f-cover-preview" src="${esc(s?.cover || '')}" alt="" style="max-width: 160px; aspect-ratio: 2/3; object-fit: cover; border-radius: var(--r-sm); border: 1px solid var(--border); display: ${s?.cover ? 'block' : 'none'}; margin-bottom: var(--s-4);" onerror="this.style.display='none';">

        <div class="field-row">
          <div class="field">
            <label class="field-label" for="f-type">Type</label>
            <select class="select" id="f-type">
              ${TYPES.map(t => `<option value="${t}" ${s?.type === t ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="f-status">Status</label>
            <select class="select" id="f-status">
              ${STATUSES.map(t => `<option value="${t}" ${s?.status === t ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label class="field-label" for="f-author">Author</label>
            <input class="input" id="f-author" value="${esc(s?.author || '')}">
          </div>
          <div class="field">
            <label class="field-label" for="f-artist">Artist</label>
            <input class="input" id="f-artist" value="${esc(s?.artist || '')}">
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label class="field-label" for="f-year">Year</label>
            <input class="input" id="f-year" type="number" min="1900" max="2099" value="${esc(s?.year || '')}">
          </div>
          <div class="field">
            <label class="field-label" for="f-alt">Alt Titles (comma separated)</label>
            <input class="input" id="f-alt" value="${esc((s?.altTitles || []).join(', '))}">
          </div>
        </div>

        <div class="field">
          <label class="field-label">Genres</label>
          <div class="tag-row" id="f-genres">
            ${GENRES.map(g => {
              const slug = g.toLowerCase().replace(/\s+/g, '-');
              const active = (s?.genres || []).map(x => x.toLowerCase().replace(/\s+/g, '-')).includes(slug);
              return `<button type="button" class="tag-pill ${active ? 'active' : ''}" data-genre="${esc(g)}">${esc(g)}</button>`;
            }).join('')}
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="f-tags">Tags (comma separated)</label>
          <input class="input" id="f-tags" value="${esc((s?.tags || []).join(', '))}" placeholder="op-mc, regression, magic">
        </div>

        <div class="field">
          <label class="field-label" for="f-desc">Description</label>
          <textarea class="textarea" id="f-desc" rows="6">${esc(s?.description || '')}</textarea>
        </div>

        <div class="field" style="display: flex; gap: var(--s-5); flex-wrap: wrap;">
          <label class="row gap-2"><input type="checkbox" id="f-featured" ${s?.featured ? 'checked' : ''}> Featured (in hero)</label>
          <label class="row gap-2"><input type="checkbox" id="f-hot" ${s?.hot ? 'checked' : ''}> Hot</label>
          <label class="row gap-2"><input type="checkbox" id="f-new" ${(s?.new ?? !id) ? 'checked' : ''}> New</label>
        </div>

        <div class="row gap-3" style="margin-top: var(--s-5);">
          <button type="submit" class="btn btn-primary" id="saveBtn">${id ? 'Save Changes' : 'Create Series'}</button>
          <button type="button" class="btn btn-ghost" id="cancelBtn">Cancel</button>
        </div>
      </form>
    `;

    const $f = (sel) => document.querySelector(sel);

    $f('#backBtn').addEventListener('click', render);
    $f('#cancelBtn').addEventListener('click', render);

    // Auto-slug from title (only if empty / new)
    $f('#f-title').addEventListener('input', () => {
      if (!id) {
        const slug = $f('#f-slug');
        if (!slug.dataset.touched) slug.value = slugify($f('#f-title').value);
      }
    });
    $f('#f-slug').addEventListener('input', () => $f('#f-slug').dataset.touched = '1');

    // Cover preview
    $f('#f-cover').addEventListener('input', () => {
      const url = $f('#f-cover').value.trim();
      const img = $f('#f-cover-preview');
      img.src = url;
      img.style.display = url ? 'block' : 'none';
    });

    // Genre toggle
    $f('#f-genres').addEventListener('click', (e) => {
      const b = e.target.closest('[data-genre]');
      if (!b) return;
      b.classList.toggle('active');
    });

    // Submit
    $f('#seriesForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        title: $f('#f-title').value.trim(),
        slug: slugify($f('#f-slug').value.trim()),
        cover: $f('#f-cover').value.trim(),
        type: $f('#f-type').value,
        status: $f('#f-status').value,
        author: $f('#f-author').value.trim(),
        artist: $f('#f-artist').value.trim(),
        year: Number($f('#f-year').value) || null,
        altTitles: $f('#f-alt').value.split(',').map(x => x.trim()).filter(Boolean),
        tags: $f('#f-tags').value.split(',').map(x => x.trim()).filter(Boolean),
        genres: [...$f('#f-genres').querySelectorAll('.tag-pill.active')].map(b => b.dataset.genre),
        description: $f('#f-desc').value.trim(),
        featured: $f('#f-featured').checked,
        hot: $f('#f-hot').checked,
        new: $f('#f-new').checked
      };

      $f('#saveBtn').disabled = true;
      $f('#saveBtn').textContent = 'Saving…';

      try {
        if (id) {
          await updateSeries(id, data);
          toast('Updated', 'success');
        } else {
          await createSeries(data);
          toast('Created', 'success');
        }
        series = await fetchAllSeries({ limitTo: 500 });
        render();
      } catch (e) {
        console.error(e);
        toast('Save failed: ' + e.message, 'error');
        $f('#saveBtn').disabled = false;
        $f('#saveBtn').textContent = id ? 'Save Changes' : 'Create Series';
      }
    });
  }

  render();
}
