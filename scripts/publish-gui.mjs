#!/usr/bin/env node
// =====================================================
// publish-gui.mjs — Local GUI to publish mega-output chapters.
//
// Run: node publish-gui.mjs
// Open: http://localhost:3457
//
// Shows all grabbed chapters from mega-output/, lets you
// select which to publish, enter token, and publish with one click.
// =====================================================

import { createServer } from 'http';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'mega-output');
const PORT = 3457;
const PROJECT_ID = 'voidscans-6c66b';

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Publish Chapters</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, 'Segoe UI', sans-serif; background: #0a0a0c; color: #ececf3; min-height: 100vh; padding: 24px; }
h1 { font-size: 24px; margin-bottom: 8px; }
.subtitle { color: #74747f; font-size: 14px; margin-bottom: 24px; }
input[type="text"], input[type="password"] { width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid #2a2a33; background: #16161b; color: #ececf3; font-size: 14px; outline: none; margin-bottom: 12px; }
input:focus { border-color: #f0b941; }
button { padding: 10px 20px; border-radius: 8px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; }
.btn-primary { background: #f0b941; color: #0a0a0c; }
.btn-primary:hover { background: #f5c95a; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary { background: #1c1c22; color: #ececf3; border: 1px solid #2a2a33; }
.btn-danger { background: #ef4444; color: white; }
.status { padding: 12px; border-radius: 8px; margin: 12px 0; font-size: 13px; }
.status-info { background: #16161b; border: 1px solid #2a2a33; }
.status-success { background: #052e16; border: 1px solid #166534; color: #4ade80; }
.status-error { background: #2d0a0a; border: 1px solid #7f1d1d; color: #ef4444; }
.series-block { margin: 16px 0; padding: 16px; background: #111114; border: 1px solid #1f1f26; border-radius: 8px; }
.series-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.series-name { font-weight: 700; font-size: 16px; }
.chapter-count { color: #74747f; font-size: 13px; }
.progress { height: 6px; background: #1c1c22; border-radius: 3px; margin: 8px 0; overflow: hidden; }
.progress-fill { height: 100%; background: #f0b941; width: 0%; transition: width 0.3s; }
.log { margin-top: 16px; padding: 12px; background: #0a0a0c; border: 1px solid #1f1f26; border-radius: 8px; max-height: 300px; overflow-y: auto; font-family: monospace; font-size: 12px; white-space: pre-wrap; }
.toolbar { display: flex; gap: 8px; align-items: center; margin: 16px 0; flex-wrap: wrap; }
</style>
</head>
<body>
<h1>📤 Publish Chapters</h1>
<p class="subtitle">Publishes grabbed chapters from mega-output/ to your site. No CLI needed.</p>

<div>
  <label style="font-size:13px; color:#74747f;">Firebase Admin Token (from browser console)</label>
  <input type="password" id="token" placeholder="eyJhbGci...">
</div>

<div id="status" class="status status-info">Loading chapters...</div>
<div id="seriesList"></div>

<div class="toolbar">
  <button class="btn-primary" id="publishBtn" disabled onclick="publish()">Publish All</button>
  <span id="progressText" style="color:#74747f; font-size:13px;"></span>
</div>
<div class="progress" id="progressBar" style="display:none;"><div class="progress-fill" id="progressFill"></div></div>
<div class="log" id="log" style="display:none;"></div>

<script>
let chapters = [];

async function loadChapters() {
  const res = await fetch('/api/chapters-list');
  const data = await res.json();
  chapters = data.chapters;
  renderList(data.series);
  document.getElementById('status').textContent = chapters.length + ' chapters ready to publish';
  document.getElementById('publishBtn').disabled = false;
}

function renderList(seriesMap) {
  const el = document.getElementById('seriesList');
  el.innerHTML = Object.entries(seriesMap).map(([slug, count]) => \`
    <div class="series-block">
      <div class="series-header">
        <span class="series-name">\${slug}</span>
        <span class="chapter-count">\${count} chapters</span>
      </div>
    </div>
  \`).join('');
}

async function publish() {
  const token = document.getElementById('token').value.trim();
  if (!token) { showStatus('Enter your token first', 'error'); return; }

  const btn = document.getElementById('publishBtn');
  btn.disabled = true;
  document.getElementById('progressBar').style.display = 'block';
  document.getElementById('log').style.display = 'block';
  const logEl = document.getElementById('log');
  const fill = document.getElementById('progressFill');
  const text = document.getElementById('progressText');

  let published = 0, skipped = 0, failed = 0;

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    fill.style.width = ((i + 1) / chapters.length * 100) + '%';
    text.textContent = \`\${i + 1} / \${chapters.length}\`;

    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...ch, token })
      });
      const result = await res.json();
      if (result.skipped) { skipped++; }
      else if (result.ok) { published++; logEl.textContent += \`✓ \${ch.series} ch.\${ch.chapter}\\n\`; }
      else { failed++; logEl.textContent += \`✗ \${ch.series} ch.\${ch.chapter}: \${result.error}\\n\`; }
    } catch (e) {
      failed++;
      logEl.textContent += \`✗ \${ch.series} ch.\${ch.chapter}: \${e.message}\\n\`;
    }
  }

  showStatus(\`Done! Published: \${published}, Skipped: \${skipped}, Failed: \${failed}\`, published > 0 ? 'success' : 'error');
  btn.disabled = false;
}

function showStatus(msg, type = 'info') {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = 'status status-' + type;
}

loadChapters();
</script>
</body>
</html>`;

// =====================================================
// SERVER
// =====================================================
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(HTML);
    return;
  }

  // List all chapters from mega-output
  if (url.pathname === '/api/chapters-list') {
    const chapters = [];
    const seriesMap = {};
    if (existsSync(OUTPUT_DIR)) {
      const dirs = readdirSync(OUTPUT_DIR, { withFileTypes: true }).filter(d => d.isDirectory());
      for (const dir of dirs) {
        const slug = dir.name;
        const files = readdirSync(join(OUTPUT_DIR, slug)).filter(f => f.endsWith('.json')).sort();
        seriesMap[slug] = files.length;
        for (const f of files) {
          try {
            const data = JSON.parse(readFileSync(join(OUTPUT_DIR, slug, f), 'utf8'));
            if (data.pages && data.pages.length > 0) {
              chapters.push({ series: slug, chapter: data.chapter, pages: data.pages });
            }
          } catch {}
        }
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ chapters, series: seriesMap }));
    return;
  }

  // Publish one chapter
  if (url.pathname === '/api/publish' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { series, chapter, pages, token } = JSON.parse(body);
        if (!token || !series || !chapter || !pages?.length) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Missing fields' }));
          return;
        }

        // Check if already exists
        const checkUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
        const checkRes = await fetch(checkUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: 'chapters' }],
              where: { compositeFilter: { op: 'AND', filters: [
                { fieldFilter: { field: { fieldPath: 'seriesSlug' }, op: 'EQUAL', value: { stringValue: series } } },
                { fieldFilter: { field: { fieldPath: 'chapterNum' }, op: 'EQUAL', value: { integerValue: String(chapter) } } }
              ]}},
              limit: 1
            }
          })
        });
        const checkData = await checkRes.json();
        if (Array.isArray(checkData) && checkData.some(r => r.document)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, skipped: true }));
          return;
        }

        // Create chapter
        const createUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/chapters`;
        const createRes = await fetch(createUrl, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              seriesSlug: { stringValue: series },
              chapterNum: { integerValue: String(chapter) },
              title: { stringValue: '' },
              images: { arrayValue: { values: pages.map(u => ({ stringValue: u })) } },
              createdAt: { timestampValue: new Date().toISOString() }
            }
          })
        });
        if (!createRes.ok) {
          const err = await createRes.text();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: `${createRes.status}: ${err.slice(0, 80)}` }));
          return;
        }

        // Update series latestChapter
        const seriesUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/series/${series}?updateMask.fieldPaths=latestChapter&updateMask.fieldPaths=latestChapterAt&updateMask.fieldPaths=updatedAt`;
        await fetch(seriesUrl, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              latestChapter: { integerValue: String(chapter) },
              latestChapterAt: { timestampValue: new Date().toISOString() },
              updatedAt: { timestampValue: new Date().toISOString() }
            }
          })
        }).catch(() => {});

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n📤 Publish GUI running at:\n\n   http://localhost:${PORT}\n\n   Reads from: ${OUTPUT_DIR}/\n   Paste your token in the browser, click Publish All.\n   Press Ctrl+C to stop.\n`);
});
