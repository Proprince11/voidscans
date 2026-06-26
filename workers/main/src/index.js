// =====================================================
// JayaScans Main Worker — API endpoints for admin tools.
//
// Endpoints:
//   GET  /api/scrape?url=...          → extract images from a webpage
//   POST /api/scrape-rehost           → scrape + re-host images
//   POST /api/upload                  → upload file to storage
//   GET  /api/proxy-image?url=...     → reverse proxy for hotlinked images
//   POST /api/zip-urls                → bundle URLs into a ZIP
//   GET  /api/scrape-zip?url=...      → scrape + download as ZIP
//   GET  /api/mangadex/manga/:id      → MangaDex proxy (CORS workaround)
//   GET  /api/storage-info            → storage backend status
//   GET  /sitemap.xml                 → auto-generated sitemap
//   GET  /rss                         → RSS feed
//
// Auth: admin-only endpoints verify Firebase ID token + admin claim.
// =====================================================

import { handleScrape, handleScrapeRehost, handleZipUrls, handleScrapeZip } from './scrape.js';
import { handleUpload, handleStorageInfo } from './upload.js';
import { handleProxyImage, handleMangaDexProxy } from './proxy.js';
import { handleSitemap } from './sitemap.js';
import { handleGlobalRss, handleSeriesRss } from './rss.js';

const FIREBASE_PROJECT_ID = 'voidscans-6c66b';

// =====================================================
// AUTH — verify Firebase ID token + admin claim
// =====================================================
function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  const binary = atob(padded);
  return new Uint8Array([...binary].map(c => c.charCodeAt(0)));
}

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw createError(401, 'Invalid token format');
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
}

async function verifyAdmin(request) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw createError(401, 'No authorization token provided');

  const payload = decodeJwtPayload(token);
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) throw createError(401, 'Token expired');
  if (payload.aud !== FIREBASE_PROJECT_ID) throw createError(401, 'Token audience mismatch');
  if (!payload.admin) throw createError(403, 'Not an admin');
  return payload;
}

function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function cors(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  headers.set('Access-Control-Expose-Headers', 'Content-Disposition, X-Image-Count, X-Source-Count');
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

// =====================================================
// MAIN FETCH HANDLER
// =====================================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }));
    }

    try {
      // ---- Public endpoints (no auth) ----
      if (path === '/sitemap.xml') return handleSitemap(request, env);
      if (path === '/rss' || path === '/rss.xml') return handleGlobalRss(request, env);
      if (path.startsWith('/rss/series/')) {
        const slug = path.replace('/rss/series/', '').replace(/\/$/, '');
        return handleSeriesRss(request, env, slug);
      }
      if (path === '/api/proxy-image') return handleProxyImage(request, env);
      if (path.startsWith('/api/mangadex/manga/')) {
        const uuid = path.replace('/api/mangadex/manga/', '').replace(/\/$/, '');
        return cors(await handleMangaDexProxy(request, uuid));
      }
      if (path === '/api/storage-info') return cors(await handleStorageInfo(request, env));

      // ---- Admin-only endpoints (verify token) ----
      if (path === '/api/scrape' && request.method === 'GET') {
        await verifyAdmin(request);
        return cors(await handleScrape(request));
      }
      if (path === '/api/scrape-rehost' && request.method === 'POST') {
        await verifyAdmin(request);
        return cors(await handleScrapeRehost(request, env));
      }
      if (path === '/api/upload' && request.method === 'POST') {
        await verifyAdmin(request);
        return cors(await handleUpload(request, env));
      }
      if (path === '/api/zip-urls' && request.method === 'POST') {
        await verifyAdmin(request);
        return cors(await handleZipUrls(request));
      }
      if (path === '/api/scrape-zip' && request.method === 'GET') {
        await verifyAdmin(request);
        return cors(await handleScrapeZip(request));
      }

      // Fall through to static assets (handled by wrangler assets binding)
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response('Not found', { status: 404 });
    } catch (err) {
      if (err.status) {
        return cors(Response.json({ ok: false, error: err.message }, { status: err.status }));
      }
      console.error('Worker error:', err);
      return cors(Response.json({ ok: false, error: 'Internal server error' }, { status: 500 }));
    }
  }
};
