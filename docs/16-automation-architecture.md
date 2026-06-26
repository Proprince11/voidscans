# 16 — Manga/Manhwa Workflow Automation Architecture

## Current Workflow Analysis

### The Manual Process (per chapter)
1. Find source chapter page URL
2. Open URL in browser
3. Identify + download all page images locally
4. Upload images one-by-one to free image hosting (Catbox/ImgBB)
5. Copy each hosted URL
6. Paste URLs into admin panel
7. Set chapter number, title
8. Publish

**Time per chapter:** ~15-25 minutes manual work
**Time for 500 chapters:** ~125-200 hours

### Bottlenecks Identified

| Bottleneck | Impact | Current Solution |
|---|---|---|
| Manual image download | 5-10 min/chapter | None (browser save-as) |
| Sequential upload to hosts | 5-8 min/chapter | Admin bulk upload (partially working) |
| URL copy-paste | 3-5 min/chapter | Admin scrape tool (exists but Worker was missing) |
| No batch processing | Can't do 50 chapters at once | None |
| No scheduling | Must be online to publish | None |
| Single point of failure | If Catbox is down, workflow stops | Failover chain (now implemented) |

### Time Savings with Full Automation

| Task | Manual Time | Automated Time | Savings |
|---|---|---|---|
| Single chapter | 15-25 min | 30-60 seconds | **95%** |
| 10 chapters | 3-4 hours | 5-10 minutes | **95%** |
| 500 chapters (bulk import) | 125-200 hours | 2-4 hours (queue) | **98%** |

---

## Recommended Automation Architecture

### End-to-End Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│  AUTOMATION PIPELINE                                                     │
│                                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────────┐   │
│  │ Discovery│ →  │ Scraper  │ →  │ Storage  │ →  │ Database Insert  │   │
│  │          │    │          │    │ Upload   │    │ + Publish        │   │
│  └──────────┘    └──────────┘    └──────────┘    └──────────────────┘   │
│       │                │               │                │                │
│  Source URL       Extract imgs    Stream-upload     Firestore write      │
│  or RSS feed      server-side     to Catbox/R2      + series update     │
│  monitoring       (no local DL)   (parallel)        + Discord notify    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Architecture Components

#### 1. Chapter Discovery (Optional — for auto-tracking)
- **RSS/webhook monitoring** of source sites
- **Cron-triggered** checks every 15-60 min
- Stores discovered URLs in a queue

#### 2. Scraping Engine
- **Already implemented:** `/api/scrape` endpoint extracts images
- **Enhancement needed:** Queue-based batch processing for bulk imports

#### 3. Direct Stream-to-Storage (Zero Local Downloads)
- **Already implemented:** `/api/scrape-rehost` fetches source → uploads direct to Catbox
- **Key advantage:** Images never touch local disk. Source → Worker RAM → Storage.
- **Parallel processing:** 5 concurrent uploads per batch

#### 4. Database Insertion
- **Already implemented:** `createChapter()` writes to Firestore
- **Enhancement needed:** Batch API endpoint for bulk chapter creation

---

## Storage Architecture Comparison

| Backend | Cost (10GB) | Speed | Reliability | DMCA Safety | Setup |
|---------|------------|-------|-------------|-------------|-------|
| **Catbox** (current default) | Free | Good | Good | ✅ Separate | Zero |
| **Cloudflare R2** | Free (10GB) | Excellent | Excellent | ⚠️ Same account | 5 min |
| **Backblaze B2** | Free (10GB) | Good | Excellent | ✅ Separate | 10 min |
| **Bunny Storage** | $0.01/GB/mo | Excellent (CDN) | Excellent | ✅ Separate | 5 min |
| **Wasabi** | $6.99/TB/mo | Good | Excellent | ✅ Separate | 10 min |
| **ImgBB** (backup) | Free | Moderate | Moderate | ✅ Separate | 2 min |

### Recommendation
- **Primary:** Catbox (free, DMCA-separate, lossless) — already configured
- **Backup:** ImgBB (free, automatic failover) — add API key
- **Scale-up path:** Cloudflare R2 when you need CDN-level performance

---

## Bulk Import System (New Feature)

### Admin Panel Enhancement
Add a "Bulk Import" tab that accepts:
1. A list of chapter URLs (one per line)
2. Target series slug
3. Starting chapter number

The system then:
1. Queues all URLs
2. Scrapes each page for images
3. Re-hosts all images via the storage chain
4. Creates chapter docs in Firestore
5. Reports progress in real-time

### Implementation (Node.js Script)

```javascript
// scripts/bulk-import.mjs — Automated bulk chapter import
//
// Usage:
//   node bulk-import.mjs --series solo-raven \
//     --source "https://example.com/solo-raven/chapter-{N}" \
//     --start 1 --end 100 \
//     --concurrency 3
//
// The script:
// 1. Generates URLs from the pattern (chapter-1 through chapter-100)
// 2. Scrapes each URL for images (via the Worker /api/scrape)
// 3. Re-hosts images (via /api/scrape-rehost)
// 4. Creates chapters in Firestore
// 5. Logs progress and failures for retry
```

### Implementation (Python Alternative)

```python
# scripts/bulk_import.py — Python bulk importer
#
# Uses asyncio + aiohttp for high-concurrency scraping.
# Stores state in SQLite for crash recovery.
#
# pip install aiohttp firebase-admin rich
#
# python bulk_import.py \
#   --series solo-raven \
#   --urls chapters.txt \
#   --workers 5
```

---

## Queue & Batch Processing Architecture

### For Small-Scale (< 100 chapters/day) — Current Stack
- **No external queue needed.** The Worker handles batches of 5 concurrent uploads.
- **Admin panel** provides real-time progress.
- **Retry:** Manual (re-click failed chapters).

### For Medium-Scale (100-1000 chapters/day)
- **BullMQ** (Node.js) or **Celery** (Python) on a $5/mo VPS
- **Redis** as message broker
- **Worker** still handles the actual upload/rehost
- Queue manages scheduling, retries, rate limiting

```
┌──────────┐     ┌──────────┐     ┌──────────────────┐
│ Admin UI │ →   │ Redis    │ →   │ Worker Process   │
│ (enqueue)│     │ (queue)  │     │ (5 concurrent)   │
└──────────┘     └──────────┘     │ - Scrape         │
                                   │ - Upload         │
                                   │ - DB write       │
                                   └──────────────────┘
```

### For Large-Scale (1000+ chapters/day)
- **Cloudflare Queues** (native, no extra infra)
- **Durable Objects** for state management
- **Parallel Workers** across edge locations

---

## Monitoring & Reliability

### Implemented
- Console logging in Worker (view via `wrangler tail`)
- Error responses with descriptive messages
- Failover chain (Catbox → ImgBB → R2)

### Recommended Additions
- **Cloudflare Analytics** (already free, zero setup)
- **Uptime monitoring:** BetterUptime or UptimeRobot (free tier)
- **Error tracking:** Sentry (free tier, 5K events/mo)
- **Dead-letter queue:** Failed uploads stored in Firestore `/failed-uploads` for manual retry

---

## Hosting Recommendations

### Budget Stack ($0/month)
- Cloudflare Pages (hosting)
- Cloudflare Workers (API, free tier: 100K requests/day)
- Firebase Firestore (database, free tier: 50K reads/day)
- Catbox (image storage, unlimited free)
- **Best for:** < 5K daily visitors, < 50 chapters/day

### Mid-Tier Stack (~$5-15/month)
- Everything above, plus:
- Cloudflare R2 ($0 for 10GB, $0.015/GB after)
- Hetzner VPS ($3.89/mo) for background queue worker
- Redis on VPS for job scheduling
- **Best for:** 5K-50K daily visitors, 50-200 chapters/day

### Enterprise Stack (~$50-100/month)
- Cloudflare Pro ($20/mo) — better caching + image optimization
- Cloudflare R2 with custom domain
- Dedicated queue system (Cloudflare Queues or AWS SQS)
- Multiple Worker instances
- Sentry for error tracking
- **Best for:** 50K+ daily visitors, 200+ chapters/day

---

## Open Source Tools for Automation

### Scraping
- **Puppeteer/Playwright** — headless browser for JS-rendered sites
- **Cheerio** — fast HTML parsing (what the Worker uses)
- **manga-dl** — existing manga downloader (Python, supports many sources)
- **HakuNeko** — desktop manga downloader with plugin system

### Image Processing
- **Sharp** (Node.js) — resize, convert to WebP, optimize
- **Pillow** (Python) — image manipulation
- **libvips** — fastest image processing library

### Queue Systems
- **BullMQ** (Node.js + Redis) — battle-tested job queue
- **Celery** (Python + Redis/RabbitMQ) — distributed task queue
- **Cloudflare Queues** — native, serverless

### Database Clients
- **firebase-admin** (Node.js/Python) — already used in scripts/
- **Firestore REST API** — used by Worker sitemap/RSS

---

## Implementation Priority

| Phase | Feature | Effort | Impact |
|-------|---------|--------|--------|
| ✅ Done | Worker API (scrape, rehost, upload, proxy) | 2-3 days | Critical |
| ✅ Done | Storage failover chain | 1 day | High |
| Next | Bulk import script (Node.js) | 1-2 days | Very High |
| Next | Admin "Bulk Import" tab | 2-3 days | Very High |
| Later | Background queue worker | 3-5 days | Medium |
| Later | Source RSS monitoring | 2-3 days | Medium |
| Later | Image optimization pipeline (WebP) | 1-2 days | Medium |

---

## Database Schema for Automation

### New Collection: `/import-jobs/{auto-id}`
```
{
  seriesSlug: string,
  sourceUrls: string[],        // list of chapter page URLs
  startChapter: number,
  status: 'queued' | 'processing' | 'completed' | 'failed',
  progress: {
    total: number,
    completed: number,
    failed: number
  },
  results: [{
    chapterNum: number,
    status: 'ok' | 'failed',
    pageCount: number,
    error?: string
  }],
  createdAt: timestamp,
  completedAt?: timestamp,
  createdBy: string (uid)
}
```

This allows the admin to:
1. Submit a bulk import job
2. Navigate away (job continues in background)
3. Check progress later
4. Retry failed chapters individually
