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
// CHAPTER DISCOVERY — auto-extract chapter links from series page
// =====================================================
async function discoverChapters(seriesPageUrl, slug) {
  const res = await fetch(seriesPageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html',
      'Referer': new URL(seriesPageUrl).origin + '/'
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error(`Page returned ${res.status}`);
  const html = await res.text();

  // Extract all links that look like chapter URLs
  const hrefRegex = /href="([^"]+)"/gi;
  const links = [];
  let m;
  while ((m = hrefRegex.exec(html)) !== null) {
    links.push(m[1]);
  }

  // Filter: keep links that contain "chapter" or typical chapter path patterns
  const origin = new URL(seriesPageUrl).origin;
  const chapterLinks = links
    .map(l => { try { return new URL(l, seriesPageUrl).href; } catch { return null; } })
    .filter(Boolean)
    .filter(l => l.startsWith(origin)) // same domain only
    .filter(l => /chapter|chap|ch[-/]|episode|ep[-/]/i.test(l))
    .filter(l => l !== seriesPageUrl) // not the series page itself
    .filter((v, i, a) => a.indexOf(v) === i); // unique

  // Try to extract chapter numbers from URLs or assign sequential numbers
  const chapters = chapterLinks.map((url, idx) => {
    // Try to find a number in the URL
    const numMatch = url.match(/(?:chapter|chap|ch|episode|ep)[-/]?(\d+)/i);
    const chNum = numMatch ? parseInt(numMatch[1], 10) : (idx + 1);
    return { chNum, url };
  });

  // Sort by chapter number
  chapters.sort((a, b) => a.chNum - b.chNum);

  // Deduplicate by chapter number (keep first)
  const seen = new Set();
  return chapters.filter(c => {
    if (seen.has(c.chNum)) return false;
    seen.add(c.chNum);
    return true;
  });
}

// =====================================================
// SCRAPER — with smart thumbnail filtering
// =====================================================

// Known manga reader container selectors (class/id patterns in the HTML)
const READER_CONTAINERS = [
  'reading-content', 'chapter-content', 'reader-area', 'manga-reading',
  'entry-content', 'chapter-pages', 'page-break', 'wp-manga-chapter-img',
  'chapter-images', 'content-manga', 'reading-detail', 'panel-reading',
  'chapter_content', 'manga_content', 'text-left', 'reader-content',
  'c-blog-post', 'img-loading', 'chapter-reading', 'viewer-cnt',
  'comic-page', 'manga-reader', 'chapter-viewer', 'read-container'
];

// Sections that should NOT contain chapter images
const EXCLUDE_SECTIONS = [
  'related', 'sidebar', 'recommend', 'comment', 'footer', 'you-may',
  'also-like', 'popular', 'trending', 'latest', 'header', 'nav',
  'widget', 'breadcrumb', 'social', 'share', 'disqus', 'author'
];

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

  // STEP 1: Try to extract images only from the reader container
  let readerHtml = extractReaderSection(html);

  // STEP 2: Extract all candidate image URLs from the reader section (or full page as fallback)
  const sourceHtml = readerHtml || html;
  const rawImages = extractImageUrls(sourceHtml, url);

  // STEP 3: Apply keyword filter
  let images = rawImages.filter(src => isChapterImg(src));

  // STEP 4: Filter by inline dimensions (remove explicitly small images)
  images = filterByDimensions(images, sourceHtml);

  // STEP 5: Apply path-clustering filter to remove stray thumbnails
  images = filterByPathClustering(images);

  // STEP 6: Apply sequential filename detection (bonus confidence)
  images = filterBySequentialNames(images);

  // STEP 7: Verify image sizes — remove tiny thumbnails via HEAD requests
  images = await filterByFileSize(images);

  return images;
}

/**
 * Extract the reader/content section of the HTML to avoid pulling images from
 * sidebars, recommendations, footers, etc.
 */
function extractReaderSection(html) {
  // Strategy 1: Find a known reader container class/id
  for (const selector of READER_CONTAINERS) {
    const pattern = new RegExp(
      `<(?:div|section|article)[^>]*(?:class|id)\\s*=\\s*["'][^"']*\\b${selector}\\b[^"']*["'][^>]*>([\\s\\S]*?)(?=<(?:div|section|aside)[^>]*(?:class|id)\\s*=\\s*["'][^"']*(?:${EXCLUDE_SECTIONS.join('|')})[^"']*["'])`,
      'i'
    );
    const match = html.match(pattern);
    if (match && match[1]) {
      const imgCount = (match[1].match(/<img/gi) || []).length;
      if (imgCount >= 3) return match[1];
    }
  }

  // Strategy 2: Find an area between nav/prev buttons and the "related" section
  // Many manga sites have Prev/Next nav → images → Prev/Next nav → related content
  const navChapterPattern = /(?:chapter-nav|prev.*?next|nav-links|entry-header)[^>]*>[\s\S]*?<\/(?:div|nav)>/i;
  const navMatch = html.match(navChapterPattern);
  if (navMatch) {
    const afterNav = html.slice(navMatch.index + navMatch[0].length);
    // Find where the "related" or "you may also like" section starts
    const relatedPattern = new RegExp(`<(?:div|section|aside)[^>]*(?:class|id)\\s*=\\s*["'][^"']*(?:${EXCLUDE_SECTIONS.join('|')})[^"']*["']`, 'i');
    const relatedMatch = afterNav.match(relatedPattern);
    const readerBlock = relatedMatch ? afterNav.slice(0, relatedMatch.index) : afterNav;
    const imgCount = (readerBlock.match(/<img/gi) || []).length;
    if (imgCount >= 3) return readerBlock;
  }

  // Strategy 3: Find the densest cluster of consecutive <img> tags
  // Split into chunks and find the one with the highest img density
  const imgPositions = [];
  const imgRe = /<img[^>]+>/gi;
  let m;
  while ((m = imgRe.exec(html)) !== null) {
    imgPositions.push(m.index);
  }

  if (imgPositions.length >= 3) {
    // Find the tightest cluster of images (smallest span containing most imgs)
    let bestStart = 0, bestEnd = html.length, bestCount = 0;
    for (let i = 0; i < imgPositions.length; i++) {
      for (let j = i + 2; j < imgPositions.length; j++) {
        const count = j - i + 1;
        const span = imgPositions[j] - imgPositions[i];
        // Prefer clusters with high image count and low non-image HTML between them
        if (count > bestCount || (count === bestCount && span < (bestEnd - bestStart))) {
          // Check gap density: imgs should be close together (not scattered across the page)
          const avgGap = span / count;
          if (avgGap < 3000) { // average gap < 3KB between images — they're clustered
            bestStart = imgPositions[i];
            bestEnd = imgPositions[j] + 200; // include the last img tag
            bestCount = count;
          }
        }
      }
    }
    if (bestCount >= 3) {
      return html.slice(Math.max(0, bestStart - 100), Math.min(html.length, bestEnd + 100));
    }
  }

  return null; // fallback to full page
}

/**
 * Extract image URLs from HTML source, along with inline dimension info
 */
function extractImageUrls(html, baseUrl) {
  const images = [];
  const seen = new Set();
  const re = /<img[^>]*?(?:src|data-src|data-original|data-lazy-src)\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const src = resolveUrl(m[1], baseUrl);
    if (src && /\.(jpe?g|png|webp|gif|avif)(\?|$|#)/i.test(src) && !seen.has(src)) {
      seen.add(src);
      images.push(src);
    }
  }
  return images;
}

/**
 * Filter out images that have explicitly small dimensions in their HTML attributes.
 * Thumbnails often have width="75" height="75" or similar in the <img> tag.
 * Real manga pages are usually large or have no explicit size (CSS-driven).
 */
function filterByDimensions(images, html) {
  if (images.length <= 3) return images;

  const smallImages = new Set();
  const MIN_DIM = 150; // anything with both dimensions explicitly < 150px is a thumbnail

  for (const imgUrl of images) {
    // Find the <img> tag containing this URL
    const escaped = imgUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tagPattern = new RegExp(`<img[^>]*${escaped.slice(-60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*>`, 'i');
    const tagMatch = html.match(tagPattern);
    if (!tagMatch) continue;

    const tag = tagMatch[0];
    const wMatch = tag.match(/\bwidth\s*=\s*["']?(\d+)/i);
    const hMatch = tag.match(/\bheight\s*=\s*["']?(\d+)/i);

    if (wMatch && hMatch) {
      const w = parseInt(wMatch[1], 10);
      const h = parseInt(hMatch[1], 10);
      if (w < MIN_DIM && h < MIN_DIM) {
        smallImages.add(imgUrl);
      }
    } else if (wMatch && !hMatch) {
      const w = parseInt(wMatch[1], 10);
      if (w < 100) smallImages.add(imgUrl); // very small explicit width
    } else if (hMatch && !wMatch) {
      const h = parseInt(hMatch[1], 10);
      if (h < 100) smallImages.add(imgUrl);
    }
  }

  const filtered = images.filter(img => !smallImages.has(img));
  return filtered.length > 0 ? filtered : images;
}

/**
 * Path-clustering: real chapter images usually share a common directory path.
 * Group images by their base directory, keep the largest cluster.
 * Also checks for sequential filenames within the cluster for extra confidence.
 */
function filterByPathClustering(images) {
  if (images.length <= 3) return images; // too few to cluster

  // Extract base path (everything before the filename)
  const pathMap = new Map();
  for (const img of images) {
    const base = img.replace(/\/[^/]+$/, ''); // remove filename
    if (!pathMap.has(base)) pathMap.set(base, []);
    pathMap.get(base).push(img);
  }

  // Find the largest cluster
  let largestGroup = [];
  let largestBase = '';
  for (const [base, group] of pathMap) {
    if (group.length > largestGroup.length) {
      largestGroup = group;
      largestBase = base;
    }
  }

  // If the largest cluster has >=40% of images AND at least 3, keep only that cluster
  // Lower threshold than before (40% vs 50%) because some sites have lots of junk images
  if (largestGroup.length >= images.length * 0.4 && largestGroup.length >= 3) {
    return largestGroup;
  }

  // Secondary strategy: group by domain + first 2 path segments
  // (handles CDN paths like /uploads/manga/series-id/chapter-hash/...)
  const domainMap = new Map();
  for (const img of images) {
    try {
      const u = new URL(img);
      const segments = u.pathname.split('/').filter(Boolean).slice(0, 3).join('/');
      const key = u.hostname + '/' + segments;
      if (!domainMap.has(key)) domainMap.set(key, []);
      domainMap.get(key).push(img);
    } catch {}
  }

  let bestDomainGroup = [];
  for (const [, group] of domainMap) {
    if (group.length > bestDomainGroup.length) bestDomainGroup = group;
  }

  if (bestDomainGroup.length >= images.length * 0.4 && bestDomainGroup.length >= 3) {
    return bestDomainGroup;
  }

  return images;
}

/**
 * Sequential filename detection: real chapter pages usually have filenames like
 * 1.jpg, 2.jpg, 3.jpg or 001.png, 002.png, etc.
 * If we detect a sequential numeric pattern, keep only those images.
 */
function filterBySequentialNames(images) {
  if (images.length <= 3) return images;

  // Extract filename numbers
  const numbered = [];
  for (const img of images) {
    const filename = img.split('/').pop().split('?')[0].replace(/\.[^.]+$/, '');
    const numMatch = filename.match(/^(\d+)$/); // pure numeric filename: 1, 2, 03, 004
    if (numMatch) {
      numbered.push({ url: img, num: parseInt(numMatch[1], 10) });
    }
  }

  // If most images have pure numeric filenames, that's a strong signal
  if (numbered.length >= images.length * 0.6 && numbered.length >= 3) {
    // Sort by number and return only these
    numbered.sort((a, b) => a.num - b.num);
    return numbered.map(n => n.url);
  }

  // Also check for patterns like page-1, pg01, img_001, etc.
  const prefixNumbered = [];
  for (const img of images) {
    const filename = img.split('/').pop().split('?')[0].replace(/\.[^.]+$/, '');
    const numMatch = filename.match(/(?:^|[-_])(\d{1,4})$/);
    if (numMatch) {
      prefixNumbered.push({ url: img, num: parseInt(numMatch[1], 10) });
    }
  }

  if (prefixNumbered.length >= images.length * 0.6 && prefixNumbered.length >= 3) {
    prefixNumbered.sort((a, b) => a.num - b.num);
    return prefixNumbered.map(n => n.url);
  }

  return images; // can't detect pattern, return all
}

/**
 * Filter out tiny images (thumbnails) by checking file size via HEAD requests.
 * Real manga pages are typically >50KB. Thumbnails are usually <30KB.
 * Uses statistical outlier detection for more robust filtering.
 */
async function filterByFileSize(images) {
  if (images.length <= 3) return images; // don't filter if very few

  const sizeChecks = await Promise.allSettled(
    images.map(async (imgUrl) => {
      try {
        const res = await fetch(imgUrl, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Referer': new URL(imgUrl).origin + '/'
          },
          signal: AbortSignal.timeout(8000)
        });
        const size = parseInt(res.headers.get('content-length') || '0', 10);
        return { url: imgUrl, size, ok: res.ok };
      } catch {
        return { url: imgUrl, size: 0, ok: false };
      }
    })
  );

  const withSizes = sizeChecks
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);

  // If we couldn't get sizes for most images (server doesn't support HEAD), skip this filter
  const validSizes = withSizes.filter(s => s.ok && s.size > 0);
  if (validSizes.length < images.length * 0.5) {
    return images; // can't determine sizes, return all
  }

  // Statistical approach: calculate median and use it to detect outliers
  const sizes = validSizes.map(s => s.size).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)];
  const q1 = sizes[Math.floor(sizes.length * 0.25)];

  // Dynamic threshold: use the larger of:
  // - 15KB absolute minimum (any real manga page is bigger)
  // - 10% of median (handles consistently sized pages)
  // - half of Q1 (handles variable page sizes)
  const MIN_ABSOLUTE = 15 * 1024;
  const threshold = Math.max(
    Math.min(MIN_ABSOLUTE, q1 * 0.5),
    median * 0.1
  );

  const filtered = [];
  const removed = [];
  for (const img of images) {
    const info = withSizes.find(s => s.url === img);
    if (!info || !info.ok || info.size === 0) {
      filtered.push(img); // can't check, keep it
    } else if (info.size >= threshold) {
      filtered.push(img); // passes size check
    } else {
      removed.push({ url: img, size: info.size });
    }
  }

  // Safety check: if we'd remove more than 40% of images, something's wrong — keep all
  if (removed.length > images.length * 0.4) {
    return images;
  }

  return filtered.length > 0 ? filtered : images; // safety: never return empty
}

function resolveUrl(src, base) {
  if (!src || src.startsWith('data:')) return null;
  if (src.startsWith('//')) return 'https:' + src;
  try { return new URL(src, base).href; } catch { return null; }
}

function isChapterImg(url) {
  const l = url.toLowerCase();
  // Exclude common non-chapter image patterns
  const bad = [
    'logo', 'avatar', 'icon', 'favicon', 'banner', '/ad/', '/ads/',
    'emoji', 'emote', '/theme/', '/emotes/', 'featured', 'thumbnail',
    'discord', 'iconify', 'social', 'watermark', 'brand', 'logo-end',
    'gravatar', 'manga-genre', 'manga-tag', '/thumb-', 'cover-',
    '-cover', '/cover/', '/covers/', '/poster/', 'poster-',
    '/widget/', '/badges/', '/rating/', '/star', '/flag/',
    '/smilies/', '/plugins/', '/avatar/', 'spinner', 'loading',
    'placeholder', '/button/', 'arrow', 'close-btn', '/nav/',
    '150x150', '110x150', '75x75', '100x100', '200x200', '300x200',
    '-110x150', '-75x106', '-175x238', '-193x278'
  ];
  if (bad.some(b => l.includes(b))) return false;

  // Exclude WordPress thumbnail suffixes like image-150x150.jpg
  if (/[-_]\d{2,3}x\d{2,3}\.\w+$/.test(l)) return false;

  const name = l.split('/').pop().split('?')[0].replace(/\.[^.]+$/, '');
  const shortNames = ['like', 'love', 'laugh', 'wow', 'cry', 'angry', 'sad', 'happy',
    'share', 'reply', 'comment', 'star', 'rating', 'vote', 'bookmark'];
  if (shortNames.includes(name)) return false;
  return true;
}

// =====================================================
// UPLOADER — select host via --host flag
// Options: --host catbox | --host imgbb | --host alternate (default)
// =====================================================
const HOST_MODE = getArg('host', 'alternate').toLowerCase();
let uploadCounter = 0;

async function upload(blob, imageUrl) {
  uploadCounter++;

  if (HOST_MODE === 'imgbb') {
    // ImgBB only
    if (IMGBB_KEY) {
      const url = await toImgBB(blob);
      if (url) return url;
    }
    return await toCatbox(blob, imageUrl); // fallback if no key
  }

  if (HOST_MODE === 'catbox') {
    // Catbox only
    return await toCatbox(blob, imageUrl);
  }

  // Default: alternate
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
  process.stdout.write(`  ${slug} ch.${num}: scraping...`);
  const images = await scrapePage(pageUrl);
  if (!images.length) throw new Error('No images found');
  process.stdout.write(` ${images.length} imgs → uploading `);

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
      // Show dot every 5 images for progress
      if ((i + 1) % 5 === 0) process.stdout.write('.');
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
      } catch { process.stdout.write('x'); }
    }
    if (i < images.length - 1) await sleep(DELAY);
  }
  process.stdout.write('\n');

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
║  ImgBB:      ${(HOST_MODE === 'imgbb' ? 'IMGBB ONLY' : HOST_MODE === 'catbox' ? 'CATBOX ONLY' : (IMGBB_KEY ? 'YES (alternating)' : 'Catbox only (no key)')).padEnd(37)}║
╚══════════════════════════════════════════════════════╝
`);

const startTime = Date.now();
let totalChapters = 0;
let totalSuccess = 0;
let totalSkipped = 0;
let totalFailed = 0;
const CONCURRENCY = parseInt(getArg('concurrency', '2'), 10);

for (const series of seriesList) {
  const { slug, pattern, start, end, seriesPage } = series;
  if (!slug) { log(`⚠ Skipping invalid entry: ${JSON.stringify(series)}`); continue; }

  // Two modes: pattern-based (chapter-{N}) or seriesPage-based (auto-discover links)
  let chapterList = []; // [{ chNum, url }]

  if (seriesPage) {
    // Auto-discover chapter links from the series index page
    log(`\n━━━ ${slug} (auto-discover from ${seriesPage}) ━━━`);
    try {
      const discovered = await discoverChapters(seriesPage, slug);
      chapterList = discovered;
      log(`  Found ${discovered.length} chapter links`);
    } catch (err) {
      log(`  ✗ Failed to discover chapters: ${err.message}`);
      continue;
    }
  } else if (pattern && end) {
    // Pattern-based: generate URLs from start to end
    log(`\n━━━ ${slug} (chapters ${start}–${end}, concurrency ${CONCURRENCY}) ━━━`);
    for (let n = start; n <= end; n++) {
      chapterList.push({ chNum: n, url: pattern.replace('{N}', String(n)).replace('{n}', String(n)) });
    }
  } else {
    log(`⚠ Skipping ${slug}: needs either "pattern"+"end" or "seriesPage"`);
    continue;
  }

  // Process in batches of CONCURRENCY
  for (let i = 0; i < chapterList.length; i += CONCURRENCY) {
    const batch = chapterList.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(batch.map(async ({ slug: s, chNum, url }) => {
      totalChapters++;
      const result = await processChapter(s || slug, chNum, url);
      return { chNum, result };
    }));

    for (const r of results) {
      if (r.status === 'fulfilled') {
        if (r.value.result === 'skipped') {
          totalSkipped++;
          process.stdout.write(`  ${slug} ch.${r.value.chNum}: skipped\n`);
        } else {
          totalSuccess++;
          log(`  ✓ ${slug} ch.${r.value.chNum} — ${r.value.result} pages`);
        }
      } else {
        totalFailed++;
        log(`  ✗ ${slug} ch.${batch[results.indexOf(r)]?.chNum} — ${r.reason?.message || 'unknown'}`);
      }
    }

    // Small pause between batches
    await sleep(500);
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
