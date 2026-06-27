#!/usr/bin/env node
// =====================================================
// update-series.mjs — Auto-update series.json with latest chapter numbers.
//
// Visits each source site, finds the highest chapter number available,
// and updates the "end" field in series.json.
//
// Usage:
//   node update-series.mjs
//
// Run this before mega-grab.mjs to ensure you're grabbing all new chapters.
// =====================================================

import { readFileSync, writeFileSync } from 'fs';

const CONFIG_FILE = 'series.json';

if (!(await import('fs')).existsSync(CONFIG_FILE)) {
  console.error('❌ series.json not found. Run mega-grab.mjs first to create it.');
  process.exit(1);
}

const series = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
console.log(`\n🔍 Checking ${series.length} series for new chapters...\n`);

let updated = 0;

for (const s of series) {
  // Skip completed/dropped series — they won't have new chapters
  if (s.status === 'completed' || s.status === 'dropped') {
    process.stdout.write(`  ${s.slug}: skipped (${s.status})\n`);
    continue;
  }
  try {
    process.stdout.write(`  ${s.slug}: `);
    const latest = await findLatestChapter(s);
    if (latest && latest > s.end) {
      process.stdout.write(`${s.end} → ${latest} ✓ (+${latest - s.end} new)\n`);
      s.end = latest;
      updated++;
    } else if (latest) {
      process.stdout.write(`up to date (${s.end})\n`);
    } else {
      process.stdout.write(`couldn't detect latest\n`);
    }
  } catch (err) {
    process.stdout.write(`error: ${err.message}\n`);
  }
}

if (updated > 0) {
  writeFileSync(CONFIG_FILE, JSON.stringify(series, null, 2));
  console.log(`\n✅ Updated ${updated} series in ${CONFIG_FILE}`);
} else {
  console.log(`\n✓ All series are up to date.`);
}

// =====================================================
// DETECTION — visit series index page, find highest chapter number
// =====================================================
async function findLatestChapter(s) {
  // Extract the series index URL from the chapter pattern
  // e.g. "https://hivetoons.org/series/lookism/chapter-{N}" → "https://hivetoons.org/series/lookism"
  const seriesUrl = getSeriesIndexUrl(s.pattern);
  if (!seriesUrl) return null;

  const res = await fetch(seriesUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html',
      'Referer': new URL(seriesUrl).origin + '/'
    }
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const html = await res.text();

  // Find all chapter numbers in links
  const numbers = extractChapterNumbers(html, s.pattern);
  if (!numbers.length) return null;

  return Math.max(...numbers);
}

function getSeriesIndexUrl(pattern) {
  // Remove the chapter part to get series index
  // "https://hivetoons.org/series/lookism/chapter-{N}" → "https://hivetoons.org/series/lookism"
  // "https://manhuaus.com/manga/hero-x-demon-queen/chapter-{N}" → "https://manhuaus.com/manga/hero-x-demon-queen"
  // "https://asurascans.com/comics/solo-farming.../chapter/{N}" → "https://asurascans.com/comics/solo-farming..."
  const idx = pattern.indexOf('/chapter');
  if (idx > 0) return pattern.slice(0, idx);
  // Try removing last path segment with {N}
  const parts = pattern.split('/');
  while (parts.length && parts[parts.length - 1].includes('{N}')) parts.pop();
  return parts.join('/') || null;
}

function extractChapterNumbers(html, pattern) {
  const numbers = new Set();

  // Only look in href attributes that match the chapter pattern
  // This avoids picking up random numbers from page content
  const chapterPart = pattern.split('/').pop().replace('{N}', '(\\d+)').replace('{n}', '(\\d+)');
  const patternRegex = new RegExp(chapterPart, 'gi');

  // Extract only from href="..." to avoid random page numbers
  const hrefRegex = /href="([^"]+)"/gi;
  let hm;
  while ((hm = hrefRegex.exec(html)) !== null) {
    const href = hm[1];
    let m;
    patternRegex.lastIndex = 0;
    while ((m = patternRegex.exec(href)) !== null) {
      const num = parseInt(m[1], 10);
      if (num > 0 && num < 5000) numbers.add(num);
    }
  }

  // Fallback: generic chapter-N in hrefs only
  if (numbers.size === 0) {
    hrefRegex.lastIndex = 0;
    while ((hm = hrefRegex.exec(html)) !== null) {
      const href = hm[1];
      const cm = href.match(/chapter[-/](\d+)/i);
      if (cm) {
        const num = parseInt(cm[1], 10);
        if (num > 0 && num < 5000) numbers.add(num);
      }
    }
  }

  return [...numbers];
}
