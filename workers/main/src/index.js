// =====================================================
// JayaScans — main Worker.
//
// Handles:
//   /api/health                  GET    Health probe
//   /api/storage-info            GET    Which storage backend is active
//   /api/upload                  POST   Image upload (R2 / ImgBB / Catbox)
//   /api/bulk-upload             POST   Multi-file upload
//   /api/scrape                  GET    Extract image URLs from a webpage
//   /api/scrape-rehost           POST   Download given URLs and re-host
//   /api/scrape-zip              GET    Download all page images as ZIP
//   /api/proxy-image             GET    Proxy hotlink-protected images
//   /api/mangadex/manga/:uuid    GET    MangaDex API proxy (CORS workaround)
//   /rss                         GET    Global RSS feed
//   /rss/series/:slug            GET    Per-series RSS feed
//   /sitemap.xml                 GET    Auto-generated sitemap
//
// Anything else → falls through to env.ASSETS.fetch() (the static SPA).
// =====================================================

import { handleUpload, handleBulkUpload, handleStorageInfo } from './upload.js';
import { handleScrape, handleScrapeRehost, handleScrapeZip, handleZipUrls } from './scrape.js';
import { handleMangaDexProxy, handleProxyImage } from './proxy.js';
import { handleGlobalRss, handleSeriesRss } from './rss.js';
import { handleSitemap } from './sitemap.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function withCors(response) {
  if (!response) return response;
  const r = new Response(response.body, response);
  for (const [k, v] of Object.entries(CORS)) r.headers.set(k, v);
  return r;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    try {
      // -------- API --------
      if (url.pathname === '/api/health') {
        return withCors(Response.json({ ok: true, t: Date.now() }));
      }
      if (url.pathname === '/api/storage-info') {
        return withCors(await handleStorageInfo(request, env));
      }
      if (url.pathname === '/api/upload') {
        return withCors(await handleUpload(request, env));
      }
      if (url.pathname === '/api/bulk-upload') {
        return withCors(await handleBulkUpload(request, env));
      }
      if (url.pathname === '/api/scrape') {
        return withCors(await handleScrape(request));
      }
      if (url.pathname === '/api/scrape-rehost') {
        return withCors(await handleScrapeRehost(request, env));
      }
      if (url.pathname === '/api/scrape-zip') {
        // No CORS wrapper — this is a direct download response
        return await handleScrapeZip(request);
      }
      if (url.pathname === '/api/zip-urls') {
        return await handleZipUrls(request);
      }
      if (url.pathname === '/api/proxy-image') {
        return await handleProxyImage(request);
      }
      const mdMatch = url.pathname.match(/^\/api\/mangadex\/manga\/([^/]+)$/);
      if (mdMatch) {
        return withCors(await handleMangaDexProxy(request, mdMatch[1]));
      }

      // -------- RSS --------
      if (url.pathname === '/rss' || url.pathname === '/rss.xml') {
        return withCors(await handleGlobalRss(request, env));
      }
      const seriesRssMatch = url.pathname.match(/^\/rss\/series\/([^/]+?)(?:\.xml)?$/);
      if (seriesRssMatch) {
        return withCors(await handleSeriesRss(request, env, decodeURIComponent(seriesRssMatch[1])));
      }

      // -------- Sitemap --------
      if (url.pathname === '/sitemap.xml') {
        return withCors(await handleSitemap(request, env));
      }

      // -------- Static SPA fallback --------
      return env.ASSETS.fetch(request);
    } catch (err) {
      console.error('Worker error:', err);
      return Response.json({ ok: false, error: err.message }, { status: 500 });
    }
  }
};
