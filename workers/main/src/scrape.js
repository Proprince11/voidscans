// =====================================================
// scrape.js — Webpage image scraper + ZIP downloader.
// Server-side fetches arbitrary public pages (no CORS limit
// since we're not in a browser) and pulls all image URLs.
// =====================================================

import { rehostFromUrl } from './upload.js';
import { makeZip } from './zip.js';

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

async function fetchPageHtml(target) {
  const res = await fetch(target, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JayaScans-Scraper/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    cf: { cacheTtl: 600 }
  });
  if (!res.ok) throw new Error(`Source returned ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('text/html') && !ct.includes('xhtml') && !ct.includes('xml')) {
    throw new Error(`Source returned ${ct}, not HTML`);
  }
  return res.text();
}

/** GET /api/scrape?url=X — returns JSON list of image URLs found on page. */
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
    const html = await fetchPageHtml(target);
    const images = extractImageUrls(html, target);
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    return Response.json({ ok: true, url: target, title, imageCount: images.length, images });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 502 });
  }
}

/** POST /api/scrape-rehost  body: { urls, series?, chapter? }
 *  Downloads given image URLs server-side and re-uploads to your storage. */
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

/** POST /api/zip-urls   body: { urls: [...], name?: "chapter-14" }
 *  Zips ONLY the given image URLs (the curated set after the user has
 *  removed/edited images in the preview). Downloads as one .zip. */
export async function handleZipUrls(request) {
  if (request.method !== 'POST') return new Response('POST only', { status: 405 });
  let body;
  try { body = await request.json(); }
  catch { return new Response('Invalid JSON body', { status: 400 }); }

  let images = Array.isArray(body?.urls) ? body.urls.filter(Boolean) : [];
  if (!images.length) return new Response('"urls" array required', { status: 400 });
  if (images.length > 100) images = images.slice(0, 100);

  const files = [];
  let i = 0;
  for (const imgUrl of images) {
    i++;
    try {
      const imgHost = new URL(imgUrl).hostname;
      const referer = imgHost.endsWith('mangadex.org')
        ? 'https://mangadex.org/'
        : new URL(imgUrl).origin + '/';
      const res = await fetch(imgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; JayaScans/1.0)',
          'Accept': 'image/*,*/*;q=0.8',
          'Referer': referer
        }
      });
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') || 'image/jpeg';
      if (!ct.startsWith('image/')) continue;
      const buf = new Uint8Array(await res.arrayBuffer());
      const padded = String(i).padStart(3, '0');
      const ext = (imgUrl.match(/\.(jpe?g|png|webp|gif|avif)(?:\?|$|#)/i)?.[1]
        || ct.split('/')[1] || 'jpg').toLowerCase();
      files.push({ name: `${padded}.${ext}`, data: buf });
    } catch { /* skip */ }
  }
  if (!files.length) return new Response('All image downloads failed', { status: 502 });

  const zip = makeZip(files);
  const safeName = String(body.name || 'images').replace(/[^a-z0-9-_]/gi, '_').slice(0, 60) || 'images';
  return new Response(zip, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeName}.zip"`,
      'Content-Length': String(zip.length),
      'X-Image-Count': String(files.length)
    }
  });
}

/** GET /api/scrape-zip?url=X
 *  Fetches the page, downloads every image, and streams a ZIP back as
 *  a downloadable file. The user gets one zip-per-webpage saved locally. */
export async function handleScrapeZip(request) {
  const target = new URL(request.url).searchParams.get('url');
  if (!target) return new Response('url query param required', { status: 400 });
  let parsed;
  try { parsed = new URL(target); }
  catch { return new Response('Invalid URL', { status: 400 }); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return new Response('Only http/https supported', { status: 400 });
  }

  let images;
  try {
    const html = await fetchPageHtml(target);
    images = extractImageUrls(html, target);
  } catch (err) {
    return new Response(`Scrape failed: ${err.message}`, { status: 502 });
  }
  if (!images.length) {
    return new Response('No images found on page', { status: 404 });
  }
  if (images.length > 100) {
    images = images.slice(0, 100);
  }

  // Download all images sequentially. Skip failures so one bad URL
  // doesn't kill the whole zip.
  const files = [];
  let i = 0;
  for (const imgUrl of images) {
    i++;
    try {
      // Use mangadex.org Referer if it's a MangaDex CDN URL
      const imgHost = new URL(imgUrl).hostname;
      const referer = imgHost.endsWith('mangadex.org')
        ? 'https://mangadex.org/'
        : new URL(imgUrl).origin + '/';
      const res = await fetch(imgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; JayaScans/1.0)',
          'Accept': 'image/*,*/*;q=0.8',
          'Referer': referer
        }
      });
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') || 'image/jpeg';
      if (!ct.startsWith('image/')) continue;
      const buf = new Uint8Array(await res.arrayBuffer());
      const padded = String(i).padStart(3, '0');
      const ext = (imgUrl.match(/\.(jpe?g|png|webp|gif|avif)(?:\?|$|#)/i)?.[1]
        || ct.split('/')[1]
        || 'jpg').toLowerCase();
      files.push({ name: `${padded}.${ext}`, data: buf });
    } catch { /* skip failed */ }
  }

  if (!files.length) {
    return new Response('All image downloads failed', { status: 502 });
  }

  const zip = makeZip(files);

  const pageHost = parsed.hostname.replace(/^www\./, '');
  const slugFromPath = parsed.pathname
    .split('/').filter(Boolean).slice(-2).join('-')
    .replace(/[^a-z0-9-]/gi, '_')
    .slice(0, 60) || 'page';
  const filename = `${pageHost}-${slugFromPath}.zip`;

  return new Response(zip, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(zip.length),
      'X-Image-Count': String(files.length),
      'X-Source-Count': String(images.length)
    }
  });
}
