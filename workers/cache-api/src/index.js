// =====================================================
// JayaScans Cache Worker
//
// Sits between the browser and Firestore. Caches read
// responses at Cloudflare's edge so we don't blow through
// the Firestore free tier as traffic grows.
//
// Endpoints (all GET):
//   GET /api/series                  → list all series
//   GET /api/series/:slug            → one series
//   GET /api/chapters/:slug          → list chapters of a series
//   GET /api/chapter/:slug/:num      → one chapter
//   GET /api/health                  → { ok: true }
//
// All responses include CORS headers and Cache-Control.
// =====================================================

const TTL = {
  seriesAll: 300,      // 5 min
  seriesOne: 300,
  chaptersList: 120,   // 2 min
  chapterOne: 600      // 10 min (chapter content rarely changes)
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') return cors(env, new Response(null, { status: 204 }));
    if (request.method !== 'GET')     return cors(env, json({ error: 'Method not allowed' }, 405));

    try {
      // /api/health
      if (url.pathname === '/api/health') return cors(env, json({ ok: true, t: Date.now() }));

      // /api/series
      if (url.pathname === '/api/series') {
        const data = await cachedFetch(ctx, request, TTL.seriesAll, async () => {
          const docs = await firestoreList(env, 'series');
          return docs.map(d => normalizeSeries(d));
        });
        return cors(env, json(data, 200, TTL.seriesAll));
      }

      // /api/series/:slug
      let m = url.pathname.match(/^\/api\/series\/([^/]+)$/);
      if (m) {
        const slug = decodeURIComponent(m[1]);
        const data = await cachedFetch(ctx, request, TTL.seriesOne, async () => {
          const all = await firestoreList(env, 'series');
          const found = all.map(d => normalizeSeries(d)).find(s => s.slug === slug);
          if (!found) return { error: 'not_found' };
          return found;
        });
        return cors(env, json(data, data?.error ? 404 : 200, TTL.seriesOne));
      }

      // /api/chapters/:slug
      m = url.pathname.match(/^\/api\/chapters\/([^/]+)$/);
      if (m) {
        const slug = decodeURIComponent(m[1]);
        const data = await cachedFetch(ctx, request, TTL.chaptersList, async () => {
          const docs = await firestoreQuery(env, 'chapters', [
            { fieldPath: 'seriesSlug', op: 'EQUAL', value: { stringValue: slug } }
          ], { fieldPath: 'chapterNum', direction: 'DESCENDING' });
          return docs.map(d => normalizeChapter(d));
        });
        return cors(env, json(data, 200, TTL.chaptersList));
      }

      // /api/chapter/:slug/:num
      m = url.pathname.match(/^\/api\/chapter\/([^/]+)\/(\d+)$/);
      if (m) {
        const slug = decodeURIComponent(m[1]);
        const num  = Number(m[2]);
        const data = await cachedFetch(ctx, request, TTL.chapterOne, async () => {
          const docs = await firestoreQuery(env, 'chapters', [
            { fieldPath: 'seriesSlug', op: 'EQUAL', value: { stringValue: slug } },
            { fieldPath: 'chapterNum', op: 'EQUAL', value: { integerValue: String(num) } }
          ]);
          if (!docs.length) return { error: 'not_found' };
          return normalizeChapter(docs[0]);
        });
        return cors(env, json(data, data?.error ? 404 : 200, TTL.chapterOne));
      }

      return cors(env, json({ error: 'route_not_found' }, 404));
    } catch (err) {
      console.error(err);
      return cors(env, json({ error: 'internal', message: err.message }, 500));
    }
  }
};

// =====================================================
// CACHE WRAPPER (uses Cloudflare's edge cache)
// =====================================================
async function cachedFetch(ctx, request, ttl, fn) {
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: 'GET' });
  const hit = await cache.match(cacheKey);
  if (hit) {
    try { return await hit.json(); } catch { /* fall through */ }
  }
  const fresh = await fn();
  // Store in edge cache
  const stored = new Response(JSON.stringify(fresh), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${ttl}`
    }
  });
  ctx.waitUntil(cache.put(cacheKey, stored.clone()));
  return fresh;
}

// =====================================================
// FIRESTORE REST CALLS (no auth = public read; rules govern)
// =====================================================
async function firestoreList(env, collection) {
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}?pageSize=300`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Firestore list failed: ${res.status}`);
  const data = await res.json();
  return (data.documents || []).map(d => unwrap(d));
}

async function firestoreQuery(env, collection, filters = [], orderBy = null) {
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
  const where = filters.length === 1
    ? { fieldFilter: { field: { fieldPath: filters[0].fieldPath }, op: filters[0].op, value: filters[0].value } }
    : {
        compositeFilter: {
          op: 'AND',
          filters: filters.map(f => ({ fieldFilter: { field: { fieldPath: f.fieldPath }, op: f.op, value: f.value } }))
        }
      };
  const body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: filters.length ? where : undefined,
      orderBy: orderBy ? [{ field: { fieldPath: orderBy.fieldPath }, direction: orderBy.direction }] : undefined,
      limit: 300
    }
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Firestore query failed: ${res.status}`);
  const arr = await res.json();
  return (Array.isArray(arr) ? arr : [])
    .filter(r => r.document)
    .map(r => unwrap(r.document));
}

// Convert Firestore REST format to plain JS object
function unwrap(doc) {
  if (!doc) return null;
  const id = doc.name?.split('/').pop();
  const out = { _id: id };
  const fields = doc.fields || {};
  for (const k of Object.keys(fields)) out[k] = unwrapValue(fields[k]);
  return out;
}
function unwrapValue(v) {
  if (v == null) return null;
  if ('stringValue'    in v) return v.stringValue;
  if ('integerValue'   in v) return Number(v.integerValue);
  if ('doubleValue'    in v) return Number(v.doubleValue);
  if ('booleanValue'   in v) return !!v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue'      in v) return null;
  if ('arrayValue'     in v) return (v.arrayValue.values || []).map(unwrapValue);
  if ('mapValue'       in v) {
    const f = v.mapValue.fields || {};
    const o = {};
    for (const k of Object.keys(f)) o[k] = unwrapValue(f[k]);
    return o;
  }
  return null;
}

// =====================================================
// NORMALIZERS — match the frontend api.js shape
// =====================================================
function normalizeSeries(d) {
  if (!d) return null;
  return {
    id: d._id,
    slug: d.slug || d._id,
    title: d.title || 'Untitled',
    altTitles: d.altTitles || [],
    cover: d.cover || '',
    coverBlur: d.coverBlur || null,
    type: (d.type || 'manhwa').toLowerCase(),
    status: (d.status || 'ongoing').toLowerCase(),
    year: d.year || null,
    author: d.author || '',
    artist: d.artist || '',
    genres: d.genres || [],
    tags: d.tags || [],
    description: d.description || '',
    rating: d.rating || { average: 0, total: 0 },
    views: d.views || 0,
    followers: d.followers || 0,
    latestChapter: d.latestChapter || d.latestChapterNumber || 0,
    latestChapterAt: d.latestChapterAt || d.updatedAt || d.createdAt || null,
    featured: !!d.featured,
    hot: !!d.hot,
    new: !!d.new,
    createdAt: d.createdAt || null,
    updatedAt: d.updatedAt || null
  };
}

function normalizeChapter(d) {
  if (!d) return null;
  return {
    id: d._id,
    seriesSlug: d.seriesSlug || d.series || '',
    number: d.chapterNum ?? d.number ?? 0,
    title: d.title || '',
    pages: d.images || d.pages || [],
    views: d.views || 0,
    createdAt: d.createdAt || null
  };
}

// =====================================================
// HELPERS
// =====================================================
function json(data, status = 200, ttl = 0) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(ttl ? { 'Cache-Control': `public, max-age=${ttl}` } : {})
    }
  });
}
function cors(env, response) {
  const r = new Response(response.body, response);
  r.headers.set('Access-Control-Allow-Origin', env.ALLOW_ORIGIN || '*');
  r.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  r.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  r.headers.set('Vary', 'Origin');
  return r;
}
