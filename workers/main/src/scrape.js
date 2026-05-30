// =====================================================
// scrape.js — Webpage image scraper.
// Given a URL, fetches the HTML server-side (no CORS),
// extracts image URLs from <img>, <source>, lazy-load
// attributes, and CSS background-image references.
// =====================================================

import { rehostFromUrl } from './upload.js';

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)(?:\?|$|#)/i;

function resolveUrl(src, baseUrl) {
  if (!src) return null;
  src = src.trim();
  if (src.startsWith('data:')) return null;
  if (src.startsWith('//')) return 'https:' + src;
  try { return new URL(src, baseUrl).href; }
  catch { return null; }
}

export function extractImageUrls(html, pageUrl) {
  const urls = new Set();
  const patterns = [
    /<img\b[^>]*?\s(?:src|data-src|data-original|data-lazy-src|data-cfsrc|data-actualsrc)\s*=\s*["']([^"']+)["']/gi,
    /<img\b[^>]*?\ssrcset\s*=\s*["']([^"']+)["']/gi,
    /<source\b[^>]*?\ssrcset\s*=\s*["']([^"']+)["']/gi,
    /<link\b[^>]*?\srel\s*=\s*["']preload["'][^>]*?\shref\s*=\s*["']([^"']+)["']/gi,
    /background(?:-image)?\s*:\s*[^;]*url\(\s*["']?([^"')]+)["']?\s*\)/gi
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) {
      const candidates = m[1].split(',').map(s => s.trim().split(/\s+/)[0]);
      for (const raw of candidates) {
        const url = resolveUrl(raw, pageUrl);
        if (url && IMAGE_EXT.test(url)) urls.add(url);
      }
    }
  }
  return [...urls];
}

export async function handleScrape(request) {
  const target = new URL(request.url).searchParams.get('url');
  if (!target) {
    return Response.json({ ok: false, error: 'url query param required' }, { status: 400 });
  }
  let parsed;
  try { parsed = new URL(target); }
  catch { return Response.json({ ok: false, error: 'Invalid URL' }, { status: 400 }); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return Response.json({ ok: false, error: 'Only http/https supported' }, { status: 400 });
  }
  try {
    const res = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VoidScans-Scraper/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      cf: { cacheTtl: 600 }
    });
    if (!res.ok) {
      return Response.json({ ok: false, error: `Source returned ${res.status}` }, { status: 502 });
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html') && !ct.includes('xhtml') && !ct.includes('xml')) {
      return Response.json({ ok: false, error: `Source returned ${ct}, not HTML` }, { status: 400 });
    }
    const html = await res.text();
    const images = extractImageUrls(html, target);
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    return Response.json({
      ok: true, url: target, title, imageCount: images.length, images
    });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function handleScrapeRehost(request, env) {
  if (request.method !== 'POST') {
    return Response.json({ ok: false, error: 'POST only' }, { status: 405 });
  }
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 }); }

  const { urls, series = 'misc', chapter = '' } = body || {};
  if (!Array.isArray(urls) || !urls.length) {
    return Response.json({ ok: false, error: '"urls" array required' }, { status: 400 });
  }
  if (urls.length > 200) {
    return Response.json({ ok: false, error: 'Max 200 images per batch' }, { status: 400 });
  }

  const safeSeries = String(series).replace(/[^a-z0-9-]/gi, '-') || 'misc';
  const safeChapter = String(chapter).replace(/[^0-9.]/g, '');

  const results = [];
  let i = 0;
  for (const u of urls) {
    i++;
    try {
      const padded = String(i).padStart(3, '0');
      const ext = (u.match(/\.(jpe?g|png|webp|gif|avif)(?:\?|$|#)/i)?.[1] || 'jpg').toLowerCase();
      const key = safeChapter
        ? `chapters/${safeSeries}/${safeChapter}/${padded}.${ext}`
        : `scraped/${safeSeries}/${Date.now()}-${padded}.${ext}`;
      const newUrl = await rehostFromUrl(env, u, key);
      results.push({ ok: true, source: u, url: newUrl });
    } catch (err) {
      results.push({ ok: false, source: u, error: err.message });
    }
  }
  return Response.json({ ok: true, results });
}
