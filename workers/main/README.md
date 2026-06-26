# JayaScans Worker

Cloudflare Worker providing server-side APIs for the admin panel.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/scrape?url=` | Admin | Extract images from a webpage |
| POST | `/api/scrape-rehost` | Admin | Scrape + re-host images to storage |
| POST | `/api/upload` | Admin | Upload a file to storage |
| GET | `/api/proxy-image?url=` | Public | Reverse proxy for hotlinked images |
| POST | `/api/zip-urls` | Admin | Bundle URLs into a downloadable ZIP |
| GET | `/api/mangadex/manga/:uuid` | Public | MangaDex API proxy (CORS bypass) |
| GET | `/api/storage-info` | Public | Storage backend status |
| GET | `/sitemap.xml` | Public | Auto-generated sitemap |
| GET | `/rss` | Public | RSS feed of latest chapters |

## Setup

```bash
cd workers/main
npm install
```

## Environment Variables

Set these in Cloudflare Dashboard → Workers → Settings → Variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `STORAGE_PRIMARY` | No | Primary storage backend: `catbox` (default), `imgbb`, or `r2` |
| `IMGBB_API_KEY` | No | ImgBB API key (enables backup storage) |
| `R2_PUBLIC_URL` | No | Public URL for R2 bucket (if using R2) |

## Development

```bash
npm run dev     # Start local dev server
npm run deploy  # Deploy to Cloudflare
```

## Storage Chain

Images are uploaded using a failover chain:

1. **Primary** (configurable via `STORAGE_PRIMARY`)
2. **Fallback 1** → next available backend
3. **Fallback 2** → remaining backend

Default chain: `Catbox → ImgBB → R2`

If any backend fails, the next in chain is tried automatically.
