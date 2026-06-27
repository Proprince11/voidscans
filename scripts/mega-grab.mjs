#!/usr/bin/env node
// =====================================================
// mega-grab.mjs — Bulk multi-series chapter grabber.
//
// Run once. It processes ALL series defined in series.json,
// uploads images (alternating Catbox/ImgBB), and saves
// everything to a structured output file. No token needed.
// Publish later with mega-publish.mjs when ready.
//
// Usage:
//   1. Edit series.json with your series list
//   2. Run: node mega-grab.mjs
//   3. Walk away. Come back in a few hours.
//   4. Find output in: mega-output/
//
// Output structure:
//   mega-output/
//   ├── manifest.json          ← master index of everything grabbed
//   ├── lookism/
//   │   ├── ch-001.json        ← { chapter: 1, pages: [url, url, ...] }
//   │   ├── ch-002.json
//   │   └── ...
//   ├── hero-x-demon-empress/
//   │   ├── ch-001.json
//   │   └── ...
//   └── grab-log.txt           ← human-readable log
//
// Features:
//   - Skips chapters already grabbed (checks output folder)
//   - Alternates Catbox/ImgBB
//   - WebP compression via sharp (if installed)
//   - Auto-retries failed images once
//   - Saves progress continuously (safe to Ctrl+C and resume)
//   - No token needed (upload only, no publishing)
// =====================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'fs';
import { join } from 'path';

// =====================================================
// CONFIG — edit series.json or pass --config <file>
// =====================================================
const args = process.argv.slice(2);
function getArg(name, def = '') { const i = args.indexOf(`--${name}`); return i >= 0 ? (args[i+1] || def) : def; }

const CONFIG_FILE = getArg('config', 'series.json');
const OUTPUT_DIR = getArg('out', 'mega-output');
const DELAY = parseInt(getArg('delay', '350'), 10);

// Load series config
if (!existsSync(CONFIG_FILE)) {
  // Create a template
  const template = [
    {
      slug: "lookism",
      pattern: "https://hivetoons.org/series/lookism/chapter-{N}",
      start: 1,
      end: 607
    },
    {
      slug: "hero-x-demon-empress",
      pattern: "https://manhuaus.com/manga/hero-x-demon-queen/chapter-{N}",
      start: 1,
      end: 100
    }
  ];
  writeFileSync(CONFIG_FILE, JSON.stringify(template, null, 2));
  console.log(`\n📄 Created ${CONFIG_FILE} — edit it with your series, then run again.\n`);
  console.log(`Format:
[
  {
    "slug": "series-slug",           ← must match your admin panel slug
    "pattern": "https://source.com/manga/name/chapter-{N}",
    "start": 1,                      ← first chapter number
    "end": 100                       ← last chapter number
  }
]\n`);
  process.exit(0);
}

const seriesList = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
if (!Array.isArray(seriesList) || !seriesList.length) {
  console.error('❌ series.json is empty or invalid');
  process.exit(1);
}

// =====================================================
// SETUP
// =====================================================
mkdirSync(OUTPUT_DIR, { recursive: true });
const LOG_FILE = join(OUTPUT_DIR, 'grab-log.txt');
const MANIFEST_FILE = join(OUTPUT_DIR, 'manifest.json');

// Load or create manifest
let manifest = {};
if (existsSync(MANIFEST_FILE)) {
  try { manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')); } catch {}
}

function log(msg) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
  console.log(line);
  appendFileSync(LOG_FILE, line + '\n');
}

function saveManifest() {
  writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
}

// =====================================================
// SHARP (optional WebP compression)
// =====================================================
let sharp = null;
try { sharp = (await import('sharp')).default; } catch {}

async function compress(blob, url) {
  if (!sharp) return blob;
  const ext = url.match(/\.(jpe?g|png)/i)?.[1];
  if (!ext) return blob; // already webp/gif
  try {
    const buf = Buffer.from(await blob.arrayBuffer());
    const webp = await sharp(buf).webp({ quality: 75 }).toBuffer();
    if (webp.length < buf.length * 0.95) return new Blob([webp], { type: 'image/webp' });
  } catch {}
  return blob;
}

// =====================================================
// IMGBB KEY
// =====================================================
import { readFileSync as readFs2 } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const IMGBB_KEY = process.env.IMGBB_API_KEY || (() => {
  try {
    const envPath = join(__dirname, '.env');
    const lines = readFs2(envPath, 'utf8').split('\n');
    for (const l of lines) { const m = l.match(/^IMGBB_API_KEY\s*=\s*(.+)/); if (m) return m[1].trim().replace(/^["']|["']$/g, ''); }
  } catch {} return '';
})();

// =====================================================
// SCRAPER
// =====================================================
async function scrapePage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Referer': new URL(url).origin + '/'
    },
    signal: AbortSignal.timeout(15000) // 15s timeout
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const html = await res.text();
  const images = [];
  const re = /<img[^>]*?(?:src|data-src|data-original|data-lazy-src)\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const src = resolveUrl(m[1], url);
    if (src && /\.(jpe?g|png|webp|gif|avif)(\?|$|#)/i.test(src) && isChapterImg(src)) {
      images.push(src);
    }
  }
  return images;
}

function resolveUrl(src, base) {
  if (!src || src.startsWith('data:')) return null;
  if (src.startsWith('//')) return 'https:' + src;
  try { return new URL(src, base).href; } catch { return null; }
}

function isChapterImg(url) {
  const l = url.toLowerCase();
  const bad = ['logo','avatar','icon','favicon','banner','/ad/','/ads/','emoji','emote','/theme/','/emotes/','featured','thumbnail','discord','iconify','social','watermark','brand','logo-end','/upload/20'];
  if (bad.some(b => l.includes(b))) return false;
  const name = l.split('/').pop().split('?')[0].replace(/\.[^.]+$/, '');
  if (['like','love','laugh','wow','cry','angry','sad','happy'].includes(name)) return false;
  return true;
}

// =====================================================
// UPLOADER — alternating Catbox/ImgBB
// =====================================================
let uploadCounter = 0;

async function upload(blob, imageUrl) {
  uploadCounter++;
  if (IMGBB_KEY && uploadCounter % 2 === 0) {
    try {
      const url = await toImgBB(blob);
      if (url) return url;
    } catch {}
  }
  return await toCatbox(blob, imageUrl);
}

async function toCatbox(blob, imageUrl) {
  const form = new FormData();
  const ext = blob.type === 'image/webp' ? 'webp' : (imageUrl.match(/\.(jpe?g|png|webp|gif|avif)/i)?.[1] || 'jpg');
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', blob, `page.${ext}`);
  const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Catbox ${res.status}`);
  const text = (await res.text()).trim();
  if (!text.startsWith('https://files.catbox.moe/')) throw new Error(text.slice(0, 60));
  return text;
}

async function toImgBB(blob) {
  const buffer = Buffer.from(await blob.arrayBuffer());
  const form = new FormData();
  form.append('key', IMGBB_KEY);
  form.append('image', buffer.toString('base64'));
  const res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data?.image?.url || json.data?.url || null;
}

// =====================================================
// PROCESS ONE CHAPTER
// =====================================================
async function processChapter(slug, num, pageUrl) {
  const outDir = join(OUTPUT_DIR, slug);
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `ch-${String(num).padStart(4, '0')}.json`);

  // Skip if already done
  if (existsSync(outFile)) {
    try {
      const existing = JSON.parse(readFileSync(outFile, 'utf8'));
      if (existing.pages && existing.pages.length > 0) return 'skipped';
    } catch {}
  }

  // Scrape
  const images = await scrapePage(pageUrl);
  if (!images.length) throw new Error('No images found');

  // Upload each image
  const pages = [];
  for (let i = 0; i < images.length; i++) {
    try {
      const res = await fetch(images[i], {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': new URL(images[i]).origin + '/', 'Accept': 'image/*' },
        signal: AbortSignal.timeout(20000)
      });
      if (!res.ok) throw new Error(`DL ${res.status}`);
      let blob = await res.blob();
      blob = await compress(blob, images[i]);
      const url = await upload(blob, images[i]);
      pages.push(url);
    } catch {
      // Retry once
      await sleep(2000);
      try {
        const res = await fetch(images[i], {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': new URL(images[i]).origin + '/', 'Accept': 'image/*' },
          signal: AbortSignal.timeout(20000)
        });
        let blob = await res.blob();
        blob = await compress(blob, images[i]);
        const url = await upload(blob, images[i]);
        pages.push(url);
      } catch { /* skip this image */ }
    }
    if (i < images.length - 1) await sleep(DELAY);
  }

  if (!pages.length) throw new Error('All uploads failed');

  // Save chapter data
  const chapterData = {
    series: slug,
    chapter: num,
    pageCount: pages.length,
    totalFound: images.length,
    pages,
    grabbedAt: new Date().toISOString()
  };
  writeFileSync(outFile, JSON.stringify(chapterData, null, 2));

  // Update manifest
  if (!manifest[slug]) manifest[slug] = { chapters: {} };
  manifest[slug].chapters[num] = { pages: pages.length, file: `${slug}/ch-${String(num).padStart(4, '0')}.json` };
  saveManifest();

  return `${pages.length}/${images.length}`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// =====================================================
// MAIN — process all series
// =====================================================
console.log(`
╔══════════════════════════════════════════════════════╗
║  MEGA GRAB — Multi-Series Chapter Grabber           ║
╠══════════════════════════════════════════════════════╣
║  Series:     ${String(seriesList.length).padEnd(37)}║
║  Output:     ${OUTPUT_DIR.padEnd(37)}║
║  Delay:      ${(DELAY + 'ms').padEnd(37)}║
║  Sharp:      ${(sharp ? 'YES (WebP compression)' : 'no').padEnd(37)}║
║  ImgBB:      ${(IMGBB_KEY ? 'YES (alternating)' : 'Catbox only').padEnd(37)}║
╚══════════════════════════════════════════════════════╝
`);

const startTime = Date.now();
let totalChapters = 0;
let totalSuccess = 0;
let totalSkipped = 0;
let totalFailed = 0;

for (const series of seriesList) {
  const { slug, pattern, start, end } = series;
  if (!slug || !pattern || !end) { log(`⚠ Skipping invalid entry: ${JSON.stringify(series)}`); continue; }

  log(`\n━━━ ${slug} (chapters ${start}–${end}) ━━━`);

  for (let n = start; n <= end; n++) {
    totalChapters++;
    const url = pattern.replace('{N}', String(n)).replace('{n}', String(n));
    try {
      const result = await processChapter(slug, n, url);
      if (result === 'skipped') {
        totalSkipped++;
        // Don't log skipped to keep output clean
      } else {
        totalSuccess++;
        log(`  ✓ ${slug} ch.${n} — ${result} pages`);
      }
    } catch (err) {
      totalFailed++;
      log(`  ✗ ${slug} ch.${n} — ${err.message}`);
    }
    // Pause between chapters
    await sleep(1000);
  }
}

const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

log(`\n${'═'.repeat(54)}`);
log(`DONE in ${elapsed} minutes`);
log(`  Success: ${totalSuccess} | Skipped: ${totalSkipped} | Failed: ${totalFailed} | Total: ${totalChapters}`);
log(`  Output: ${OUTPUT_DIR}/`);
log(`${'═'.repeat(54)}`);

console.log(`
╔══════════════════════════════════════════════════════╗
║  ALL DONE                                           ║
╠══════════════════════════════════════════════════════╣
║  Success:    ${String(totalSuccess).padEnd(38)}║
║  Skipped:    ${String(totalSkipped).padEnd(38)}║
║  Failed:     ${String(totalFailed).padEnd(38)}║
║  Time:       ${(elapsed + ' min').padEnd(38)}║
║  Output:     ${OUTPUT_DIR.padEnd(38)}║
╚══════════════════════════════════════════════════════╝

Next step: node mega-publish.mjs --token YOUR_TOKEN
This reads ${OUTPUT_DIR}/ and publishes all chapters to your site.
`);
