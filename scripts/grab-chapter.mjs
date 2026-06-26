#!/usr/bin/env node
// =====================================================
// grab-chapter.mjs — Simple chapter image grabber.
//
// Give it a URL → downloads images → uploads to Catbox → gives you links.
//
// Usage:
//   node grab-chapter.mjs "https://hivetoons.org/series/lookism/chapter-1"
//   node grab-chapter.mjs "https://hivetoons.org/series/lookism/chapter-1" --save lookism-ch1.txt
//   node grab-chapter.mjs "https://hivetoons.org/series/lookism/chapter-1" --delay 800
//
// Output: A .txt file with one Catbox URL per line, ready to paste into admin.
//
// Batch mode (multiple chapters):
//   node grab-chapter.mjs --batch "https://hivetoons.org/series/lookism/chapter-{N}" --start 1 --end 50
//   Creates: lookism-ch001.txt, lookism-ch002.txt, ... (one file per chapter)
// =====================================================

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';

const args = process.argv.slice(2);
function getArg(name, defaultVal = '') {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return defaultVal;
  return args[idx + 1] || defaultVal;
}
function hasFlag(name) { return args.includes(`--${name}`); }

const BATCH_PATTERN = getArg('batch');
const SINGLE_URL = BATCH_PATTERN ? null : args.find(a => a.startsWith('http'));
const START = parseInt(getArg('start', '1'), 10);
const END = parseInt(getArg('end', '1'), 10);
const SAVE_FILE = getArg('save');
const DELAY = parseInt(getArg('delay', '350'), 10);
const OUTPUT_DIR = getArg('out', 'chapters-output');

if (!SINGLE_URL && !BATCH_PATTERN) {
  console.log(`
Usage:
  Single chapter:
    node grab-chapter.mjs "https://hivetoons.org/series/lookism/chapter-1"
    node grab-chapter.mjs "https://..." --save my-links.txt

  Batch mode:
    node grab-chapter.mjs --batch "https://hivetoons.org/series/lookism/chapter-{N}" --start 1 --end 50

Options:
  --save <file>     Save links to a specific file (single mode)
  --out <folder>    Output folder for batch mode (default: chapters-output)
  --delay <ms>      Delay between uploads in ms (default: 500)
`);
  process.exit(0);
}

// =====================================================
// SCRAPER
// =====================================================
async function scrapePage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Referer': new URL(url).origin + '/'
    }
  });
  if (!res.ok) throw new Error(`Page returned ${res.status}`);
  const html = await res.text();

  const images = [];
  const imgRegex = /<img[^>]*?(?:src|data-src|data-original|data-lazy-src)\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = imgRegex.exec(html)) !== null) {
    const src = resolveUrl(m[1], url);
    if (src && /\.(jpe?g|png|webp|gif|avif)(\?|$|#)/i.test(src) && isChapterImage(src)) {
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
  if (ext === 'webp' || ext === 'gif') return blob; // already optimal or animated
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
  // Download
  const res = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': new URL(imageUrl).origin + '/',
      'Accept': 'image/*'
    }
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  let blob = await res.blob();
  if (blob.size < 500) throw new Error('Too small');

  // Compress to WebP if possible
  blob = await compressIfNeeded(blob, imageUrl);
  // Alternate: even = Catbox, odd = ImgBB (fallback to Catbox if no key)
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
  if (!uploadRes.ok) throw new Error(`Catbox: ${uploadRes.status}`);
  const text = (await uploadRes.text()).trim();
  if (!text.startsWith('https://files.catbox.moe/')) throw new Error(`Catbox error: ${text.slice(0, 80)}`);
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
// PROCESS ONE CHAPTER
// =====================================================
async function processChapter(url, outputFile) {
  console.log(`\n🔍 Scraping: ${url}`);
  const images = await scrapePage(url);
  console.log(`   Found ${images.length} images`);

  if (images.length === 0) {
    console.log('   ⚠️  No images found. Skipping.');
    return { ok: false, reason: 'no images' };
  }

  console.log(`   📤 Uploading to Catbox...`);
  const links = [];
  let failed = 0;

  for (let i = 0; i < images.length; i++) {
    try {
      const hostedUrl = await uploadImage(images[i]);
      links.push(hostedUrl);
      process.stdout.write(`\r   📤 ${i + 1}/${images.length} uploaded`);
    } catch (err) {
      // Retry once
      await sleep(2000);
      try {
        const hostedUrl = await uploadImage(images[i]);
        links.push(hostedUrl);
        process.stdout.write(`\r   📤 ${i + 1}/${images.length} uploaded (retried)`);
      } catch {
        failed++;
        process.stdout.write(`\r   📤 ${i + 1}/${images.length} (${failed} failed)`);
      }
    }
    if (i < images.length - 1) await sleep(DELAY);
  }

  console.log(''); // newline after progress

  if (links.length === 0) {
    console.log('   ❌ All uploads failed!');
    return { ok: false, reason: 'all uploads failed' };
  }

  // Save links to file
  const content = links.join('\n') + '\n';
  writeFileSync(outputFile, content);
  console.log(`   ✅ ${links.length}/${images.length} images uploaded`);
  console.log(`   📁 Saved to: ${outputFile}`);
  console.log(`   📋 Paste these into Admin → Chapters → Page URLs`);

  return { ok: true, total: images.length, uploaded: links.length, failed };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// =====================================================
// RUN
// =====================================================
const startTime = Date.now();

if (SINGLE_URL) {
  // Single chapter mode
  const outFile = SAVE_FILE || `chapter-links-${Date.now()}.txt`;
  const result = await processChapter(SINGLE_URL, outFile);
  if (!result.ok) process.exit(1);

} else if (BATCH_PATTERN) {
  // Batch mode
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`\n📦 Batch mode: chapters ${START} to ${END}`);
  console.log(`   Output folder: ${OUTPUT_DIR}/\n`);

  let success = 0;
  let fail = 0;
  const failures = [];

  for (let n = START; n <= END; n++) {
    const url = BATCH_PATTERN.replace('{N}', String(n)).replace('{n}', String(n));
    const padded = String(n).padStart(3, '0');
    const outFile = join(OUTPUT_DIR, `ch-${padded}.txt`);

    // Skip if already done
    if (existsSync(outFile)) {
      console.log(`   Ch.${n}: already exists, skipping`);
      success++;
      continue;
    }

    try {
      const result = await processChapter(url, outFile);
      if (result.ok) success++;
      else { fail++; failures.push({ num: n, url, reason: result.reason }); }
    } catch (err) {
      fail++;
      failures.push({ num: n, url, reason: err.message });
      console.log(`   ❌ Ch.${n}: ${err.message}`);
    }

    // Pause between chapters
    if (n < END) await sleep(2000);
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`
╔══════════════════════════════════════════════════════╗
║  BATCH COMPLETE                                     ║
╠══════════════════════════════════════════════════════╣
║  Success:   ${String(success).padEnd(39)}║
║  Failed:    ${String(fail).padEnd(39)}║
║  Time:      ${(elapsed + ' minutes').padEnd(39)}║
║  Output:    ${OUTPUT_DIR.padEnd(39)}║
╚══════════════════════════════════════════════════════╝
`);

  if (failures.length > 0) {
    const retryPath = `batch-retry-${Date.now()}.json`;
    writeFileSync(retryPath, JSON.stringify({ pattern: BATCH_PATTERN, failed: failures }, null, 2));
    console.log(`⚠️  Failed chapters saved to: ${retryPath}`);
  }

  console.log(`\n📋 To publish all chapters, paste each .txt file's contents into:`);
  console.log(`   Admin → Chapters → New Chapter → Page URLs textarea\n`);
}
