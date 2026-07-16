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
import { queryDocs, mintTokenFromKey } from './firestore.js';
import { servePrerenderedHome, refreshHomepageCache } from './ssr-home.js';

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
 * Extract SubjectPublicKeyInfo (SPKI) from a DER-encoded X.509 certificate.
 * X.509 structure: SEQUENCE { tbsCertificate, signatureAlgorithm, signatureValue }
 * tbsCertificate: SEQUENCE { version, serialNumber, signature, issuer, validity, subject, subjectPublicKeyInfo, ... }
 * We need the 7th element (index 6) of tbsCertificate.
 */
function extractSPKI(der) {
  // Parse outermost SEQUENCE (the certificate)
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error('Not a SEQUENCE');
  const certLen = readLength(der, offset);
  offset = certLen.next;

  // First element: tbsCertificate (SEQUENCE)
  if (der[offset] !== 0x30) throw new Error('tbsCertificate not SEQUENCE');
  const tbsStart = offset;
  const tbsLen = readLength(der, offset + 1);
  offset = tbsLen.next;

  // Walk through tbsCertificate fields to find subjectPublicKeyInfo (7th field)
  // Fields: [0] version (explicit tag), serialNumber, signature, issuer, validity, subject, subjectPublicKeyInfo
  let fieldIndex = 0;
  const targetField = 6; // subjectPublicKeyInfo is at index 6

  while (fieldIndex <= targetField && offset < tbsStart + 1 + tbsLen.value + (tbsLen.next - tbsStart - 1)) {
    const fieldStart = offset;
    const tag = der[offset++];
    const len = readLength(der, offset);
    offset = len.next + len.value;

    if (fieldIndex === targetField) {
      // Return the entire TLV of subjectPublicKeyInfo
      return der.slice(fieldStart, offset);
    }
    fieldIndex++;
  }
  throw new Error('Could not find SPKI in certificate');
}

function readLength(buf, offset) {
  const first = buf[offset];
  if (first < 0x80) {
    return { value: first, next: offset + 1 };
  }
  const numBytes = first & 0x7f;
  let value = 0;
  for (let i = 0; i < numBytes; i++) {
    value = (value << 8) | buf[offset + 1 + i];
  }
  return { value, next: offset + 1 + numBytes };
}

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
    // Extract SubjectPublicKeyInfo from the X.509 certificate (ASN.1 DER)
    const spki = extractSPKI(der);
    const cryptoKey = await crypto.subtle.importKey(
      'spki',
      spki,
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
// SERVER-SIDE VIEW TRACKING
// Rate-limited by client IP + series/chapter key.
// Uses Firestore REST transform (increment) to atomically bump view counts.
// No auth required, but throttled to 1 view per IP per key per 60s.
// =====================================================
const _viewRateMap = new Map(); // key: `${ip}:${docKey}` → expiry timestamp

function isRateLimited(ip, docKey) {
  const k = `${ip}:${docKey}`;
  const now = Date.now();
  const exp = _viewRateMap.get(k);
  if (exp && now < exp) return true;
  _viewRateMap.set(k, now + 60_000); // 60s window
  // Evict stale entries periodically (keeps map from growing unbounded)
  if (_viewRateMap.size > 5000) {
    for (const [key, ts] of _viewRateMap) {
      if (ts < now) _viewRateMap.delete(key);
    }
  }
  return false;
}

// =====================================================
// SERVICE ACCOUNT TOKEN MINTING
// Self-mints a Google OAuth2 access token from the service account JSON
// stored in env.FIREBASE_SA_KEY (encrypted secret). Caches for 55 min.
// This avoids manual token rotation — the Worker handles it automatically.
// =====================================================
let _saTokenCache = null;
let _saTokenExpires = 0;

async function getServiceAccountToken(env) {
  // Support both: a pre-minted bearer token (FIREBASE_SA_TOKEN) or
  // a full service account JSON key (FIREBASE_SA_KEY) for self-minting.
  if (env.FIREBASE_SA_TOKEN) return env.FIREBASE_SA_TOKEN;
  if (!env.FIREBASE_SA_KEY) return null;

  const now = Date.now();
  if (_saTokenCache && now < _saTokenExpires) return _saTokenCache;

  try {
    const token = await mintTokenFromKey(env.FIREBASE_SA_KEY);
    _saTokenCache = token;
    _saTokenExpires = now + 55 * 60 * 1000;
    return token;
  } catch (e) {
    console.error('[sa-token] Failed to mint token:', e.message);
    return null;
  }
}

async function handleTrackView(request, env) {
  try {
    const body = await request.json();
    const { type, slug, chapter } = body || {};

    if (!slug || typeof slug !== 'string' || slug.length > 200) {
      return Response.json({ ok: false, error: 'Invalid slug' }, { status: 400 });
    }
    if (type !== 'series' && type !== 'chapter' && type !== 'article') {
      return Response.json({ ok: false, error: 'type must be "series", "chapter", or "article"' }, { status: 400 });
    }
    if (type === 'chapter' && (!chapter || isNaN(Number(chapter)))) {
      return Response.json({ ok: false, error: 'chapter number required' }, { status: 400 });
    }

    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
    const docKey = type === 'chapter' ? `ch:${slug}:${chapter}` : `series:${slug}`;

    if (isRateLimited(ip, docKey)) {
      return Response.json({ ok: true, counted: false, reason: 'rate-limited' });
    }

    const projectId = env.FIREBASE_PROJECT_ID;
    const token = await getServiceAccountToken(env);
    if (!token) {
      // Without SA credentials, can't write. Silently accept so it doesn't break the frontend.
      console.warn('[track-view] FIREBASE_SA_KEY not set, view not counted');
      return Response.json({ ok: true, counted: false, reason: 'no-write-access' });
    }

    const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

    if (type === 'series') {
      // Increment series.views using Firestore commit with transform
      await firestoreIncrement(baseUrl, token, `series/${slug}`, 'views');
    } else if (type === 'article') {
      // Increment article.views — articles use slug as doc ID
      await firestoreIncrement(baseUrl, token, `articles/${slug}`, 'views');
    } else {
      // For chapter, we need to find the doc by query first, then increment
      const queryUrl = `${baseUrl}:runQuery`;
      const queryRes = await fetch(queryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'chapters' }],
            where: {
              compositeFilter: {
                op: 'AND',
                filters: [
                  { fieldFilter: { field: { fieldPath: 'seriesSlug' }, op: 'EQUAL', value: { stringValue: slug } } },
                  { fieldFilter: { field: { fieldPath: 'chapterNum' }, op: 'EQUAL', value: { integerValue: String(Number(chapter)) } } }
                ]
              }
            },
            limit: 1
          }
        })
      });
      if (!queryRes.ok) {
        console.warn('[track-view] chapter query failed:', queryRes.status);
        return Response.json({ ok: true, counted: false, reason: 'query-failed' });
      }
      const results = await queryRes.json();
      const docPath = results?.[0]?.document?.name;
      if (!docPath) {
        return Response.json({ ok: true, counted: false, reason: 'chapter-not-found' });
      }
      // Extract relative path from full resource name
      const relPath = docPath.split('/documents/')[1];
      await firestoreIncrement(baseUrl, token, relPath, 'views');
      // Also increment the parent series view count
      await firestoreIncrement(baseUrl, token, `series/${slug}`, 'views');
    }

    return Response.json({ ok: true, counted: true });
  } catch (e) {
    console.error('[track-view] Error:', e.message);
    return Response.json({ ok: true, counted: false, reason: 'error' });
  }
}

/** Atomically increment a numeric field using Firestore commit with fieldTransforms. */
async function firestoreIncrement(baseUrl, token, docPath, field) {
  // Extract project ID from baseUrl: .../projects/{id}/databases/...
  const match = baseUrl.match(/projects\/([^/]+)\//);
  const projectId = match ? match[1] : FIREBASE_PROJECT_ID;
  const commitUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):commit`;
  const fullDocName = `projects/${projectId}/databases/(default)/documents/${docPath}`;

  const res = await fetch(commitUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      writes: [{
        transform: {
          document: fullDocName,
          fieldTransforms: [{
            fieldPath: field,
            increment: { integerValue: '1' }
          }]
        }
      }]
    })
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn(`[track-view] increment failed for ${docPath}.${field}:`, res.status, text.slice(0, 200));
  }
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

      // ---- Public endpoint: Server-side view tracking (rate-limited by IP) ----
      if (path === '/api/track-view' && request.method === 'POST') {
        return cors(await handleTrackView(request, env));
      }

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
      if (path === '/api/refresh-cache' && request.method === 'POST') {
        await verifyAdmin(request);
        await refreshHomepageCache(env);
        return cors(Response.json({ ok: true, message: 'Homepage cache refreshed' }));
      }

      // Fall through to static assets (handled by wrangler assets binding)
      // SSR: serve pre-rendered homepage for root page requests
      if ((path === '/' || path === '/index.html') && request.method === 'GET') {
        const accept = request.headers.get('Accept') || '';
        if (accept.includes('text/html')) {
          const ssrResponse = await servePrerenderedHome(request, env);
          if (ssrResponse) return ssrResponse;
        }
      }
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response('Not found', { status: 404 });
    } catch (err) {
      if (err.status) {
        return cors(Response.json({ ok: false, error: err.message }, { status: err.status }));
      }
      console.error('Worker error:', err);
      return cors(Response.json({ ok: false, error: 'Internal server error' }, { status: 500 }));
    }
  },

  // =====================================================
  // SCHEDULED — Cron trigger (hourly) for auto-publishing.
  // Set in wrangler.jsonc: [triggers] crons = ["0 * * * *"]
  //
  // What it does: Finds all chapters where:
  //   published === false  AND  publishAt <= Date.now()
  // Then flips published = true, clears publishAt, fires Discord webhook.
  //
  // Cost: 24 cron triggers/day vs 100,000 free on Cloudflare Workers.
  //       Essentially free forever.
  // =====================================================
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runScheduledPublish(env));
    ctx.waitUntil(refreshHomepageCache(env));
  }
};

async function runScheduledPublish(env) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const now = Date.now();

  let draftChapters = [];
  try {
    // Query chapters where published == false
    draftChapters = await queryDocs(
      projectId, 'chapters',
      [{ field: 'published', op: 'EQUAL', value: { booleanValue: false } }],
      null, 100
    );
  } catch (e) {
    console.error('[scheduler] Failed to fetch drafts:', e.message);
    return;
  }

  const { patchDoc } = await import('./firestore.js');

  // Filter down to only chapters whose scheduledPublish time has passed
  const toPublish = draftChapters.filter(c => c.publishAt && Number(c.publishAt) <= now);

  if (!toPublish.length) {
    console.log(`[scheduler] No chapters due for publishing. Checked ${draftChapters.length} drafts.`);
    return;
  }

  console.log(`[scheduler] Publishing ${toPublish.length} scheduled chapter(s)…`);

  const baseUrl = (env.PUBLIC_BASE_URL || 'https://voidscans.pages.dev').replace(/\/$/, '');
  const discordWebhook = env.DISCORD_WEBHOOK_URL;

  for (const ch of toPublish) {
    try {
      // 1. Flip to published in Firestore
      await patchDoc(projectId, 'chapters', ch._id, { published: true, publishAt: null }, env);
      console.log(`[scheduler] Published chapter ${ch.chapterNum} of ${ch.seriesSlug}`);

      // 2. Fire Discord webhook if configured
      if (discordWebhook) {
        const chapterUrl = `${baseUrl}/read/${ch.seriesSlug}/${ch.chapterNum}`;
        await fetch(discordWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              title: `📖 ${ch.seriesSlug} — Chapter ${ch.chapterNum}${ch.title ? `: ${ch.title}` : ''} is now live!`,
              url: chapterUrl,
              color: 0x7c3aed,
              footer: { text: 'Auto-published by scheduler' }
            }]
          })
        }).catch(e => console.warn('[scheduler] Discord webhook failed:', e.message));
      }
    } catch (e) {
      console.error(`[scheduler] Failed to publish chapter ${ch.chapterNum} of ${ch.seriesSlug}:`, e.message);
    }
  }
}

