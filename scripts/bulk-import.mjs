#!/usr/bin/env node
// =====================================================
// bulk-import.mjs — Automated bulk chapter import.
//
// Scrapes chapter pages, re-hosts images, creates chapters in Firestore.
// Designed for importing 500+ chapters with minimal manual work.
//
// Usage:
//   node bulk-import.mjs --series solo-raven \
//     --urls chapters.txt \
//     --start 1 \
//     --concurrency 3 \
//     --site https://jayascans.online
//
//   # Or with URL pattern:
//   node bulk-import.mjs --series solo-raven \
//     --pattern "https://source.com/solo-raven/chapter-{N}" \
//     --start 1 --end 100
//
// The chapters.txt file should contain one URL per line.
// Lines starting with # are comments. Blank lines are skipped.
//
// Prerequisites:
//   1. cd scripts && npm install
//   2. Set ADMIN_TOKEN env var (Firebase ID token from admin account)
//      or use --token flag
//   3. Worker must be deployed at the specified --site URL
// =====================================================

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// =====================================================
// CLI Arguments
// =====================================================
const args = process.argv.slice(2);
function getArg(name, defaultVal = '') {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return defaultVal;
  return args[idx + 1] || defaultVal;
}
function hasFlag(name) {
  return args.includes(`--${name}`);
}

const SERIES = getArg('series');
const URL_FILE = getArg('urls');
const PATTERN = getArg('pattern');
const START = parseInt(getArg('start', '1'), 10);
const END = parseInt(getArg('end', '0'), 10);
const CONCURRENCY = parseInt(getArg('concurrency', '1'), 10);
const SITE = getArg('site', 'https://jayascans.online');
const TOKEN = getArg('token') || process.env.ADMIN_TOKEN;
const DRY_RUN = hasFlag('dry-run');
const RETRY_FILE = getArg('retry');

if (!SERIES) {
  console.error('❌ --series is required. E.g.: --series solo-raven');
  process.exit(1);
}
if (!TOKEN) {
  console.error('❌ ADMIN_TOKEN env var or --token is required.');
  console.error('   Get it from: Firebase Console → Auth → your admin user → copy ID token');
  console.error('   Or from browser DevTools: await firebase.auth().currentUser.getIdToken()');
  process.exit(1);
}

// =====================================================
// Build URL list
// =====================================================
let chapterUrls = []; // [{ num, url }]

if (RETRY_FILE && existsSync(RETRY_FILE)) {
  // Retry mode: read failed chapters from previous run
  const data = JSON.parse(readFileSync(RETRY_FILE, 'utf8'));
  chapterUrls = data.failed || [];
  console.log(`🔄 Retry mode: ${chapterUrls.length} failed chapters from ${RETRY_FILE}`);
} else if (URL_FILE && existsSync(URL_FILE)) {
  const lines = readFileSync(URL_FILE, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
  chapterUrls = lines.map((url, i) => ({ num: START + i, url }));
} else if (PATTERN && END > 0) {
  for (let n = START; n <= END; n++) {
    const url = PATTERN.replace('{N}', String(n)).replace('{n}', String(n));
    chapterUrls.push({ num: n, url });
  }
} else {
  console.error('❌ Provide either --urls <file> or --pattern <url> --start N --end N');
  process.exit(1);
}

console.log(`
╔══════════════════════════════════════════════════════╗
║  JayaScans Bulk Import                              ║
╠══════════════════════════════════════════════════════╣
║  Series:       ${SERIES.padEnd(36)}║
║  Chapters:     ${String(chapterUrls.length).padEnd(36)}║
║  Concurrency:  ${String(CONCURRENCY).padEnd(36)}║
║  Site:         ${SITE.padEnd(36)}║
║  Dry run:      ${String(DRY_RUN).padEnd(36)}║
╚══════════════════════════════════════════════════════╝
`);

// =====================================================
// Processing
// =====================================================
const results = [];
const failed = [];
let completed = 0;

async function processChapter({ num, url }) {
  const label = `Ch.${num}`;
  try {
    // Step 1: Scrape images from source URL
    process.stdout.write(`  ${label}: Scraping...`);
    const scrapeRes = await fetch(`${SITE}/api/scrape?url=${encodeURIComponent(url)}`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const scrapeJson = await scrapeRes.json();
    if (!scrapeJson.ok || !scrapeJson.images?.length) {
      throw new Error(`Scrape failed: ${scrapeJson.error || 'no images found'}`);
    }
    process.stdout.write(` ${scrapeJson.images.length} images.`);

    if (DRY_RUN) {
      process.stdout.write(` [DRY RUN - skipping upload]\n`);
      results.push({ num, status: 'dry-run', imageCount: scrapeJson.images.length });
      return;
    }

    // Step 2: Re-host all images in chunks (Catbox rate-limits + Worker has 30s timeout)
    // Send max 15 images per request, collect results across chunks
    process.stdout.write(` Rehosting...`);
    const allImages = scrapeJson.images;
    // Send max 10 images per request to stay within Worker timeout
    const CHUNK_SIZE = 10;
    const hostedUrls = [];
    const failedImages = [];

    for (let c = 0; c < allImages.length; c += CHUNK_SIZE) {
      const chunk = allImages.slice(c, c + CHUNK_SIZE);
      try {
        const rehostRes = await fetch(`${SITE}/api/scrape-rehost`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            urls: chunk,
            series: SERIES,
            chapter: String(num)
          }),
          redirect: 'follow'
        });
        const rehostText = await rehostRes.text();
        let rehostJson;
        try {
          rehostJson = JSON.parse(rehostText);
        } catch {
          throw new Error(`Non-JSON response (status ${rehostRes.status}): ${rehostText.slice(0, 100)}`);
        }
        if (rehostJson.results) {
          hostedUrls.push(...rehostJson.results.filter(r => r.ok).map(r => r.url));
          failedImages.push(...rehostJson.results.filter(r => !r.ok).map(r => r.source));
        }
      } catch (chunkErr) {
        failedImages.push(...chunk);
      }
      // Small delay between chunks to avoid rate-limiting
      if (c + CHUNK_SIZE < allImages.length) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    // RETRY: If more than 20% of images failed, retry the failed ones once
    if (failedImages.length > 0 && failedImages.length > allImages.length * 0.2) {
      process.stdout.write(` retrying ${failedImages.length}...`);
      await new Promise(r => setTimeout(r, 3000)); // wait 3s before retry
      for (let c = 0; c < failedImages.length; c += CHUNK_SIZE) {
        const chunk = failedImages.slice(c, c + CHUNK_SIZE);
        try {
          const retryRes = await fetch(`${SITE}/api/scrape-rehost`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ urls: chunk, series: SERIES, chapter: String(num) }),
            redirect: 'follow'
          });
          const retryText = await retryRes.text();
          try {
            const retryJson = JSON.parse(retryText);
            if (retryJson.results) {
              hostedUrls.push(...retryJson.results.filter(r => r.ok).map(r => r.url));
            }
          } catch {}
        } catch {}
        if (c + CHUNK_SIZE < failedImages.length) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    process.stdout.write(` ${hostedUrls.length}/${allImages.length} hosted.`);

    if (hostedUrls.length === 0) {
      throw new Error('All image uploads failed');
    }

    // Step 3: Create chapter in Firestore (via admin API or direct)
    // For now, we'll use the Firestore REST API directly
    process.stdout.write(` Publishing...`);
    const chapterData = {
      seriesSlug: SERIES,
      chapterNum: num,
      title: '',
      images: hostedUrls
    };

    // Use Firestore REST API to create the chapter
    const projectId = 'voidscans-6c66b';
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/chapters`;
    const firestoreRes = await fetch(firestoreUrl, {
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
          images: { arrayValue: { values: hostedUrls.map(u => ({ stringValue: u })) } },
          createdAt: { timestampValue: new Date().toISOString() }
        }
      })
    });

    if (!firestoreRes.ok) {
      const errText = await firestoreRes.text();
      throw new Error(`Firestore write failed: ${firestoreRes.status} ${errText.slice(0, 100)}`);
    }

    completed++;
    process.stdout.write(` ✓ Done (${completed}/${chapterUrls.length})\n`);
    results.push({ num, status: 'ok', imageCount: hostedUrls.length, failedImages: failedImages.length });

  } catch (err) {
    process.stdout.write(` ✗ ${err.message}\n`);
    failed.push({ num, url, error: err.message });
    results.push({ num, status: 'failed', error: err.message });
  }
}

// Process in batches
async function runBatches() {
  for (let i = 0; i < chapterUrls.length; i += CONCURRENCY) {
    const batch = chapterUrls.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(processChapter));
    // Small delay between batches to be respectful to source sites
    if (i + CONCURRENCY < chapterUrls.length) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// =====================================================
// Run
// =====================================================
console.log('\n📥 Starting import...\n');
const startTime = Date.now();

await runBatches();

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
const successCount = results.filter(r => r.status === 'ok' || r.status === 'dry-run').length;

console.log(`
╔══════════════════════════════════════════════════════╗
║  IMPORT COMPLETE                                    ║
╠══════════════════════════════════════════════════════╣
║  Total:     ${String(chapterUrls.length).padEnd(39)}║
║  Success:   ${String(successCount).padEnd(39)}║
║  Failed:    ${String(failed.length).padEnd(39)}║
║  Time:      ${(elapsed + 's').padEnd(39)}║
╚══════════════════════════════════════════════════════╝
`);

// Save results for retry
if (failed.length > 0) {
  const retryPath = resolve(`bulk-import-retry-${SERIES}-${Date.now()}.json`);
  writeFileSync(retryPath, JSON.stringify({ series: SERIES, failed, results }, null, 2));
  console.log(`⚠️  ${failed.length} chapters failed. Retry with:`);
  console.log(`   node bulk-import.mjs --series ${SERIES} --retry ${retryPath}\n`);
}

// Save full log
const logPath = resolve(`bulk-import-log-${SERIES}-${Date.now()}.json`);
writeFileSync(logPath, JSON.stringify({ series: SERIES, results, elapsed, failed }, null, 2));
console.log(`📋 Full log saved to: ${logPath}`);
