// =====================================================
// proxy.js — Same-origin proxies to handle CORS issues
// and hotlink-protected image hosts.
// =====================================================

const MANGADEX_API = 'https://api.mangadex.org';

/** GET /api/mangadex/manga/:id — proxies to MangaDex with includes
 *  (MangaDex API doesn't enable CORS for browser origins) */
export async function handleMangaDexProxy(request, idOrPath) {
  const cleaned = String(idOrPath || '').replace(/[^a-z0-9-]/gi, '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleaned)) {
    return Response.json({ ok: false, error: 'Invalid MangaDex UUID' }, { status: 400 });
  }
  const url = `${MANGADEX_API}/manga/${cleaned}?includes[]=author&includes[]=artist&includes[]=cover_art`;
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'JayaScans/1.0 (admin)' },
      cf: { cacheTtl: 300 }
    });
    if (!res.ok) {
      return Response.json({ ok: false, error: `MangaDex returned ${res.status}` }, { status: 502 });
    }
    return Response.json(await res.json());
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// Hosts that block hotlinking. Requests to these need a matching Referer.
const HOTLINK_REFERERS = {
  'mangadex.org': 'https://mangadex.org/',
  'uploads.mangadex.org': 'https://mangadex.org/',
  'cdn.statically.io': 'https://mangadex.org/'
};

/** GET /api/proxy-image?url=X
 *  Server-side fetches an image with the right Referer header so
 *  hotlink-protected hosts (e.g. MangaDex CDN) serve the actual image
 *  instead of a "Read on …" placeholder. Streams response back. */
export async function handleProxyImage(request) {
  const url = new URL(request.url).searchParams.get('url');
  if (!url) return new Response('url query param required', { status: 400 });

  let target;
  try { target = new URL(url); }
  catch { return new Response('Invalid URL', { status: 400 }); }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return new Response('Only http/https URLs', { status: 400 });
  }

  // Pick a Referer for hotlink-protected hosts; fallback to source origin
  let referer = target.origin + '/';
  for (const [host, ref] of Object.entries(HOTLINK_REFERERS)) {
    if (target.hostname === host || target.hostname.endsWith('.' + host)) {
      referer = ref;
      break;
    }
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JayaScans/1.0)',
        'Accept': 'image/*,*/*;q=0.8',
        'Referer': referer
      },
      cf: { cacheTtl: 86400, cacheEverything: true }
    });
    if (!res.ok) {
      return new Response(`Source returned ${res.status}`, { status: 502 });
    }
    const ct = res.headers.get('content-type') || 'image/jpeg';
    if (!ct.startsWith('image/')) {
      return new Response('Source did not return an image', { status: 400 });
    }
    return new Response(res.body, {
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=86400, immutable',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}
