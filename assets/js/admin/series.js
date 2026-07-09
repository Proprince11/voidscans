// Admin: Series CRUD
import {
  fetchAllSeries, createSeries, updateSeries, deleteSeries, fetchSeriesBySlug, updateSeriesPublished
} from '../lib/api.js';
import { esc, html, slugify, timeAgo, proxyImage } from '../lib/utils.js';
import { toast, confirmModal, spinner } from '../lib/ui.js';
import { GENRES } from '../views/_components.js';
import { importFromMangaDex, importFromAniList } from './import.js';

const TYPES = ['manhwa', 'manga', 'manhua'];
const STATUSES = ['ongoing', 'completed', 'hiatus', 'dropped'];

export async function seriesAdmin({ outlet }) {
  let series = [];
  try { series = await fetchAllSeries({ limitTo: 500, includeUnpublished: true }); }
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
            <thead><tr><th></th><th>Title</th><th>Type</th><th>Status</th><th>Latest</th><th>Visibility</th><th class="actions"></th></tr></thead>
            <tbody>
              ${filtered.map(s => `
                <tr class="${s.published ? '' : 'row-draft'}">
                  <td><img class="admin-row-thumb" src="${esc(proxyImage(s.cover))}" alt="" loading="lazy"></td>
                  <td><strong>${esc(s.title)}</strong><br><small class="text-muted">/${esc(s.slug)}</small></td>
                  <td>${esc(s.type)}</td>
                  <td><span class="badge badge-${esc(s.status)}">${esc(s.status)}</span></td>
                  <td>${s.latestChapter > 0 ? 'Ch.' + esc(s.latestChapter) : '—'}</td>
                  <td>
                    <button class="pub-toggle ${s.published ? 'pub-toggle--live' : 'pub-toggle--draft'}" data-pub="${esc(s.id)}" data-pub-val="${s.published ? '1' : '0'}" title="Click to ${s.published ? 'hide (set to Draft)' : 'publish (make Live)'}">
                      ${s.published ? '🟢 Live' : '🔴 Draft'}
                    </button>
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
    outlet.querySelectorAll('[data-pub]').forEach(b => b.addEventListener('click', async () => {
      const isLive = b.dataset.pubVal === '1';
      const newVal = !isLive;
      b.disabled = true;
      b.textContent = '…';
      try {
        await updateSeriesPublished(b.dataset.pub, newVal);
        toast(newVal ? '🟢 Published' : '🔴 Set to Draft', 'success');
        series = await fetchAllSeries({ limitTo: 500, includeUnpublished: true });
        render();
      } catch (e) {
        toast('Toggle failed: ' + e.message, 'error');
        b.disabled = false;
        b.textContent = isLive ? '🟢 Live' : '🔴 Draft';
      }
    }));
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

      ${!id ? `
      <div class="admin-card" id="importCard" style="margin-bottom: var(--s-4); background: linear-gradient(135deg, var(--surface-1), var(--surface-2)); border-color: var(--accent-soft);">
        <div class="row gap-3" style="align-items: baseline; margin-bottom: var(--s-3); flex-wrap: wrap;">
          <h3 style="margin: 0;">Import metadata</h3>
          <span class="text-muted" style="font-size: var(--fs-xs);">Auto-fill from MangaDex or AniList — saves ~5 min per series</span>
        </div>
        <div class="row gap-2" style="margin-bottom: var(--s-3); flex-wrap: wrap;">
          <button type="button" class="tag-pill active" data-import-source="mangadex">📘 MangaDex</button>
          <button type="button" class="tag-pill" data-import-source="anilist">🟦 AniList</button>
        </div>
        <div class="row gap-2" style="flex-wrap: wrap;">
          <input class="input" id="importInput" placeholder="Paste MangaDex URL or UUID" style="flex: 1; min-width: 240px;" autocomplete="off">
          <button type="button" class="btn btn-primary" id="importBtn">Fetch</button>
        </div>
        <p class="field-hint" id="importHint" style="margin-top: var(--s-2);">Pulls title, cover, description, genres, author, year. You can edit any field before saving.</p>
      </div>
      ` : ''}

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
          <div class="row gap-2" style="align-items: center;">
            <input class="input" id="f-cover" type="url" required value="${esc(s?.cover || '')}" placeholder="https://r2.../cover.jpg" style="flex: 1;">
            <label class="btn btn-secondary" style="margin: 0; cursor: pointer; white-space: nowrap;">
              📁 Upload
              <input type="file" id="f-cover-upload" accept="image/*" style="display: none;">
            </label>
          </div>
        </div>
        <img id="f-cover-preview" src="${esc(proxyImage(s?.cover) || '')}" alt="" style="max-width: 160px; aspect-ratio: 2/3; object-fit: cover; border-radius: var(--r-sm); border: 1px solid var(--border); display: ${s?.cover ? 'block' : 'none'}; margin-bottom: var(--s-4);" onerror="this.style.display='none';">

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

        <div class="field" style="padding: var(--s-4); background: var(--surface-2); border-radius: var(--r-md); border: 2px solid ${(s?.published ?? true) ? 'var(--success, #22c55e)' : 'var(--warning, #f59e0b)'}; margin-top: var(--s-3);">
          <label class="row gap-3" style="cursor: pointer; align-items: center;">
            <input type="checkbox" id="f-published" ${(s?.published ?? true) ? 'checked' : ''} style="width: 18px; height: 18px;">
            <span>
              <strong id="f-pub-label">${(s?.published ?? true) ? '🟢 Published — visible to all readers' : '🔴 Draft — hidden from readers'}</strong><br>
              <span class="field-hint" style="margin-top: 2px; display: block;">Toggle off to hide this series without deleting it.</span>
            </span>
          </label>
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

    // ============================================================
    // COVER UPLOAD
    // ============================================================
    const coverUpload = $f('#f-cover-upload');
    if (coverUpload) {
      coverUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const btn = coverUpload.closest('.btn');
        const origText = btn.innerHTML;
        btn.innerHTML = 'Uploading…';
        btn.style.pointerEvents = 'none';
        
        try {
          const fd = new FormData();
          fd.append('file', file, file.name);
          fd.append('series', $f('#f-slug').value || 'new-series');
          const res = await adminFetch('/api/upload', { method: 'POST', body: fd });
          const json = await res.json();
          if (!json.ok) throw new Error(json.error || 'upload failed');
          
          $f('#f-cover').value = json.url;
          $f('#f-cover').dispatchEvent(new Event('input')); // update preview
          toast('Cover uploaded to R2', 'success');
        } catch (err) {
          console.error(err);
          toast('Cover upload failed: ' + err.message, 'error');
        } finally {
          btn.innerHTML = origText;
          btn.style.pointerEvents = 'auto';
          coverUpload.value = ''; // reset
        }
      });
    }

    // ============================================================
    // IMPORT widget — only on the "New Series" form (not edit)
    // ============================================================
    if (!id) {
      let importSource = 'mangadex';
      const importInput = $f('#importInput');
      const importBtn = $f('#importBtn');
      const importHint = $f('#importHint');

      const placeholders = {
        mangadex: 'Paste MangaDex URL or UUID — e.g. https://mangadex.org/title/abc-123-...',
        anilist: 'Paste AniList URL or numeric ID — e.g. https://anilist.co/manga/30013'
      };

      // Source toggle
      outlet.querySelectorAll('[data-import-source]').forEach(btn => {
        btn.addEventListener('click', () => {
          outlet.querySelectorAll('[data-import-source]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          importSource = btn.dataset.importSource;
          importInput.placeholder = placeholders[importSource];
          importHint.style.color = '';
          importHint.textContent = 'Pulls title, cover, description, genres, author, year. You can edit any field before saving.';
        });
      });

      async function runImport() {
        const value = importInput.value.trim();
        if (!value) {
          importHint.style.color = 'var(--danger)';
          importHint.textContent = 'Paste a URL or ID first.';
          return;
        }
        importBtn.disabled = true;
        importBtn.textContent = 'Fetching…';
        importHint.style.color = '';
        importHint.textContent = `Fetching from ${importSource}…`;
        try {
          const data = importSource === 'anilist'
            ? await importFromAniList(value)
            : await importFromMangaDex(value);

          // Fill the form fields
          $f('#f-title').value = data.title || '';
          $f('#f-slug').value = slugify(data.title || '');
          $f('#f-slug').dataset.touched = ''; // let title->slug auto-fill keep working if user retypes
          $f('#f-cover').value = data.cover || '';
          $f('#f-cover').dispatchEvent(new Event('input'));  // triggers cover preview
          $f('#f-type').value = data.type || 'manga';
          $f('#f-status').value = data.status || 'ongoing';
          $f('#f-author').value = data.author || '';
          $f('#f-artist').value = data.artist || '';
          $f('#f-year').value = data.year || '';
          $f('#f-alt').value = (data.altTitles || []).join(', ');
          $f('#f-tags').value = (data.tags || []).join(', ');
          $f('#f-desc').value = data.description || '';

          // Genre toggle pills
          const want = new Set((data.genres || []).map(g => g.toLowerCase()));
          $f('#f-genres').querySelectorAll('[data-genre]').forEach(btn => {
            const isMatch = want.has(btn.dataset.genre.toLowerCase());
            btn.classList.toggle('active', isMatch);
          });

          importHint.style.color = 'var(--success)';
          importHint.innerHTML = `✓ Imported "<strong>${esc(data.title)}</strong>" from ${data.source}. <a href="${esc(data.sourceUrl)}" target="_blank" rel="noopener" style="color: var(--accent);">View source ↗</a> · Review the form and click "Create Series".`;
          toast(`Imported: ${data.title}`, 'success');

          // Scroll to the form so user can review
          $f('#seriesForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (err) {
          console.error(err);
          importHint.style.color = 'var(--danger)';
          importHint.textContent = `✗ ${err.message}`;
          toast('Import failed', 'error');
        } finally {
          importBtn.disabled = false;
          importBtn.textContent = 'Fetch';
        }
      }

      importBtn.addEventListener('click', runImport);
      importInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); runImport(); }
      });
    }

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
      img.src = proxyImage(url);
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
        new: $f('#f-new').checked,
        published: $f('#f-published').checked
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
