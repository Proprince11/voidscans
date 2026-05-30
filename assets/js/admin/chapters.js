// Admin: Chapters CRUD with drag-reorder pages + image preview
import {
  fetchAllSeries, fetchChapters, fetchChapter,
  createChapter, updateChapter, deleteChapter
} from '../lib/api.js';
import { esc, html, timeAgo } from '../lib/utils.js';
import { toast, confirmModal, spinner } from '../lib/ui.js';

export async function chaptersAdmin({ outlet }) {
  let allSeries;
  try { allSeries = await fetchAllSeries({ limitTo: 500 }); }
  catch (e) { outlet.innerHTML = `<p>Failed to load series: ${esc(e.message)}</p>`; return; }

  if (allSeries.length === 0) {
    outlet.innerHTML = html`
      <header class="admin-header"><h1>Chapters</h1></header>
      <div class="admin-card">
        <p class="text-muted">No series yet. Create a series first, then add chapters to it.</p>
        <a href="#series" class="btn btn-primary" style="margin-top: var(--s-3);">+ Create Series</a>
      </div>
    `;
    return;
  }

  let selectedSlug = allSeries[0].slug;
  let chapters = [];
  let editingId = null;

  async function loadChapters() {
    chapters = await fetchChapters(selectedSlug);
    chapters.sort((a, b) => b.number - a.number);
  }

  async function render() {
    await loadChapters();
    outlet.innerHTML = html`
      <header class="admin-header">
        <h1>Chapters</h1>
        <button class="btn btn-primary" id="newChBtn">+ New Chapter</button>
      </header>

      <div class="admin-card" style="margin-bottom: var(--s-4);">
        <label class="field-label">Select Series</label>
        <select class="select" id="seriesSelect" style="margin-top: var(--s-2);">
          ${allSeries.map(s => `<option value="${esc(s.slug)}" ${s.slug === selectedSlug ? 'selected' : ''}>${esc(s.title)} (${s.latestChapter || 0} chapters)</option>`).join('')}
        </select>
      </div>

      <div class="admin-card">
        ${chapters.length === 0 ? `<p class="text-muted">No chapters yet for this series.</p>` : `
          <table class="admin-table">
            <thead><tr><th>Ch</th><th>Title</th><th>Pages</th><th>Created</th><th class="actions"></th></tr></thead>
            <tbody>
              ${chapters.map(c => `
                <tr>
                  <td><strong>${esc(c.number)}</strong></td>
                  <td>${esc(c.title || '—')}</td>
                  <td class="text-muted">${esc(c.pages.length)}</td>
                  <td class="text-muted">${esc(c.createdAt?.toDate ? timeAgo(c.createdAt.toDate()) : '—')}</td>
                  <td class="actions">
                    <a href="/read/${esc(selectedSlug)}/${esc(c.number)}" target="_blank" rel="noopener" class="icon-btn btn-sm" title="View">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </a>
                    <button class="icon-btn btn-sm" data-edit="${esc(c.id)}" title="Edit">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                    </button>
                    <button class="icon-btn btn-sm" data-del="${esc(c.id)}" title="Delete" style="color: var(--danger);">
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

    document.getElementById('seriesSelect').addEventListener('change', async (e) => {
      selectedSlug = e.target.value;
      await render();
    });

    document.getElementById('newChBtn').addEventListener('click', () => openForm(null));
    outlet.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openForm(b.dataset.edit)));
    outlet.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      const ok = await confirmModal({ title: 'Delete chapter?', message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true });
      if (!ok) return;
      try {
        await deleteChapter(b.dataset.del, selectedSlug);
        toast('Deleted', 'success');
        await render();
      } catch (e) {
        toast('Delete failed: ' + e.message, 'error');
      }
    }));
  }

  function openForm(id) {
    editingId = id;
    const ch = id ? chapters.find(c => c.id === id) : null;
    const nextNum = chapters.length > 0 ? Math.max(...chapters.map(c => c.number)) + 1 : 1;

    outlet.innerHTML = html`
      <header class="admin-header">
        <h1>${id ? 'Edit Chapter' : 'New Chapter'}</h1>
        <button class="btn btn-ghost" id="backBtn">← Back to list</button>
      </header>

      <form class="admin-card" id="chForm">
        <div class="field">
          <label class="field-label">Series</label>
          <input class="input" value="${esc(allSeries.find(s => s.slug === selectedSlug)?.title || selectedSlug)}" disabled>
        </div>

        <div class="field-row">
          <div class="field">
            <label class="field-label" for="ch-num">Chapter Number *</label>
            <input class="input" id="ch-num" type="number" required min="0" step="1" value="${esc(ch?.number ?? nextNum)}">
          </div>
          <div class="field">
            <label class="field-label" for="ch-title">Chapter Title</label>
            <input class="input" id="ch-title" value="${esc(ch?.title || '')}" placeholder="The Raven Rises">
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="ch-pages">Page URLs (one per line) *</label>
          <textarea class="textarea" id="ch-pages" rows="8" placeholder="https://files.catbox.moe/abc.jpg
https://i.ibb.co/xyz/page2.jpg
https://r2.cdn/page3.webp">${esc((ch?.pages || []).join('\n'))}</textarea>
          <span class="field-hint">Paste image URLs. Order matters (top = first page).</span>
        </div>

        <div class="field">
          <label class="field-label">Page Preview · Drag to reorder · Click × to remove</label>
          <div class="image-preview-grid" id="ch-preview"></div>
        </div>

        <div class="row gap-3" style="margin-top: var(--s-5);">
          <button type="submit" class="btn btn-primary" id="saveBtn">${id ? 'Save Changes' : 'Publish Chapter'}</button>
          <button type="button" class="btn btn-ghost" id="cancelBtn">Cancel</button>
        </div>
      </form>
    `;

    const $f = (sel) => document.querySelector(sel);
    const ta = $f('#ch-pages');
    const grid = $f('#ch-preview');

    function getPages() {
      return ta.value.split('\n').map(x => x.trim()).filter(Boolean);
    }
    function setPages(arr) {
      ta.value = arr.join('\n');
      paintPreview();
    }
    function paintPreview() {
      const pages = getPages();
      grid.innerHTML = pages.map((url, i) => `
        <div class="image-preview-item" draggable="true" data-idx="${i}">
          <span class="index">${i + 1}</span>
          <img src="${esc(url)}" alt="Page ${i + 1}" loading="lazy" onerror="this.style.background='var(--surface-3)';this.removeAttribute('src');">
          <button type="button" class="remove" data-remove="${i}" aria-label="Remove">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `).join('');
      wireDrag();
      grid.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => {
        const arr = getPages();
        arr.splice(Number(b.dataset.remove), 1);
        setPages(arr);
      }));
    }

    let dragIdx = null;
    function wireDrag() {
      grid.querySelectorAll('.image-preview-item').forEach(el => {
        el.addEventListener('dragstart', (e) => {
          dragIdx = Number(el.dataset.idx);
          el.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
        });
        el.addEventListener('dragend', () => {
          el.classList.remove('dragging');
          dragIdx = null;
        });
        el.addEventListener('dragover', (e) => { e.preventDefault(); });
        el.addEventListener('drop', (e) => {
          e.preventDefault();
          if (dragIdx === null) return;
          const targetIdx = Number(el.dataset.idx);
          const arr = getPages();
          const [moved] = arr.splice(dragIdx, 1);
          arr.splice(targetIdx, 0, moved);
          setPages(arr);
        });
      });
    }

    ta.addEventListener('input', paintPreview);
    paintPreview();

    $f('#backBtn').addEventListener('click', () => render());
    $f('#cancelBtn').addEventListener('click', () => render());

    $f('#chForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const number = Number($f('#ch-num').value);
      const title = $f('#ch-title').value.trim();
      const pages = getPages();
      if (!number) { toast('Chapter number required', 'error'); return; }
      if (pages.length === 0) { toast('Add at least one page', 'error'); return; }

      $f('#saveBtn').disabled = true;
      $f('#saveBtn').textContent = 'Saving…';
      try {
        if (id) {
          await updateChapter(id, { number, title, pages });
          toast('Updated', 'success');
        } else {
          await createChapter({ seriesSlug: selectedSlug, number, title, pages });
          toast(`Chapter ${number} published`, 'success');
        }
        await render();
      } catch (err) {
        console.error(err);
        toast('Save failed: ' + err.message, 'error');
        $f('#saveBtn').disabled = false;
        $f('#saveBtn').textContent = id ? 'Save Changes' : 'Publish Chapter';
      }
    });
  }

  await render();
}
