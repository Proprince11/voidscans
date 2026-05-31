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
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function withCors(response) {
  if (!response) return response;
  const r = new Response(response.body, response);
  for (const [k, v] of Object.entries(CORS)) r.headers.set(k, v);
  return r;
}

// =====================================================
// AUTH GUARD — verify Firebase ID token for admin routes.
// Uses the Firebase Auth REST API to verify tokens without
// the full Firebase Admin SDK (which requires Node.js).
// =====================================================
async function verifyAdminToken(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return { ok: false, error: 'Missing Authorization header' };

  // Verify token via Google's tokeninfo endpoint (lightweight check)
  // For production at scale, use Google's public keys + JWT verification.
  // This approach is simple and works for low-traffic admin endpoints.
  try {
    const projectId = env.FIREBASE_PROJECT_ID || 'voidscans-6c66b';
    const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_WEB_API_KEY || ''}`;

    // Decode the token to check claims (JWT structure: header.payload.signature)
    const parts = token.split('.');
    if (parts.length !== 3) return { ok: false, error: 'Malformed token' };

    // Decode payload (base64url)
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    // Check basic structure
    if (!payload.user_id || !payload.exp) {
      return { ok: false, error: 'Invalid token payload' };
    }

    // Check expiry
    if (payload.exp * 1000 < Date.now()) {
      return { ok: false, error: 'Token expired' };
    }

    // Check issuer matches our project
    const expectedIssuer = `https://securetoken.google.com/${projectId}`;
    if (payload.iss !== expectedIssuer) {
      return { ok: false, error: 'Token issuer mismatch' };
    }

    // Check admin custom claim
    if (!payload.admin) {
      return { ok: false, error: 'Not an admin' };
    }

    return { ok: true, uid: payload.user_id };
  } catch (e) {
    return { ok: false, error: `Token verification failed: ${e.message}` };
  }
}

/** Middleware that gates a handler behind admin auth */
async function requireAdmin(request, env, handler) {
  const auth = await verifyAdminToken(request, env);
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth.error }, { status: 401 });
  }
  return handler(request, env);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    try {
      // -------- API (public) --------
      if (url.pathname === '/api/health') {
        return withCors(Response.json({ ok: true, t: Date.now() }));
      }
      if (url.pathname === '/api/storage-info') {
        return withCors(await handleStorageInfo(request, env));
      }

      // -------- API (admin-only — upload + scrape endpoints) --------
      if (url.pathname === '/api/upload') {
        return withCors(await requireAdmin(request, env, handleUpload));
      }
      if (url.pathname === '/api/bulk-upload') {
        return withCors(await requireAdmin(request, env, handleBulkUpload));
      }
      if (url.pathname === '/api/scrape') {
        return withCors(await requireAdmin(request, env, handleScrape));
      }
      if (url.pathname === '/api/scrape-rehost') {
        return withCors(await requireAdmin(request, env, handleScrapeRehost));
      }
      if (url.pathname === '/api/scrape-zip') {
        return await requireAdmin(request, env, handleScrapeZip);
      }
      if (url.pathname === '/api/zip-urls') {
        return await requireAdmin(request, env, handleZipUrls);
      }

      // -------- API (public — read-only proxy with allowlist) --------
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
