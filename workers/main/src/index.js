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
// AUTH — Cryptographically verify Firebase ID token + admin claim.
//
// Why this matters: the old code only *decoded* the JWT payload without
// verifying the signature. That meant anyone could craft a fake token
// with { "admin": true } and pass auth. This version fetches Firebase's
// real RSA-256 public keys and verifies the token's signature, making
// it impossible to forge without Google's private key.
// =====================================================

// Cache Firebase public keys for up to 1 hour to avoid fetching on every request.
let _pubKeyCache = null;
let _pubKeyCacheExpires = 0;

/**
 * Fetch Firebase's current RSA public keys (rotated periodically by Google).
 * Returns a map of { kid: CryptoKey } for RS256 signature verification.
 */
async function getFirebasePublicKeys() {
  const now = Date.now();
  if (_pubKeyCache && now < _pubKeyCacheExpires) return _pubKeyCache;

  const res = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
    { cf: { cacheTtl: 3600 } }
  );
  if (!res.ok) throw createError(500, 'Failed to fetch Firebase public keys');

  // Respect the Cache-Control max-age from Google's response
  const cacheControl = res.headers.get('Cache-Control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;

  const certMap = await res.json(); // { kid: "-----BEGIN CERTIFICATE-----..." }
  const keyMap = {};

  for (const [kid, cert] of Object.entries(certMap)) {
    // Strip PEM headers and decode the DER-encoded X.509 certificate
    const pem = cert.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\n/g, '');
    const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
    // Import the certificate's SubjectPublicKeyInfo for RS256 verify operations
    const cryptoKey = await crypto.subtle.importKey(
      'spki',
      der,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    keyMap[kid] = cryptoKey;
  }

  _pubKeyCache = keyMap;
  _pubKeyCacheExpires = now + maxAge * 1000;
  return keyMap;
}

/**
 * Decode a base64url-encoded string to a Uint8Array.
 * JWT uses URL-safe base64 (- instead of +, _ instead of /).
 */
function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  const binary = atob(padded);
  return new Uint8Array([...binary].map(c => c.charCodeAt(0)));
}

/**
 * Full JWT verification:
 * 1. Parse header → get the key ID (kid) and confirm RS256 algorithm
 * 2. Fetch Firebase's matching public key
 * 3. Cryptographically verify the RS256 signature — cannot be forged
 * 4. Validate standard claims: exp, iat, aud, iss
 * 5. Confirm the `admin` custom claim is present and true
 *
 * Throws a 401/403 createError if anything is invalid.
 * Returns the verified payload object on success.
 */
async function verifyAdmin(request) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw createError(401, 'No authorization token provided');

  const parts = token.split('.');
  if (parts.length !== 3) throw createError(401, 'Invalid token format');

  const [headerB64, payloadB64, signatureB64] = parts;

  // 1. Decode header to get kid and algorithm
  let header;
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64)));
  } catch {
    throw createError(401, 'Invalid token header');
  }
  if (header.alg !== 'RS256') throw createError(401, `Unsupported algorithm: ${header.alg}`);
  if (!header.kid) throw createError(401, 'Token missing key ID (kid)');

  // 2. Get the Firebase public key that matches this token's kid
  const keys = await getFirebasePublicKeys();
  const publicKey = keys[header.kid];
  if (!publicKey) {
    throw createError(401, 'Unknown signing key — token may be expired or forged');
  }

  // 3. Verify the RS256 signature — this is the critical security check.
  //    Only Google's Firebase private key can produce a valid signature,
  //    so any forged token will fail here regardless of payload contents.
  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecode(signatureB64);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, signedData);
  if (!valid) throw createError(401, 'Invalid token signature — token may be forged');

  // 4. Decode payload and validate standard claims
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
  } catch {
    throw createError(401, 'Invalid token payload');
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) throw createError(401, 'Token expired');
  if (!payload.iat || payload.iat > now + 60) throw createError(401, 'Token issued in the future');
  if (payload.aud !== FIREBASE_PROJECT_ID) throw createError(401, 'Token audience mismatch');
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) {
    throw createError(401, 'Token issuer mismatch');
  }

  // 5. Confirm the Firebase custom claim admin=true is set on this user
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

      // ---- Admin-only endpoints (verified with full RS256 signature check) ----
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
