#!/usr/bin/env node
// =====================================================
// mega-publish.mjs — Publish all grabbed chapters to Firestore.
//
// Reads the mega-output/ folder (from mega-grab.mjs) and creates
// chapter documents in Firestore for each .json file.
//
// Usage:
//   node mega-publish.mjs --token YOUR_TOKEN
//   node mega-publish.mjs --token YOUR_TOKEN --series lookism   ← only one series
//   node mega-publish.mjs --token YOUR_TOKEN --dry-run          ← just count, don't publish
//
// Features:
//   - Skips chapters already published (checks Firestore)
//   - Updates series.latestChapter automatically
//   - Token refresh prompt when expired
// =====================================================

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';

const args = process.argv.slice(2);
function getArg(name, def = '') { const i = args.indexOf(`--${name}`); return i >= 0 ? (args[i+1] || def) : def; }
function hasFlag(name) { return args.includes(`--${name}`); }

const INPUT_DIR = getArg('input', 'mega-output');
const ONLY_SERIES = getArg('series');
const DRY_RUN = hasFlag('dry-run');
let TOKEN = getArg('token') || process.env.ADMIN_TOKEN;

if (!TOKEN && !DRY_RUN) {
  console.error('❌ --token required. Get it from admin console.');
  process.exit(1);
}

const PROJECT_ID = 'voidscans-6c66b';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Token management
function getTokenExpiry(t) {
  try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).exp * 1000; }
  catch { return 0; }
}
function isExpired() {
  const exp = getTokenExpiry(TOKEN);
  return exp ? Date.now() > exp - 120000 : false;
}
async function askToken() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(r => {
    console.log('\n⏰ Token expired. Paste new token (or "q" to quit):');
    rl.question('> ', ans => { rl.close(); r(ans.trim()); });
  });
}

// Firestore helpers
async function chapterExists(slug, num) {
  const url = `${FIRESTORE_BASE}:runQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'chapters' }],
        where: { compositeFilter: { op: 'AND', filters: [
          { fieldFilter: { field: { fieldPath: 'seriesSlug' }, op: 'EQUAL', value: { stringValue: slug } } },
          { fieldFilter: { field: { fieldPath: 'chapterNum' }, op: 'EQUAL', value: { integerValue: String(num) } } }
        ]}},
        limit: 1
      }
    })
  });
  if (!res.ok) return false;
  const data = await res.json();
  return Array.isArray(data) && data.some(r => r.document);
}

async function publishChapter(slug, num, pages) {
  const res = await fetch(`${FIRESTORE_BASE}/chapters`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        seriesSlug: { stringValue: slug },
        chapterNum: { integerValue: String(num) },
        title: { stringValue: '' },
        images: { arrayValue: { values: pages.map(u => ({ stringValue: u })) } },
        createdAt: { timestampValue: new Date().toISOString() }
      }
    })
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('TOKEN_EXPIRED');
    throw new Error(`Firestore ${res.status}`);
  }
}

async function updateLatest(slug, num) {
  const url = `${FIRESTORE_BASE}/series/${slug}?updateMask.fieldPaths=latestChapter&updateMask.fieldPaths=latestChapterAt&updateMask.fieldPaths=updatedAt`;
  await fetch(url, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        latestChapter: { integerValue: String(num) },
        latestChapterAt: { timestampValue: new Date().toISOString() },
        updatedAt: { timestampValue: new Date().toISOString() }
      }
    })
  }).catch(() => {});
}

// =====================================================
// MAIN
// =====================================================
if (!existsSync(INPUT_DIR)) {
  console.error(`❌ ${INPUT_DIR}/ not found. Run mega-grab.mjs first.`);
  process.exit(1);
}

// Find all series folders
const seriesDirs = readdirSync(INPUT_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .filter(s => !ONLY_SERIES || s === ONLY_SERIES);

if (!seriesDirs.length) {
  console.error('❌ No series found in output folder.');
  process.exit(1);
}

// Count chapters
let totalFiles = 0;
const work = [];
for (const slug of seriesDirs) {
  const dir = join(INPUT_DIR, slug);
  const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  for (const f of files) {
    work.push({ slug, file: join(dir, f) });
    totalFiles++;
  }
}

console.log(`\n📤 Publishing ${totalFiles} chapters across ${seriesDirs.length} series${DRY_RUN ? ' [DRY RUN]' : ''}...\n`);

let published = 0;
let skipped = 0;
let failed = 0;
const latestPerSeries = {};

for (const { slug, file } of work) {
  // Token check
  if (!DRY_RUN && isExpired()) {
    const newToken = await askToken();
    if (newToken === 'q') break;
    if (newToken) TOKEN = newToken;
  }

  const data = JSON.parse(readFileSync(file, 'utf8'));
  const num = data.chapter;
  const pages = data.pages;

  if (!pages || !pages.length) { skipped++; continue; }

  if (DRY_RUN) {
    console.log(`  ${slug} ch.${num} — ${pages.length} pages ✓`);
    published++;
    continue;
  }

  // Check if already published
  try {
    const exists = await chapterExists(slug, num);
    if (exists) { skipped++; continue; }
  } catch {}

  // Publish
  try {
    await publishChapter(slug, num, pages);
    published++;
    process.stdout.write(`  ✓ ${slug} ch.${num} (${published}/${totalFiles})\r\n`);
    // Track highest chapter per series
    if (!latestPerSeries[slug] || num > latestPerSeries[slug]) latestPerSeries[slug] = num;
  } catch (err) {
    if (err.message === 'TOKEN_EXPIRED') {
      const newToken = await askToken();
      if (newToken === 'q') break;
      if (newToken) TOKEN = newToken;
      // Retry this one
      try {
        await publishChapter(slug, num, pages);
        published++;
        if (!latestPerSeries[slug] || num > latestPerSeries[slug]) latestPerSeries[slug] = num;
      } catch { failed++; }
    } else {
      failed++;
      console.log(`  ✗ ${slug} ch.${num} — ${err.message}`);
    }
  }
  await new Promise(r => setTimeout(r, 200));
}

// Update latestChapter for each series
for (const [slug, num] of Object.entries(latestPerSeries)) {
  await updateLatest(slug, num);
}

console.log(`
╔══════════════════════════════════════════════════════╗
║  PUBLISH COMPLETE                                   ║
╠══════════════════════════════════════════════════════╣
║  Published:  ${String(published).padEnd(38)}║
║  Skipped:    ${String(skipped).padEnd(38)}║
║  Failed:     ${String(failed).padEnd(38)}║
╚══════════════════════════════════════════════════════╝
`);
