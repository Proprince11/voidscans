// =====================================================
// proxy.js — Same-origin proxies to third-party APIs that
// don't enable CORS for browser requests.
//
// MangaDex API does NOT allow CORS from arbitrary origins,
// so the admin import widget can't call it directly from
// the browser. This Worker fetches it server-side.
// =====================================================

const MANGADEX_API = 'https://api.mangadex.org';

/** GET /api/mangadex/manga/:id  →  proxies to MangaDex with includes */
export async function handleMangaDexProxy(request, idOrPath) {
  // Whitelist: only allow /manga/{uuid} for safety
  const cleaned = String(idOrPath || '').replace(/[^a-z0-9-]/gi, '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleaned)) {
    return Response.json({ ok: false, error: 'Invalid MangaDex UUID' }, { status: 400 });
  }
  const url = `${MANGADEX_API}/manga/${cleaned}?includes[]=author&includes[]=artist&includes[]=cover_art`;
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'VoidScans/1.0 (admin)'
      },
      cf: { cacheTtl: 300 }
    });
    if (!res.ok) {
      return Response.json({ ok: false, error: `MangaDex returned ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
