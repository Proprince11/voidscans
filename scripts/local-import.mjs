#!/usr/bin/env node
// =====================================================
// local-import.mjs — Fully local bulk chapter import.
//
// Runs entirely on YOUR PC. No Worker timeout issues.
// Scrapes → uploads to Catbox directly → writes to Firestore.
//
// Usage:
//   node local-import.mjs --series lookism \
//     --pattern "https://hivetoons.org/series/lookism/chapter-{N}" \
//     --start 1 --end 606
//
//   # Or with a file of URLs:
//   node local-import.mjs --series lookism --urls chapters.txt --start 1
//
//   # Dry run (just scrape, show image count):
//   node local-import.mjs --series lookism --pattern "..." --start 1 --end 5 --dry-run
//
//   # Export URLs to CSV instead of publishing:
//   node local-import.mjs --series lookism --pattern "..." --start 1 --end 5 --export chapters.csv
//
// No token needed — uses Firebase Admin SDK with service account.
// If no service account, uses Firestore REST API with your token.
// =====================================================

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

// =====================================================
// CLI Arguments
// =====================================================
const args = process.argv.slice(2);
function getArg(name, defaultVal = '') {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return defaultVal;
  return args[idx + 1] || defaultVal;
}
function hasFlag(name) { return args.includes(`--${name}`); }

const SERIES = getArg('series');
const URL_FILE = getArg('urls');
const PATTERN = getArg('pattern');
const START = parseInt(getArg('start', '1'), 10);
const END = parseInt(getArg('end', '0'), 10);
const DRY_RUN = hasFlag('dry-run');
const EXPORT_FILE = getArg('export');
const INITIAL_TOKEN = getArg('token') || process.env.ADMIN_TOKEN;
const DELAY = parseInt(getArg('delay', '300'), 10); // ms between uploads
const RETRY_FILE = getArg('retry');

if (!SERIES) {
  console.error('❌ --series is required');
  process.exit(1);
}
if (!DRY_RUN && !EXPORT_FILE && !INITIAL_TOKEN) {
  console.error('❌ --token is required for publishing (or use --dry-run / --export)');
  process.exit(1);
}

// =====================================================
// Build URL list
// =====================================================
let chapterUrls = [];

if (RETRY_FILE && existsSync(RETRY_FILE)) {
  const data = JSON.parse(readFileSync(RETRY_FILE, 'utf8'));
  chapterUrls = data.failed || [];
  console.log(`🔄 Retry mode: ${chapterUrls.length} chapters from ${RETRY_FILE}`);
} else if (URL_FILE && existsSync(URL_FILE)) {
  const lines = readFileSync(URL_FILE, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  chapterUrls = lines.map((url, i) => ({ num: START + i, url }));
} else if (PATTERN && END > 0) {
  for (let n = START; n <= END; n++) {
    chapterUrls.push({ num: n, url: PATTERN.replace('{N}', String(n)).replace('{n}', String(n)) });
  }
} else {
  console.error('❌ Provide --urls <file> or --pattern <url> --start N --end N');
  process.exit(1);
}

console.log(`
╔══════════════════════════════════════════════════════╗
║  JayaScans LOCAL Import                             ║
╠══════════════════════════════════════════════════════╣
║  Series:      ${SERIES.padEnd(37)}║
║  Chapters:    ${String(chapterUrls.length).padEnd(37)}║
║  Mode:        ${(DRY_RUN ? 'DRY RUN' : EXPORT_FILE ? 'EXPORT → ' + EXPORT_FILE : 'PUBLISH').padEnd(37)}║
║  Delay:       ${(DELAY + 'ms between uploads').padEnd(37)}║
╚══════════════════════════════════════════════════════╝
`);

// =====================================================
// SCRAPER — fetch page HTML and extract chapter images
// =====================================================
async function scrapeChapter(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Referer': new URL(url).origin + '/'
    }
  });
  if (!res.ok) throw new Error(`Page returned ${res.status}`);
  const html = await res.text();
  return extractImages(html, url);
}

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
    '/upload/20' // site banners like /upload/2024/ /upload/2026/
  ];
  if (exclude.some(p => lower.includes(p))) return false;
  const filename = lower.split('/').pop().split('?')[0].replace(/\.[^.]+$/, '');
  const shortNames = ['like', 'love', 'laugh', 'wow', 'cry', 'angry', 'sad', 'happy'];
  if (shortNames.includes(filename)) return false;
  return true;
}

// =====================================================
// UPLOADER — alternates between Catbox and ImgBB
// =====================================================
import { readFileSync as readFs } from 'fs';

// Optional WebP compression
let sharp = null;
try { sharp = (await import('sharp')).default; } catch {}

const IMGBB_KEY = process.env.IMGBB_API_KEY || (() => {
  try {
    const envPath = new URL('./.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
    const lines = readFs(envPath, 'utf8').split('\n');
    for (const l of lines) { const m = l.match(/^IMGBB_API_KEY\s*=\s*(.+)/); if (m) return m[1].trim().replace(/^["']|["']$/g, ''); }
  } catch {} return '';
})();

let uploadCounter = 0;

async function compressIfNeeded(blob, imageUrl) {
  if (!sharp) return blob;
  const ext = imageUrl.match(/\.(jpe?g|png|webp|gif|avif)/i)?.[1]?.toLowerCase() || '';
  if (ext === 'webp' || ext === 'gif') return blob;
  try {
    const buffer = Buffer.from(await blob.arrayBuffer());
    const webp = await sharp(buffer).webp({ quality: 75 }).toBuffer();
    if (webp.length < buffer.length * 0.95) {
      return new Blob([webp], { type: 'image/webp' });
    }
  } catch {}
  return blob;
}

async function uploadImage(imageUrl) {
  // Download the image
  const imgRes = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': new URL(imageUrl).origin + '/',
      'Accept': 'image/*'
    }
  });
  if (!imgRes.ok) throw new Error(`Download failed: ${imgRes.status}`);
  let blob = await imgRes.blob();
  if (blob.size < 500) throw new Error('Too small, likely not an image');

  // Compress to WebP if possible
  blob = await compressIfNeeded(blob, imageUrl);

  // Alternate: even = Catbox, odd = ImgBB
  uploadCounter++;
  if (IMGBB_KEY && uploadCounter % 2 === 0) {
    try {
      const url = await uploadToImgBB(blob);
      if (url) return url;
    } catch {} // fall through to Catbox
  }
  return await uploadToCatbox(blob, imageUrl);
}

async function uploadToCatbox(blob, imageUrl) {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  const ext = imageUrl.match(/\.(jpe?g|png|webp|gif|avif)/i)?.[1] || 'jpg';
  form.append('fileToUpload', blob, `page.${ext}`);

  const uploadRes = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form });
  if (!uploadRes.ok) throw new Error(`Catbox returned ${uploadRes.status}`);
  const text = (await uploadRes.text()).trim();
  if (!text.startsWith('https://files.catbox.moe/')) throw new Error(`Catbox error: ${text.slice(0, 100)}`);
  return text;
}

async function uploadToImgBB(blob) {
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
}

// =====================================================
// PUBLISHER — write chapter to Firestore
// =====================================================
async function publishChapter(num, imageUrls) {
  const projectId = 'voidscans-6c66b';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/chapters`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fields: {
        seriesSlug: { stringValue: SERIES },
        chapterNum: { integerValue: String(num) },
        title: { stringValue: '' },
        images: { arrayValue: { values: imageUrls.map(u => ({ stringValue: u })) } },
        createdAt: { timestampValue: new Date().toISOString() }
      }
    })
  });
  if (!res.ok) {
    const err = await res.text();
    if (res.status === 401 || res.status === 403) {
      // Token expired mid-run
      console.log('\n⏰ Token expired during publish!');
      const newToken = await askForNewToken();
      if (newToken && newToken !== 'q') {
        TOKEN = newToken;
        // Retry this publish with new token
        const retryRes = await fetch(url, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              seriesSlug: { stringValue: SERIES },
              chapterNum: { integerValue: String(num) },
              title: { stringValue: '' },
              images: { arrayValue: { values: imageUrls.map(u => ({ stringValue: u })) } },
              createdAt: { timestampValue: new Date().toISOString() }
            }
          })
        });
        if (!retryRes.ok) throw new Error(`Firestore retry failed: ${retryRes.status}`);
      } else {
        throw new Error('Token expired, user quit');
      }
    } else {
      throw new Error(`Firestore: ${res.status} ${err.slice(0, 100)}`);
    }
  }

  // Update series latestChapter
  // First find the series doc
  const seriesUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/series/${SERIES}`;
  const seriesRes = await fetch(seriesUrl);
  if (seriesRes.ok) {
    const seriesDoc = await seriesRes.json();
    const currentLatest = parseInt(seriesDoc.fields?.latestChapter?.integerValue || '0', 10);
    if (num > currentLatest) {
      await fetch(seriesUrl + '?updateMask.fieldPaths=latestChapter&updateMask.fieldPaths=latestChapterAt&updateMask.fieldPaths=updatedAt', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: {
            latestChapter: { integerValue: String(num) },
            latestChapterAt: { timestampValue: new Date().toISOString() },
            updatedAt: { timestampValue: new Date().toISOString() }
          }
        })
      });
    }
  }
}

// =====================================================
// MAIN LOOP
// =====================================================
const results = [];
const failed = [];
let completed = 0;

// TOKEN MANAGEMENT — detect expiry, pause and ask for new one
import { createInterface } from 'readline';

function getTokenExpiry(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return 0;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return (payload.exp || 0) * 1000; // ms
  } catch { return 0; }
}

function isTokenExpired() {
  if (!TOKEN) return true;
  const expiry = getTokenExpiry(TOKEN);
  if (!expiry) return false; // can't parse, assume valid
  // Treat as expired if less than 2 minutes remaining
  return Date.now() > expiry - 120_000;
}

function tokenMinutesLeft() {
  const expiry = getTokenExpiry(TOKEN);
  if (!expiry) return '?';
  const mins = Math.max(0, Math.round((expiry - Date.now()) / 60_000));
  return mins;
}

async function askForNewToken() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    console.log('\n⏰ Token expired (or about to expire).');
    console.log('   Get a fresh one from admin console:');
    console.log('   const { auth } = await import("/assets/js/lib/firebase.js");');
    console.log('   console.log(await auth.currentUser.getIdToken());\n');
    rl.question('   Paste new token (or "q" to quit): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

let TOKEN = INITIAL_TOKEN;

// CSV header
if (EXPORT_FILE) {
  writeFileSync(EXPORT_FILE, 'chapter,page_num,catbox_url\n');
}

async function processChapter({ num, url }) {
  try {
    // Step 1: Scrape
    process.stdout.write(`  Ch.${num}: Scraping...`);
    const images = await scrapeChapter(url);
    process.stdout.write(` ${images.length} images.`);

    if (images.length === 0) {
      throw new Error('No images found on page');
    }

    if (DRY_RUN) {
      process.stdout.write(` [DRY RUN]\n`);
      results.push({ num, status: 'dry-run', imageCount: images.length });
      return;
    }

    // Step 2: Upload each image to Catbox (one by one, from YOUR PC)
    process.stdout.write(` Uploading...`);
    const hostedUrls = [];
    let uploadFailed = 0;

    for (let i = 0; i < images.length; i++) {
      try {
        const catboxUrl = await uploadImage(images[i]);
        hostedUrls.push(catboxUrl);
      } catch (err) {
        uploadFailed++;
        // Retry once after a pause
        await sleep(2000);
        try {
          const catboxUrl = await uploadImage(images[i]);
          hostedUrls.push(catboxUrl);
          uploadFailed--; // recovered
        } catch {
          // skip this image
        }
      }
      // Delay between uploads
      if (i < images.length - 1) await sleep(DELAY);
      // Progress indicator every 10 images
      if ((i + 1) % 10 === 0) process.stdout.write(` ${i + 1}/${images.length}`);
    }

    process.stdout.write(` ${hostedUrls.length}/${images.length} hosted.`);

    if (hostedUrls.length === 0) {
      throw new Error('All uploads failed');
    }

    // Step 3: Export or Publish
    if (EXPORT_FILE) {
      // Write to CSV
      hostedUrls.forEach((u, i) => {
        appendFileSync(EXPORT_FILE, `${num},${i + 1},${u}\n`);
      });
      process.stdout.write(` → exported.\n`);
    } else {
      // Publish to Firestore
      process.stdout.write(` Publishing...`);
      await publishChapter(num, hostedUrls);
      process.stdout.write(` ✓ Done`);
    }

    completed++;
    process.stdout.write(` (${completed}/${chapterUrls.length})\n`);
    results.push({ num, status: 'ok', imageCount: hostedUrls.length, failed: uploadFailed });

  } catch (err) {
    process.stdout.write(` ✗ ${err.message}\n`);
    failed.push({ num, url, error: err.message });
    results.push({ num, status: 'failed', error: err.message });
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Process one chapter at a time
const minsLeft = tokenMinutesLeft();
console.log(`\n📥 Starting import... (token valid for ~${minsLeft} min)\n`);
const startTime = Date.now();

for (const ch of chapterUrls) {
  // Check token before publishing (scraping + uploading don't need it)
  if (!DRY_RUN && !EXPORT_FILE && isTokenExpired()) {
    const newToken = await askForNewToken();
    if (newToken === 'q' || newToken === 'quit') {
      console.log('\n⏹ Stopped by user. Progress saved.\n');
      break;
    }
    if (newToken) TOKEN = newToken;
  }
  await processChapter(ch);
  // Small pause between chapters
  await sleep(1000);
}

const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

console.log(`
╔══════════════════════════════════════════════════════╗
║  IMPORT COMPLETE                                    ║
╠══════════════════════════════════════════════════════╣
║  Total:     ${String(chapterUrls.length).padEnd(39)}║
║  Success:   ${String(completed).padEnd(39)}║
║  Failed:    ${String(failed.length).padEnd(39)}║
║  Time:      ${(elapsed + ' minutes').padEnd(39)}║
╚══════════════════════════════════════════════════════╝
`);

if (failed.length > 0) {
  const retryPath = resolve(`local-import-retry-${SERIES}-${Date.now()}.json`);
  writeFileSync(retryPath, JSON.stringify({ series: SERIES, failed }, null, 2));
  console.log(`⚠️  Retry failed chapters: node local-import.mjs --series ${SERIES} --retry ${retryPath} --token YOUR_TOKEN\n`);
}

const logPath = resolve(`local-import-log-${SERIES}-${Date.now()}.json`);
writeFileSync(logPath, JSON.stringify({ series: SERIES, results, elapsed, failed }, null, 2));
console.log(`📋 Log: ${logPath}`);
