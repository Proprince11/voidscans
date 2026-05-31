// =====================================================
// Admin: Tools — image extractor (URL → curated ZIP) + storage info
// =====================================================

import { esc, html } from '../lib/utils.js';
import { toast } from '../lib/ui.js';

export async function toolsAdmin({ outlet }) {
  outlet.innerHTML = html`
    <header class="admin-header">
      <h1>Tools</h1>
      <span class="text-muted" style="font-size: var(--fs-sm);">Image extractor &amp; storage diagnostics</span>
    </header>

    <!-- ============ Image Extractor ============ -->
    <div class="admin-card" style="margin-bottom: var(--s-5); border-color: var(--accent-soft);">
      <h3 style="margin-bottom: var(--s-2);">📦 Image Extractor</h3>
      <p class="text-muted" style="font-size: var(--fs-sm); margin-bottom: var(--s-4);">
        Paste any webpage URL → <strong>Scan</strong> to preview every image found.
        Remove the ones you don't want (×) or drag to reorder, then
        <strong>Download ZIP</strong> — only the images you kept are bundled,
        renamed <code>001.jpg, 002.jpg…</code> in your chosen order.
      </p>

      <div class="row gap-2" style="flex-wrap: wrap; margin-bottom: var(--s-3);">
        <input class="input" id="extractUrl"
               placeholder="https://example.com/manga-chapter-14"
               style="flex: 1; min-width: 280px;" autocomplete="off">
        <button type="button" class="btn btn-primary" id="scanBtn">Scan</button>
      </div>
      <p class="field-hint" id="extractHint">
        Up to 100 images per ZIP. Works on any public webpage with images.
      </p>

      <div id="extractToolbar" hidden style="margin-top: var(--s-4);">
        <div class="row gap-2" style="flex-wrap: wrap; align-items: center;">
          <span class="text-muted" style="font-size: var(--fs-sm);" id="keptCount"></span>
          <span class="nav-spacer"></span>
          <input class="input" id="zipName" placeholder="zip filename (optional)" style="max-width: 200px;">
          <button type="button" class="btn btn-primary" id="downloadBtn">Download ZIP</button>
        </div>
      </div>
      <div id="extractPreview" hidden style="margin-top: var(--s-3);"></div>
    </div>

    <!-- ============ Storage Backend ============ -->
    <div class="admin-card" style="margin-bottom: var(--s-5);">
      <h3 style="margin-bottom: var(--s-2);">🗄 Storage Backend</h3>
      <p class="text-muted" style="font-size: var(--fs-sm); margin-bottom: var(--s-3);">
        Where chapter pages and covers get uploaded (bulk uploader / scraper re-host).
        Uploads <strong>fail over</strong> automatically down the chain, so one host being
        down never loses a page.
      </p>
      <div id="storageInfo" style="font-size: var(--fs-sm);">Checking…</div>
      <details style="margin-top: var(--s-4);">
        <summary style="cursor: pointer; color: var(--accent); font-size: var(--fs-sm);">Storage options &amp; how to configure</summary>
        <div style="margin-top: var(--s-3); padding: var(--s-3); background: var(--surface-2); border-radius: var(--r-sm); font-size: var(--fs-sm); line-height: 1.7;">
          <p><strong>Catbox (default · recommended for scanlation):</strong> anonymous, lossless (keeps your original image), and separate from your Cloudflare account — so a DMCA strike on an image can't take down your whole site. No setup needed.</p>
          <p style="margin-top: var(--s-2);"><strong>ImgBB (automatic backup):</strong> add a free key (<a href="https://api.imgbb.com/" target="_blank" rel="noopener" style="color:var(--accent);">api.imgbb.com</a>, no card) so that if Catbox ever fails, a page still gets hosted instead of lost. Cloudflare → Workers → <code>voidscans</code> → Settings → Variables → add <code>IMGBB_API_KEY</code> → Encrypt → Save. <em>Note: ImgBB may re-compress, so it's backup-only.</em></p>
          <p style="margin-top: var(--s-2);"><strong>R2 (opt-in only):</strong> lives inside your Cloudflare account, so it shares DMCA exposure with the main site — <strong>off by default</strong>. To force it: set env var <code>STORAGE_PRIMARY=r2</code> plus the R2 bucket binding.</p>
          <p style="margin-top: var(--s-2);">Change priority any time with the <code>STORAGE_PRIMARY</code> env var: <code>catbox</code> (default) · <code>imgbb</code> · <code>r2</code>.</p>
        </div>
      </details>
    </div>
  `;

  const $ = (s) => document.querySelector(s);
  const urlInput = $('#extractUrl');
  const scanBtn = $('#scanBtn');
  const downloadBtn = $('#downloadBtn');
  const hint = $('#extractHint');
  const preview = $('#extractPreview');
  const toolbar = $('#extractToolbar');
  const keptCount = $('#keptCount');

  let images = [];   // current curated list of image URLs

  // -------- Storage info --------
  fetch('/api/storage-info')
    .then(r => r.json())
    .then(j => {
      const primary = j.primary || 'catbox';
      const cls = primary === 'r2' ? 'badge-completed' : (primary === 'imgbb' ? 'badge-ongoing' : 'badge-hot');
      $('#storageInfo').innerHTML = `
        <div class="row gap-2" style="align-items: center; flex-wrap: wrap; margin-bottom: var(--s-2);">
          <span>Primary:</span>
          <span class="badge ${cls}">${esc(primary)}</span>
          <span class="text-muted" style="font-size: var(--fs-xs);">failover chain: ${esc((j.chain || []).join(' → '))}</span>
        </div>
        <div class="text-muted" style="font-size: var(--fs-xs);">
          Catbox: ✅ always available ·
          ImgBB: ${j.available?.imgbb ? '✅ backup configured' : '⚪ no key (backup off)'} ·
          R2: ${j.available?.r2 ? '✅ configured' : '⚪ off'}
        </div>
        ${!j.available?.imgbb ? `<p style="margin-top: var(--s-3); padding: var(--s-3); background: rgba(96,165,250,0.08); border: 1px solid var(--info); border-radius: var(--r-sm); font-size: var(--fs-sm); color: var(--text-soft);">💡 Catbox is your primary (lossless + DMCA-safe). Add an <strong>ImgBB key</strong> as automatic backup so a page is never lost if Catbox hiccups — see options below.</p>` : ''}
      `;
    })
    .catch(() => { $('#storageInfo').textContent = 'Could not check (Worker may not be deployed yet)'; });

  // -------- Scan --------
  async function runScan() {
    const url = urlInput.value.trim();
    if (!url) { hint.style.color = 'var(--danger)'; hint.textContent = 'Paste a URL first.'; return; }
    scanBtn.disabled = true; scanBtn.textContent = 'Scanning…';
    hint.style.color = ''; hint.textContent = 'Fetching page server-side…';
    try {
      const res = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'scrape failed');
      images = json.images || [];
      hint.style.color = 'var(--success)';
      hint.innerHTML = `Found <strong>${json.imageCount}</strong> images${json.title ? ` on "${esc(json.title)}"` : ''}. Curate below.`;
      // Prefill zip name from URL
      try {
        const u = new URL(url);
        $('#zipName').value = (u.hostname.replace(/^www\./, '') + '-' + u.pathname.split('/').filter(Boolean).slice(-1)[0] || 'images')
          .replace(/[^a-z0-9-_]/gi, '_').slice(0, 50);
      } catch {}
      renderPreview();
    } catch (err) {
      hint.style.color = 'var(--danger)';
      hint.textContent = `✗ ${err.message}`;
      preview.hidden = true; toolbar.hidden = true;
    } finally {
      scanBtn.disabled = false; scanBtn.textContent = 'Scan';
    }
  }

  function renderPreview() {
    if (!images.length) {
      preview.hidden = true; toolbar.hidden = true;
      hint.style.color = 'var(--warning)';
      hint.textContent = 'No images left. Scan again or remove fewer.';
      return;
    }
    toolbar.hidden = false;
    preview.hidden = false;
    keptCount.innerHTML = `<strong>${images.length}</strong> image${images.length === 1 ? '' : 's'} kept`;
    preview.innerHTML = `
      <div class="image-preview-grid" id="extractGrid">
        ${images.map((u, i) => `
          <div class="image-preview-item" draggable="true" data-idx="${i}">
            <span class="index">${i + 1}</span>
            <img src="/api/proxy-image?url=${encodeURIComponent(u)}" alt="${i + 1}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.background='var(--surface-3)';this.removeAttribute('src');">
            <button type="button" class="remove" data-remove="${i}" aria-label="Remove image" title="Remove">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        `).join('')}
      </div>
    `;
    wireGrid();
  }

  function wireGrid() {
    const grid = $('#extractGrid');
    // Remove
    grid.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation();
      images.splice(Number(b.dataset.remove), 1);
      renderPreview();
    }));
    // Drag reorder
    let dragIdx = null;
    grid.querySelectorAll('.image-preview-item').forEach(el => {
      el.addEventListener('dragstart', () => { dragIdx = Number(el.dataset.idx); el.classList.add('dragging'); });
      el.addEventListener('dragend', () => { el.classList.remove('dragging'); dragIdx = null; });
      el.addEventListener('dragover', (e) => e.preventDefault());
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        if (dragIdx === null) return;
        const target = Number(el.dataset.idx);
        const [moved] = images.splice(dragIdx, 1);
        images.splice(target, 0, moved);
        renderPreview();
      });
    });
  }

  // -------- Download (only kept images, in order) --------
  async function runDownload() {
    if (!images.length) { toast('Nothing to download', 'error'); return; }
    downloadBtn.disabled = true; downloadBtn.textContent = 'Bundling…';
    hint.style.color = '';
    hint.textContent = `Bundling ${images.length} images server-side…`;
    try {
      const res = await fetch('/api/zip-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: images, name: $('#zipName').value.trim() || 'images' })
      });
      if (!res.ok) { throw new Error((await res.text()).slice(0, 200)); }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const cd = res.headers.get('content-disposition') || '';
      const filename = cd.match(/filename="?([^"]+)"?/)?.[1] || 'images.zip';
      const a = document.createElement('a');
      a.href = blobUrl; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      const count = res.headers.get('x-image-count') || images.length;
      hint.style.color = 'var(--success)';
      hint.innerHTML = `✓ Downloaded <strong>${esc(filename)}</strong> · ${esc(count)} images · ${(blob.size / 1024 / 1024).toFixed(1)} MB.`;
      toast('ZIP downloaded', 'success');
    } catch (err) {
      hint.style.color = 'var(--danger)';
      hint.textContent = `✗ ${err.message}`;
    } finally {
      downloadBtn.disabled = false; downloadBtn.textContent = 'Download ZIP';
    }
  }

  scanBtn.addEventListener('click', runScan);
  downloadBtn.addEventListener('click', runDownload);
  urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runScan(); } });
}
