#!/usr/bin/env node
// =====================================================
// grabber-gui.mjs — Local GUI for scraping + uploading chapters.
//
// Run: node grabber-gui.mjs
// Opens: http://localhost:3456 in your browser
//
// Features:
// - Paste a URL → see all images as thumbnails
// - Click to deselect junk images
// - Upload selected → get Catbox links
// - Copy all links or save as .txt
// =====================================================

import { createServer } from 'http';
import { readFileSync, writeFileSync } from 'fs';

const PORT = 3456;

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chapter Grabber</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, 'Segoe UI', sans-serif; background: #0a0a0c; color: #ececf3; min-height: 100vh; padding: 24px; }
h1 { font-size: 24px; margin-bottom: 8px; }
.subtitle { color: #74747f; font-size: 14px; margin-bottom: 24px; }
.input-row { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
input[type="text"] { flex: 1; min-width: 300px; padding: 10px 14px; border-radius: 8px; border: 1px solid #2a2a33; background: #16161b; color: #ececf3; font-size: 14px; outline: none; }
input[type="text"]:focus { border-color: #f0b941; }
button { padding: 10px 20px; border-radius: 8px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
.btn-primary { background: #f0b941; color: #0a0a0c; }
.btn-primary:hover { background: #f5c95a; transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.btn-secondary { background: #1c1c22; color: #ececf3; border: 1px solid #2a2a33; }
.btn-secondary:hover { background: #2a2a33; }
.btn-danger { background: #ef4444; color: white; }
.btn-success { background: #4ade80; color: #0a0a0c; }
.status { padding: 12px 16px; border-radius: 8px; margin: 16px 0; font-size: 13px; }
.status-info { background: #16161b; border: 1px solid #2a2a33; }
.status-success { background: #052e16; border: 1px solid #166534; color: #4ade80; }
.status-error { background: #2d0a0a; border: 1px solid #7f1d1d; color: #ef4444; }
.toolbar { display: flex; gap: 8px; align-items: center; margin: 16px 0; flex-wrap: wrap; }
.toolbar span { color: #74747f; font-size: 13px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; margin: 16px 0; }
.thumb { position: relative; aspect-ratio: 3/4; border-radius: 6px; overflow: hidden; cursor: pointer; border: 2px solid #2a2a33; transition: all 0.15s; }
.thumb img { width: 100%; height: 100%; object-fit: cover; }
.thumb.selected { border-color: #f0b941; }
.thumb.deselected { opacity: 0.3; border-color: #ef4444; }
.thumb .idx { position: absolute; top: 4px; left: 4px; background: rgba(0,0,0,0.8); color: white; font-size: 11px; padding: 2px 6px; border-radius: 4px; }
.thumb .x { position: absolute; top: 4px; right: 4px; background: #ef4444; color: white; font-size: 11px; padding: 2px 6px; border-radius: 4px; display: none; }
.thumb.deselected .x { display: block; }
.results { margin: 16px 0; }
.results textarea { width: 100%; height: 200px; background: #16161b; border: 1px solid #2a2a33; border-radius: 8px; color: #ececf3; font-family: monospace; font-size: 12px; padding: 12px; resize: vertical; }
.progress { height: 4px; background: #1c1c22; border-radius: 2px; margin: 8px 0; overflow: hidden; }
.progress-fill { height: 100%; background: #f0b941; transition: width 0.3s; width: 0%; }
</style>
</head>
<body>
<h1>📦 Chapter Grabber</h1>
<p class="subtitle">Paste a chapter URL → preview images → select/deselect → upload to Catbox → get links</p>

<div class="input-row">
  <input type="text" id="urlInput" placeholder="https://hivetoons.org/series/lookism/chapter-1" autofocus>
  <button class="btn-primary" id="scanBtn" onclick="scan()">Scan</button>
</div>

<div id="status" class="status status-info" style="display:none;"></div>
<div class="progress" id="progressBar" style="display:none;"><div class="progress-fill" id="progressFill"></div></div>

<div id="toolbar" class="toolbar" style="display:none;">
  <button class="btn-secondary" onclick="selectAll()">Select All</button>
  <button class="btn-secondary" onclick="deselectAll()">Deselect All</button>
  <span id="countText"></span>
  <span style="flex:1;"></span>
  <button class="btn-primary" id="uploadBtn" onclick="uploadSelected()">⬆ Upload Selected to Catbox</button>
</div>

<div id="grid" class="grid"></div>

<div id="results" class="results" style="display:none;">
  <div class="toolbar">
    <strong>✅ Catbox Links (paste into Admin → Page URLs)</strong>
    <span style="flex:1;"></span>
    <button class="btn-secondary" onclick="copyLinks()">📋 Copy All</button>
    <button class="btn-secondary" onclick="saveLinks()">💾 Save as .txt</button>
  </div>
  <textarea id="linksOutput" readonly></textarea>
</div>

<script>
let images = [];
let selected = new Set();

async function scan() {
  const url = document.getElementById('urlInput').value.trim();
  if (!url) return;
  showStatus('Scanning page...', 'info');
  document.getElementById('grid').innerHTML = '';
  document.getElementById('toolbar').style.display = 'none';
  document.getElementById('results').style.display = 'none';
  document.getElementById('scanBtn').disabled = true;

  try {
    const res = await fetch('/api/scrape', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({url}) });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    images = data.images;
    selected = new Set(images.map((_, i) => i));
    renderGrid();
    showStatus(\`Found \${images.length} images. Click any to deselect junk.\`, 'success');
    document.getElementById('toolbar').style.display = 'flex';
  } catch(e) {
    showStatus('Error: ' + e.message, 'error');
  }
  document.getElementById('scanBtn').disabled = false;
}

function renderGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = images.map((url, i) => \`
    <div class="thumb \${selected.has(i) ? 'selected' : 'deselected'}" onclick="toggle(\${i})" id="t\${i}">
      <img src="/api/proxy-img?url=\${encodeURIComponent(url)}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22/>'">
      <span class="idx">\${i+1}</span>
      <span class="x">✗</span>
    </div>
  \`).join('');
  updateCount();
}

function toggle(i) {
  if (selected.has(i)) selected.delete(i);
  else selected.add(i);
  const el = document.getElementById('t'+i);
  el.classList.toggle('selected', selected.has(i));
  el.classList.toggle('deselected', !selected.has(i));
  updateCount();
}

function selectAll() { images.forEach((_, i) => selected.add(i)); renderGrid(); }
function deselectAll() { selected.clear(); renderGrid(); }
function updateCount() { document.getElementById('countText').textContent = \`\${selected.size} / \${images.length} selected\`; }

async function uploadSelected() {
  const urls = [...selected].sort((a,b) => a-b).map(i => images[i]);
  if (!urls.length) { showStatus('Select at least one image', 'error'); return; }

  document.getElementById('uploadBtn').disabled = true;
  document.getElementById('progressBar').style.display = 'block';
  showStatus(\`Uploading \${urls.length} images to Catbox...\`, 'info');

  const links = [];
  let failed = 0;

  for (let i = 0; i < urls.length; i++) {
    try {
      const res = await fetch('/api/upload', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({url: urls[i], index: i}) });
      const data = await res.json();
      if (data.ok) links.push(data.url);
      else failed++;
    } catch { failed++; }
    document.getElementById('progressFill').style.width = ((i+1)/urls.length*100) + '%';
  }

  document.getElementById('uploadBtn').disabled = false;
  document.getElementById('progressBar').style.display = 'none';

  if (links.length > 0) {
    document.getElementById('linksOutput').value = links.join('\\n');
    document.getElementById('results').style.display = 'block';
    showStatus(\`✅ Done! \${links.length}/\${urls.length} uploaded\${failed ? \` (\${failed} failed)\` : ''}. Copy the links below.\`, 'success');
  } else {
    showStatus('All uploads failed. Try again or increase delay.', 'error');
  }
}

function copyLinks() {
  const ta = document.getElementById('linksOutput');
  ta.select();
  navigator.clipboard.writeText(ta.value);
  showStatus('📋 Copied to clipboard!', 'success');
}

function saveLinks() {
  const text = document.getElementById('linksOutput').value;
  const blob = new Blob([text], {type:'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'chapter-links.txt';
  a.click();
}

function showStatus(msg, type) {
  const el = document.getElementById('status');
  el.style.display = 'block';
  el.className = 'status status-' + type;
  el.textContent = msg;
}

document.getElementById('urlInput').addEventListener('keydown', e => { if (e.key === 'Enter') scan(); });
</script>
</body>
</html>`;

// =====================================================
// SERVER
// =====================================================
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Serve the HTML page
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(HTML);
    return;
  }

  // API: Scrape a page for images
  if (url.pathname === '/api/scrape' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { url: targetUrl } = JSON.parse(body);
        const pageRes = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Referer': new URL(targetUrl).origin + '/'
          }
        });
        if (!pageRes.ok) throw new Error(`Page returned ${pageRes.status}`);
        const html = await pageRes.text();
        const images = extractImages(html, targetUrl);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, images, count: images.length }));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // API: Upload one image — alternates between Catbox and ImgBB
  if (url.pathname === '/api/upload' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { url: imageUrl, index = 0 } = JSON.parse(body);

        // Download image
        const imgRes = await fetch(imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': new URL(imageUrl).origin + '/',
            'Accept': 'image/*'
          }
        });
        if (!imgRes.ok) throw new Error(`Download: ${imgRes.status}`);
        const blob = await imgRes.blob();
        if (blob.size < 500) throw new Error('Too small');

        // Alternate: even = Catbox, odd = ImgBB
        let uploadUrl;
        const useCatbox = (index % 2 === 0);

        if (useCatbox) {
          uploadUrl = await uploadToCatbox(blob, imageUrl);
        } else {
          uploadUrl = await uploadToImgBB(blob, imageUrl);
          // If ImgBB fails (no key etc), fall back to Catbox
          if (!uploadUrl) uploadUrl = await uploadToCatbox(blob, imageUrl);
        }

        await new Promise(r => setTimeout(r, 500));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, url: uploadUrl, host: useCatbox ? 'catbox' : 'imgbb' }));
      } catch (e) {
        // Retry once with the other host
        try {
          await new Promise(r => setTimeout(r, 1500));
          const { url: imageUrl } = JSON.parse(body);
          const imgRes = await fetch(imageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': new URL(imageUrl).origin + '/', 'Accept': 'image/*' }
          });
          const blob = await imgRes.blob();
          const uploadUrl = await uploadToCatbox(blob, imageUrl);
          if (uploadUrl) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, url: uploadUrl, host: 'catbox-retry' }));
            return;
          }
        } catch {}
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // API: Proxy an image (for preview thumbnails that block hotlinking)
  if (url.pathname === '/api/proxy-img') {
    const imgUrl = url.searchParams.get('url');
    if (!imgUrl) { res.writeHead(400); res.end('Missing url param'); return; }
    try {
      const imgRes = await fetch(imgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': new URL(imgUrl).origin + '/',
          'Accept': 'image/*'
        }
      });
      if (!imgRes.ok) { res.writeHead(502); res.end('Failed'); return; }
      const ct = imgRes.headers.get('content-type') || 'image/jpeg';
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': 'public, max-age=3600' });
      res.end(buffer);
    } catch (e) {
      res.writeHead(502);
      res.end(e.message);
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n🖥️  Chapter Grabber GUI running at:\n`);
  console.log(`   http://localhost:${PORT}\n`);
  console.log(`   Open this in your browser.`);
  console.log(`   Press Ctrl+C to stop.\n`);
});

// =====================================================
// Image extraction (same logic as grab-chapter.mjs)
// =====================================================
function extractImages(html, baseUrl) {
  const urls = new Set();
  const imgRegex = /<img[^>]*?(?:src|data-src|data-original|data-lazy-src)\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = imgRegex.exec(html)) !== null) {
    const src = resolveUrl(m[1], baseUrl);
    if (src && /\.(jpe?g|png|webp|gif|avif)(\?|$|#)/i.test(src) && isChapterImage(src)) {
      urls.add(src);
    }
  }
  return [...urls];
}

function resolveUrl(src, base) {
  if (!src || src.startsWith('data:')) return null;
  if (src.startsWith('//')) return 'https:' + src;
  try { return new URL(src, base).href; } catch { return null; }
}

function isChapterImage(url) {
  const lower = url.toLowerCase();
  const exclude = [
    'logo', 'avatar', 'icon', 'favicon', 'banner', '/ad/', '/ads/',
    'emoji', 'emote', '/theme/', '/emotes/', 'featured', 'thumbnail',
    'discord', 'iconify', 'social', 'watermark', 'brand', 'logo-end',
    '/upload/20'
  ];
  if (exclude.some(p => lower.includes(p))) return false;
  const filename = lower.split('/').pop().split('?')[0].replace(/\.[^.]+$/, '');
  const shortNames = ['like', 'love', 'laugh', 'wow', 'cry', 'angry', 'sad', 'happy'];
  if (shortNames.includes(filename)) return false;
  return true;
}

// =====================================================
// UPLOAD HELPERS — Catbox + ImgBB
// =====================================================
async function uploadToCatbox(blob, sourceUrl) {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  const ext = sourceUrl.match(/\.(jpe?g|png|webp|gif|avif)/i)?.[1] || 'jpg';
  form.append('fileToUpload', blob, `page.${ext}`);

  const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Catbox: ${res.status}`);
  const text = (await res.text()).trim();
  if (!text.startsWith('https://files.catbox.moe/')) throw new Error(`Catbox: ${text.slice(0, 80)}`);
  return text;
}

// ImgBB API key — get yours free at https://api.imgbb.com/
const IMGBB_KEY = process.env.IMGBB_API_KEY || '';

async function uploadToImgBB(blob, sourceUrl) {
  if (!IMGBB_KEY) return null; // no key, skip
  try {
    const buffer = Buffer.from(await blob.arrayBuffer());
    const base64 = buffer.toString('base64');

    const form = new FormData();
    form.append('key', IMGBB_KEY);
    form.append('image', base64);

    const res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success) return null;
    return json.data?.image?.url || json.data?.url || json.data?.display_url || null;
  } catch {
    return null;
  }
}
