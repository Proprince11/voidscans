# VoidScans Main Worker

This is the main Worker that powers `voidscans.isthe.workers.dev`. It serves both:

1. **API routes** (server-side logic — proxies, scrapers, RSS, sitemap)
2. **Static assets** (the SPA HTML/CSS/JS) via the `ASSETS` binding

## Routes

### API
| Path | Method | Purpose |
|---|---|---|
| `/api/health` | GET | `{ ok: true, t: timestamp }` |
| `/api/upload` | POST | Single-file upload — proxies to Catbox or R2 |
| `/api/bulk-upload` | POST | Multi-file upload (used by chapter form bulk uploader) |
| `/api/scrape?url=X` | GET | Scrape `<img>` URLs from a public webpage |
| `/api/scrape-rehost` | POST | Download given image URLs and re-upload to Catbox/R2 |
| `/api/mangadex/manga/:uuid` | GET | MangaDex API proxy (CORS workaround) |

### Feeds
| Path | Purpose |
|---|---|
| `/rss` | Global feed, latest 30 chapters across all series |
| `/rss/series/:slug` | Per-series feed, latest 50 chapters |
| `/sitemap.xml` | Auto-generated XML sitemap |

### Everything else
Falls through to `env.ASSETS.fetch(request)` — Cloudflare's static asset server, which respects `_redirects`, `_headers`, and serves `/index.html` as the SPA fallback.

## Storage backends

By default uploads go to **Catbox** (anonymous, free, no setup).

If you bind an R2 bucket later, uploads go to R2 instead. Set up:

```bash
# In Cloudflare dashboard → R2 → create bucket "voidscans-images"
# Enable public access on it. Get the public URL like https://pub-XXXXX.r2.dev

# Then in wrangler.jsonc, add:
#   "r2_buckets": [{ "binding": "R2_BUCKET", "bucket_name": "voidscans-images" }]
#   "vars": { "R2_PUBLIC_BASE": "https://pub-XXXXX.r2.dev" }
```

The `upload.js` code auto-detects the binding and uses R2 when present.

## Why a Worker (instead of pure static)?

Three things require server-side fetching that browsers can't do:

1. **MangaDex API** — doesn't enable CORS, browsers can't call it directly. Proxy fixes that.
2. **Webpage scraping** — fetching arbitrary public pages from a browser is blocked by CORS. Server has no such restriction.
3. **Catbox upload** — Catbox doesn't enable CORS, so browser uploads fail. Server-side multipart works fine.

## Development

```bash
cd workers/main
npx wrangler dev    # local dev server
npx wrangler deploy # production deploy (already auto-deployed via Git integration)
```

The Git integration on `main` auto-deploys on push.
