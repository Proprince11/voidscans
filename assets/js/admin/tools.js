// =====================================================
// Admin: Tools — image extractor (URL → ZIP) + storage info
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
        Paste any webpage URL. The Worker fetches it server-side, extracts every image,
        bundles them into a ZIP file, and downloads it to your computer.
        Files are renamed <code>001.jpg</code>, <code>002.jpg</code>, … in order of appearance.
      </p>

      <div class="row gap-2" style="flex-wrap: wrap; margin-bottom: var(--s-3);">
        <input class="input" id="extractUrl"
               placeholder="https://example.com/manga-chapter-14"
               style="flex: 1; min-width: 280px;" autocomplete="off">
        <button type="button" class="btn btn-ghost" id="previewBtn">Preview</button>
        <button type="button" class="btn btn-primary" id="downloadBtn">Download ZIP</button>
      </div>
      <p class="field-hint" id="extractHint">
        Up to 100 images per ZIP. Works on any public webpage with images.
      </p>

      <div id="extractPreview" hidden style="margin-top: var(--s-4);"></div>
    </div>

    <!-- ============ Storage Backend ============ -->
    <div class="admin-card" style="margin-bottom: var(--s-5);">
      <h3 style="margin-bottom: var(--s-2);">🗄 Storage Backend</h3>
      <p class="text-muted" style="font-size: var(--fs-sm); margin-bottom: var(--s-3);">
        Where chapter pages and covers get uploaded when you use the bulk uploader or scraper.
      </p>
      <div id="storageInfo" style="font-size: var(--fs-sm);">Checking…</div>
      <details style="margin-top: var(--s-4);">
        <summary style="cursor: pointer; color: var(--accent); font-size: var(--fs-sm);">How to set up ImgBB (recommended) or R2</summary>
        <div style="margin-top: var(--s-3); padding: var(--s-3); background: var(--surface-2); border-radius: var(--r-sm); font-size: var(--fs-sm);">
          <p><strong>ImgBB (free, no card):</strong></p>
          <ol style="padding-left: var(--s-5); margin: var(--s-2) 0;">
            <li>Get a free API key at <a href="https://api.imgbb.com/" target="_blank" rel="noopener" style="color:var(--accent);">api.imgbb.com</a></li>
            <li>Cloudflare Dashboard → Workers &amp; Pages → <code>voidscans</code> → <strong>Settings</strong> → <strong>Variables</strong></li>
            <li>Add variable: name <code>IMGBB_API_KEY</code>, paste your key as the value, click <strong>Encrypt</strong> (so it's a secret), then <strong>Save and deploy</strong></li>
            <li>Refresh this page — backend should switch from <em>catbox</em> to <em>imgbb</em></li>
          </ol>
          <p style="margin-top: var(--s-3);"><strong>R2 (best, requires card on Cloudflare):</strong></p>
          <ol style="padding-left: var(--s-5); margin: var(--s-2) 0;">
            <li>Cloudflare → R2 → create bucket <code>voidscans-images</code></li>
            <li>Bucket Settings → enable Public Access via R2.dev subdomain. Note the <code>https://pub-XXX.r2.dev</code> URL.</li>
            <li>In <code>wrangler.jsonc</code> add: <br><code>"r2_buckets": [{ "binding": "R2_BUCKET", "bucket_name": "voidscans-images" }]</code></li>
            <li>In <code>vars</code> add <code>R2_PUBLIC_BASE: "https://pub-XXX.r2.dev"</code></li>
            <li>Push, redeploy. The Worker auto-switches to R2.</li>
          </ol>
        </div>
      </details>
    </div>
  `;

  const $ = (s) => document.querySelector(s);
  const urlInput = $('#extractUrl');
  const previewBtn = $('#previewBtn');
  const downloadBtn = $('#downloadBtn');
  const hint = $('#extractHint');
  const preview = $('#extractPreview');

  // -------- Storage info --------
  fetch('/api/storage-info')
    .then(r => r.json())
    .then(j => {
      const cls = j.backend === 'r2' ? 'badge-completed' : (j.backend === 'imgbb' ? 'badge-ongoing' : 'badge-hiatus');
      $('#storageInfo').innerHTML = `
        <div class="row gap-2" style="align-items: center; flex-wrap: wrap; margin-bottom: var(--s-2);">
          <span>Active backend:</span>
          <span class="badge ${cls}">${esc(j.backend)}</span>
        </div>
        <div class="text-muted" style="font-size: var(--fs-xs);">
          R2: ${j.r2 ? '✅ configured' : '❌ not configured'} ·
          ImgBB: ${j.imgbb ? '✅ configured' : '❌ not configured'} ·
          Catbox: ✅ available (last-resort fallback)
        </div>
        ${!j.r2 && !j.imgbb ? `<p style="margin-top: var(--s-3); padding: var(--s-3); background: rgba(251, 191, 36, 0.1); border: 1px solid var(--warning); border-radius: var(--r-sm); font-size: var(--fs-sm); color: var(--warning);">⚠️ Currently using <strong>Catbox</strong> as fallback. It works but can be flaky. Set up ImgBB (free, 30 sec) for better reliability — see expandable section below.</p>` : ''}
      `;
    })
    .catch(() => {
      $('#storageInfo').textContent = 'Could not check (Worker may not be deployed yet)';
    });

  // -------- Preview --------
  async function runPreview() {
    const url = urlInput.value.trim();
    if (!url) { hint.style.color = 'var(--danger)'; hint.textContent = 'Paste a URL first.'; return; }
    previewBtn.disabled = true; previewBtn.textContent = 'Scanning…';
    hint.style.color = ''; hint.textContent = 'Fetching page server-side…';
    try {
      const res = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'scrape failed');
      hint.style.color = 'var(--success)';
      hint.innerHTML = `Found <strong>${json.imageCount}</strong> images${json.title ? ` on "${esc(json.title)}"` : ''}.`;
      preview.hidden = false;
      preview.innerHTML = `
        <div class="image-preview-grid">
          ${json.images.map((u, i) => `
            <div class="image-preview-item">
              <span class="index">${i + 1}</span>
              <img src="/api/proxy-image?url=${encodeURIComponent(u)}" alt="${i + 1}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.background='var(--surface-3)';this.removeAttribute('src');">
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      hint.style.color = 'var(--danger)';
      hint.textContent = `✗ ${err.message}`;
      preview.hidden = true;
    } finally {
      previewBtn.disabled = false;
      previewBtn.textContent = 'Preview';
    }
  }

  // -------- Download ZIP --------
  async function runDownload() {
    const url = urlInput.value.trim();
    if (!url) { hint.style.color = 'var(--danger)'; hint.textContent = 'Paste a URL first.'; return; }
    downloadBtn.disabled = true; downloadBtn.textContent = 'Downloading…';
    hint.style.color = '';
    hint.textContent = 'Bundling images server-side. May take 10–60s for chapters with many pages…';
    try {
      const res = await fetch(`/api/scrape-zip?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Server: ${txt.slice(0, 200)}`);
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const cd = res.headers.get('content-disposition') || '';
      const filename = cd.match(/filename="?([^"]+)"?/)?.[1] || 'images.zip';
      const a = document.createElement('a');
      a.href = blobUrl; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      const count = res.headers.get('x-image-count') || '?';
      hint.style.color = 'var(--success)';
      hint.innerHTML = `✓ Downloaded <strong>${esc(filename)}</strong> · ${esc(count)} images · ${(blob.size / 1024 / 1024).toFixed(1)} MB.`;
      toast('ZIP downloaded', 'success');
    } catch (err) {
      hint.style.color = 'var(--danger)';
      hint.textContent = `✗ ${err.message}`;
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.textContent = 'Download ZIP';
    }
  }

  previewBtn.addEventListener('click', runPreview);
  downloadBtn.addEventListener('click', runDownload);
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); runPreview(); }
  });
}
