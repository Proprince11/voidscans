// Admin: Chapters CRUD with drag-reorder pages + image preview
import {
  fetchAllSeries, fetchChapters, fetchChapter,
  createChapter, updateChapter, deleteChapter, updateChapterPublished
} from '../lib/api.js';
import { esc, html, timeAgo, proxyImage } from '../lib/utils.js';
import { toast, confirmModal, spinner } from '../lib/ui.js';
import { adminFetch } from '../lib/auth.js';
import { announceChapter } from '../lib/discord.js';

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
    chapters = await fetchChapters(selectedSlug, { includeUnpublished: true });
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
            <thead><tr><th>Ch</th><th>Title</th><th>Pages</th><th>Created</th><th>Status</th><th class="actions"></th></tr></thead>
            <tbody>
              ${chapters.map(c => `
                <tr class="${c.published ? '' : 'row-draft'}">
                  <td><strong>${esc(c.number)}</strong></td>
                  <td>${esc(c.title || '—')}</td>
                  <td class="text-muted">${esc(c.pages.length)}</td>
                  <td class="text-muted">${esc(c.createdAt?.toDate ? timeAgo(c.createdAt.toDate()) : '—')}</td>
                  <td>
                    <button class="pub-toggle ${c.published ? 'pub-toggle--live' : 'pub-toggle--draft'}" data-ch-pub="${esc(c.id)}" data-ch-pub-val="${c.published ? '1' : '0'}" title="Click to ${c.published ? 'set to Draft (hide)' : 'Publish (make Live)'}">
                      ${c.published ? '🟢 Live' : '🔴 Draft'}
                    </button>
                  </td>
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

    outlet.querySelectorAll('[data-ch-pub]').forEach(b => b.addEventListener('click', async () => {
      const isLive = b.dataset.chPubVal === '1';
      const newVal = !isLive;
      b.disabled = true;
      b.textContent = '…';
      try {
        await updateChapterPublished(b.dataset.chPub, newVal);
        toast(newVal ? '🟢 Chapter published' : '🔴 Chapter set to Draft', 'success');
        await render();
      } catch (e) {
        toast('Toggle failed: ' + e.message, 'error');
        b.disabled = false;
        b.textContent = isLive ? '🟢 Live' : '🔴 Draft';
      }
    }));
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
            <label class="field-label" for="ch-title">Chapter Name</label>
            <input class="input" id="ch-title" value="${esc(ch?.title || '')}" placeholder="e.g. The Raven Rises (saved with the chapter)">
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="ch-pages">Page URLs (one per line) *</label>
          <textarea class="textarea" id="ch-pages" rows="8" placeholder="https://files.catbox.moe/abc.jpg
https://i.ibb.co/xyz/page2.jpg
https://r2.cdn/page3.webp">${esc((ch?.pages || []).join('\n'))}</textarea>
          <span class="field-hint">Paste image URLs. Order matters (top = first page). Or use the helpers below to auto-fill.</span>
        </div>

        <!-- ============================================================ -->
        <!-- PAGE UPLOAD HELPERS — bulk file upload + webpage scraper      -->
        <!-- ============================================================ -->
        <div class="upload-helpers" id="uploadHelpers">
          <div class="row gap-3" style="align-items: baseline; margin-bottom: var(--s-3); flex-wrap: wrap;">
            <h4 style="margin: 0;">Page Upload Helpers</h4>
            <span class="text-muted" style="font-size: var(--fs-xs);">Auto-fill the URLs above</span>
          </div>
          <div class="row gap-2" style="margin-bottom: var(--s-4); flex-wrap: wrap;">
            <button type="button" class="tag-pill active" data-helper="bulk">📁 Bulk Upload Files</button>
            <button type="button" class="tag-pill" data-helper="scrape">🔗 Scrape from Webpage</button>
          </div>

          <!-- Bulk upload panel -->
          <div data-helper-panel="bulk">
            <label class="file-drop" id="bulkDrop">
              <input type="file" id="bulkFiles" multiple accept="image/*">
              <div>
                <strong>Drag &amp; drop chapter pages here</strong><br>
                <span class="field-hint">Or click to select multiple files. Files like <code>01.jpg, 02.jpg</code> are sorted naturally.</span>
              </div>
            </label>
            <div id="bulkProgress" style="margin-top: var(--s-4); display: none;">
              <div class="upload-bar"><div class="upload-bar-fill" id="bulkBarFill"></div></div>
              <p class="text-muted" id="bulkProgressText" style="margin-top: var(--s-2); font-size: var(--fs-xs);"></p>
            </div>
          </div>

          <!-- Scrape panel -->
          <div data-helper-panel="scrape" hidden>
            <div class="row gap-2" style="flex-wrap: wrap; margin-bottom: var(--s-3);">
              <input class="input" id="scrapeUrl" placeholder="Paste a chapter page URL (e.g. https://...)" style="flex: 1; min-width: 240px;">
              <button type="button" class="btn btn-primary" id="scrapeBtn">Scan</button>
            </div>
            <p class="field-hint" id="scrapeHint" style="margin-bottom: var(--s-3);">Enter a public URL with the chapter's images. We'll grab them server-side, then re-host to your storage.</p>
            <div id="scrapeResults" hidden></div>
          </div>
        </div>

        <div class="field">
          <label class="field-label">Page Preview · Drag to reorder · Click × to remove</label>
          <div class="image-preview-grid" id="ch-preview"></div>
        </div>

        <div class="row gap-3" style="margin-top: var(--s-3); padding: var(--s-4); background: var(--surface-2); border-radius: var(--r-md); border: 2px solid ${(ch?.published ?? true) ? 'var(--success, #22c55e)' : 'var(--warning, #f59e0b)'}; margin-bottom: var(--s-3);">
          <label class="row gap-3" style="cursor: pointer; align-items: center; flex: 1;">
            <input type="checkbox" id="ch-published" ${(ch?.published ?? true) ? 'checked' : ''} style="width: 18px; height: 18px;">
            <span>
              <strong>${(ch?.published ?? true) ? '🟢 Published — visible to readers' : '🔴 Draft — hidden from readers'}</strong><br>
              <span class="field-hint" style="margin-top: 2px; display: block;">Uncheck to save as draft (you can publish later).</span>
            </span>
          </label>
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
          <img src="${esc(proxyImage(url))}" alt="Page ${i + 1}" loading="lazy" onerror="this.style.background='var(--surface-3)';this.removeAttribute('src');">
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

    // ============================================================
    // PAGE UPLOAD HELPERS — bulk upload + webpage scraper
    // ============================================================
    function appendUrls(urls) {
      const cur = getPages();
      const merged = [...cur, ...urls.filter(Boolean)];
      setPages(merged);
    }

    // Helper-tab toggle
    outlet.querySelectorAll('[data-helper]').forEach(btn => {
      btn.addEventListener('click', () => {
        outlet.querySelectorAll('[data-helper]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const which = btn.dataset.helper;
        outlet.querySelectorAll('[data-helper-panel]').forEach(p => {
          p.hidden = (p.dataset.helperPanel !== which);
        });
      });
    });

    // -------- Bulk upload --------
    const bulkInput = $f('#bulkFiles');
    const bulkDrop = $f('#bulkDrop');
    const progEl = $f('#bulkProgress');
    const progFill = $f('#bulkBarFill');
    const progText = $f('#bulkProgressText');

    function naturalSort(a, b) {
      // Natural sort so "10.jpg" comes after "9.jpg"
      return String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: 'base' });
    }

    async function uploadFiles(fileList) {
      const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
      if (!files.length) { toast('No image files', 'error'); return; }
      files.sort(naturalSort);

      progEl.style.display = 'block';
      progFill.style.width = '0%';
      progText.textContent = `0 of ${files.length} uploaded`;

      const newUrls = [];
      let i = 0;
      for (const file of files) {
        i++;
        try {
          const fd = new FormData();
          fd.append('file', file, file.name);
          fd.append('series', selectedSlug);
          fd.append('chapter', String($f('#ch-num').value || ''));
          const res = await adminFetch('/api/upload', { method: 'POST', body: fd });
          const json = await res.json();
          if (!json.ok) throw new Error(json.error || 'upload failed');
          newUrls.push(json.url);
          progFill.style.width = `${Math.round((i / files.length) * 100)}%`;
          progText.textContent = `${i} of ${files.length} uploaded · last: ${file.name}`;
        } catch (err) {
          progFill.style.width = `${Math.round((i / files.length) * 100)}%`;
          progText.textContent = `${i} of ${files.length} — failed on ${file.name}: ${err.message}`;
        }
      }

      if (newUrls.length) {
        appendUrls(newUrls);
        toast(`Uploaded ${newUrls.length} of ${files.length}`, newUrls.length === files.length ? 'success' : 'info');
      }
      if (newUrls.length < files.length) {
        progText.textContent += ` · ${files.length - newUrls.length} failed`;
      }
      // reset input for next batch
      bulkInput.value = '';
    }

    bulkInput?.addEventListener('change', (e) => uploadFiles(e.target.files));
    if (bulkDrop) {
      ['dragenter', 'dragover'].forEach(evt =>
        bulkDrop.addEventListener(evt, (e) => {
          e.preventDefault(); e.stopPropagation();
          bulkDrop.classList.add('dragover');
        }));
      ['dragleave', 'drop'].forEach(evt =>
        bulkDrop.addEventListener(evt, (e) => {
          e.preventDefault(); e.stopPropagation();
          bulkDrop.classList.remove('dragover');
        }));
      bulkDrop.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt?.files?.length) uploadFiles(dt.files);
      });
    }

    // -------- Webpage scraper --------
    const scrapeUrlInput = $f('#scrapeUrl');
    const scrapeBtn = $f('#scrapeBtn');
    const scrapeHint = $f('#scrapeHint');
    const scrapeResults = $f('#scrapeResults');

    let scrapedImages = [];

    async function runScrape() {
      const url = scrapeUrlInput.value.trim();
      if (!url) { scrapeHint.style.color = 'var(--danger)'; scrapeHint.textContent = 'Paste a URL first.'; return; }
      scrapeBtn.disabled = true;
      scrapeBtn.textContent = 'Scanning…';
      scrapeHint.style.color = '';
      scrapeHint.textContent = 'Fetching page server-side…';
      try {
        const res = await adminFetch(`/api/scrape?url=${encodeURIComponent(url)}`);
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'scrape failed');
        scrapedImages = json.images || [];
        if (!scrapedImages.length) {
          scrapeResults.hidden = true;
          scrapeHint.style.color = 'var(--warning)';
          scrapeHint.textContent = `Found 0 images on that page. Page title: ${json.title || '—'}`;
          return;
        }
        scrapeHint.style.color = 'var(--success)';
        scrapeHint.innerHTML = `Found <strong>${json.imageCount}</strong> images${json.title ? ` on "${esc(json.title)}"` : ''}. Review below, then "Use Selected".`;
        renderScrapeResults();
        scrapeResults.hidden = false;
      } catch (err) {
        scrapeResults.hidden = true;
        scrapeHint.style.color = 'var(--danger)';
        scrapeHint.textContent = `✗ ${err.message}`;
      } finally {
        scrapeBtn.disabled = false;
        scrapeBtn.textContent = 'Scan';
      }
    }

    function renderScrapeResults() {
      scrapeResults.innerHTML = `
        <div class="row gap-2" style="margin-bottom: var(--s-3); flex-wrap: wrap;">
          <button type="button" class="btn btn-ghost btn-sm" data-scrape-act="all">Select all</button>
          <button type="button" class="btn btn-ghost btn-sm" data-scrape-act="none">Select none</button>
          <span class="nav-spacer"></span>
          <button type="button" class="btn btn-primary" id="useSelectedBtn">Use Selected → Re-host & Append</button>
        </div>
        <div class="image-preview-grid" id="scrapeGrid">
          ${scrapedImages.map((u, i) => `
            <label class="image-preview-item" style="cursor: pointer; outline: 2px solid var(--accent);">
              <input type="checkbox" data-scrape-idx="${i}" checked style="position: absolute; top: 6px; right: 6px; z-index: 2; width: 18px; height: 18px;">
              <span class="index">${i + 1}</span>
              <img src="${esc(proxyImage(u))}" alt="Page ${i + 1}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.background='var(--surface-3)';this.removeAttribute('src');">
              <button type="button" class="remove" data-scrape-remove="${i}" aria-label="Remove image" title="Remove" style="bottom: 4px; top: auto;">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </label>
          `).join('')}
        </div>
      `;
      scrapeResults.querySelectorAll('[data-scrape-remove]').forEach(b => b.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        scrapedImages.splice(Number(b.dataset.scrapeRemove), 1);
        if (scrapedImages.length) { renderScrapeResults(); }
        else { scrapeResults.hidden = true; scrapeHint.textContent = 'All images removed.'; }
      }));
      scrapeResults.querySelectorAll('[data-scrape-act]').forEach(b => b.addEventListener('click', () => {
        const want = b.dataset.scrapeAct === 'all';
        scrapeResults.querySelectorAll('[data-scrape-idx]').forEach(cb => cb.checked = want);
        scrapeResults.querySelectorAll('.image-preview-item').forEach(it => {
          it.style.outline = want ? '2px solid var(--accent)' : 'none';
        });
      }));
      scrapeResults.querySelectorAll('[data-scrape-idx]').forEach(cb => {
        cb.addEventListener('change', () => {
          cb.closest('.image-preview-item').style.outline = cb.checked ? '2px solid var(--accent)' : 'none';
        });
      });
      scrapeResults.querySelector('#useSelectedBtn').addEventListener('click', useSelected);
    }

    async function useSelected() {
      const selected = [...scrapeResults.querySelectorAll('[data-scrape-idx]')]
        .filter(cb => cb.checked)
        .map(cb => scrapedImages[Number(cb.dataset.scrapeIdx)])
        .filter(Boolean);
      if (!selected.length) { toast('Select at least one image', 'error'); return; }

      const useBtn = scrapeResults.querySelector('#useSelectedBtn');
      useBtn.disabled = true;
      useBtn.textContent = `Re-hosting 0 / ${selected.length}…`;
      scrapeHint.style.color = '';
      scrapeHint.textContent = `Re-hosting ${selected.length} images via Worker → Catbox/R2…`;

      try {
        const res = await adminFetch('/api/scrape-rehost', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            urls: selected,
            series: selectedSlug,
            chapter: String($f('#ch-num').value || '')
          })
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'rehost failed');
        const okUrls = json.results.filter(r => r.ok).map(r => r.url);
        const failed = json.results.filter(r => !r.ok).length;
        if (okUrls.length) appendUrls(okUrls);
        scrapeHint.style.color = failed ? 'var(--warning)' : 'var(--success)';
        scrapeHint.textContent = `✓ Re-hosted ${okUrls.length} of ${selected.length}${failed ? ` · ${failed} failed` : ''}. Pages added to the textarea above.`;
        toast(`Added ${okUrls.length} pages`, 'success');
      } catch (err) {
        scrapeHint.style.color = 'var(--danger)';
        scrapeHint.textContent = `✗ ${err.message}`;
      } finally {
        useBtn.disabled = false;
        useBtn.textContent = 'Use Selected → Re-host & Append';
      }
    }

    scrapeBtn?.addEventListener('click', runScrape);
    scrapeUrlInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); runScrape(); }
    });

    $f('#backBtn').addEventListener('click', () => render());
    $f('#cancelBtn').addEventListener('click', () => render());

    $f('#chForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const number = Number($f('#ch-num').value);
      const title = $f('#ch-title').value.trim();
      const pages = getPages();
      const published = $f('#ch-published').checked;
      if (!number) { toast('Chapter number required', 'error'); return; }
      if (pages.length === 0) { toast('Add at least one page', 'error'); return; }

      $f('#saveBtn').disabled = true;
      $f('#saveBtn').textContent = 'Saving…';
      try {
        if (id) {
          await updateChapter(id, { number, title, pages, published });
          toast('Updated', 'success');
        } else {
          await createChapter({ seriesSlug: selectedSlug, number, title, pages, published });
          // Only fire Discord announcement if publishing immediately
          if (published) {
            toast(`Chapter ${number} published`, 'success');
          } else {
            toast(`Chapter ${number} saved as draft`, 'info');
          }
          // Fire Discord webhook only when publishing immediately (not for drafts)
          if (published) {
            const seriesMeta = allSeries.find(s => s.slug === selectedSlug);
            announceChapter({
              seriesTitle: seriesMeta?.title || selectedSlug,
              seriesSlug: selectedSlug,
              chapterNum: number,
              chapterTitle: title,
              coverUrl: seriesMeta?.cover || ''
            }).then(r => {
              if (r?.ok) toast('Posted to Discord', 'info', 2500);
              else if (r?.error) console.warn('Discord webhook:', r.error);
            });
          }
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
