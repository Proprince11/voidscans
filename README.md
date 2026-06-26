# JayaScans

A premium manhwa, manga & manhua reading platform. Free forever, zero-budget hosting, runs on Cloudflare Pages + Firebase.

> Live at **[jayascans.online](https://jayascans.online)**.

```
Stack:    Vanilla JS SPA  ·  Cloudflare Pages  ·  Firebase Firestore  ·  Catbox/ImgBB
Cost:     $0/month (free tier) → ~$10/year (custom domain)
Targets:  Mobile-first, sub-1s LCP, PWA installable, offline reading
```

## Features

- 🏠 **Premium home** — Hero slider, latest updates, popular grid, genre filters, new arrivals
- 📚 **Browse / Search / Genre** — Filter by type, status, sort by popular/new/updated, ranked client-side search
- 📖 **Series detail** — Rating, 5 emoji reactions, share, bookmark, comments, related series, alt titles, genre pills
- 🎨 **Premium reader** — Pinch-to-zoom, fit-width/height modes, sequential loading with spinners, keyboard nav, swipe gestures, settings drawer, progress memory
- 📂 **Library** — Bookmarks (Reading / Completed / Plan to Read / Dropped), reading history, all in IndexedDB + optional cloud sync
- 🛠 **Full-CRUD admin** — Dashboard stats, series import (MangaDex/AniList), chapter form with drag-reorder + image previews, bulk upload, webpage scraper, comments moderation
- 📱 **PWA** — Installable, offline reading, service worker chapter cache
- ⚡ **Edge Workers** — Scraping, upload, image proxy, sitemap, RSS all at Cloudflare's edge
- 🔍 **SEO-ready** — Per-route meta, Open Graph, Twitter cards, canonical URLs, JSON-LD, auto sitemap, RSS feeds
- 🤖 **Automation tools** — Bulk import scripts, GUI grabber, alternating Catbox/ImgBB uploads, optional WebP conversion

---

## Chapter Upload Methods

All the ways to add chapters to your site, from simplest to most automated:

| # | Method | Speed | Best for |
|---|---|---|---|
| 1 | **Admin Panel (manual)** | ~5 min/chapter | Single chapters, quick edits |
| 2 | **Admin Scraper** | ~30 sec/chapter | One chapter at a time via browser |
| 3 | **Grabber GUI** | ~60 sec/chapter | Visual selection, remove junk images |
| 4 | **grab-chapter.mjs** | ~60 sec/chapter | Command line, single or batch |
| 5 | **local-import.mjs** | ~90 sec/chapter | Full auto: scrape → upload → publish |
| 6 | **bulk-import.mjs** | ~25 sec/chapter | Fast via Worker (may timeout on long chapters) |

### 1. Admin Panel (manual paste)
```
/admin → Chapters → New Chapter → paste image URLs → Publish
```
You already have the hosted image links. Just paste them line-by-line.

### 2. Admin Scraper (browser-based)
```
/admin → Chapters → New Chapter → "Scrape from Webpage" tab → paste source URL → Scan → Use Selected
```
Worker scrapes the page, re-hosts images, fills the form. Click Publish.

### 3. Grabber GUI (visual, local)
```bash
cd scripts
node grabber-gui.mjs
# Open http://localhost:3456
```
Paste URL → see thumbnails → click to deselect junk → Upload → Copy links → Paste in admin.
- Alternates Catbox/ImgBB (less stress on each)
- Optional WebP conversion (`npm install sharp`)
- Image proxy for preview thumbnails

### 4. grab-chapter.mjs (CLI, saves to file)
```bash
# Single chapter
node grab-chapter.mjs "https://source-site.com/manga/series/chapter-5"

# Batch (creates .txt files per chapter)
node grab-chapter.mjs --batch "https://source-site.com/manga/series/chapter-{N}" --start 1 --end 100
```
Output: `chapters-output/ch-001.txt` etc. Copy contents into admin.

### 5. local-import.mjs (full auto, runs on your PC)
```bash
node local-import.mjs --series slug-name \
  --pattern "https://source-site.com/manga/series/chapter-{N}" \
  --start 1 --end 100 --token YOUR_FIREBASE_TOKEN
```
Scrapes → uploads to Catbox → writes to Firestore → chapter goes live. No Worker needed.

### 6. bulk-import.mjs (via Worker, fastest but fragile)
```bash
node bulk-import.mjs --series slug-name \
  --pattern "https://source-site.com/manga/series/chapter-{N}" \
  --start 1 --end 100 --token YOUR_FIREBASE_TOKEN
```
Uses the deployed Worker for scraping/uploading. Faster but Worker has 30s timeout — may fail on chapters with 80+ images.

### Getting a token (for methods 5 & 6)
Open `/admin` in Chrome → F12 → Console:
```javascript
const { auth } = await import('/assets/js/lib/firebase.js');
console.log(await auth.currentUser.getIdToken());
```
Token lasts ~1 hour. Get a fresh one for each batch session.

---

## Quick Start

### Deploy the site
1. Push to GitHub
2. Cloudflare Pages → Connect repo → Deploy
3. Add `jayascans.online` as Custom Domain
4. Done — auto-deploys on every push.

### Deploy the Worker
```bash
cd workers/main
npm install
npx wrangler login
npx wrangler deploy
```

### Open admin
- `/admin` — sign in with your admin email
- First time? See **[docs/09-user-tasks.md](./docs/09-user-tasks.md)**

### Run scripts
```bash
cd scripts
npm install
node grant-admin.mjs you@example.com   # make yourself admin
node grabber-gui.mjs                    # open the GUI tool
```

---

## Documentation

| File | What's in it |
|---|---|
| **[docs/09-user-tasks.md](./docs/09-user-tasks.md)** | **Read first.** Setup tasks (security rules, admin claim, deploy). |
| [docs/01-architecture.md](./docs/01-architecture.md) | System diagram, data flow, design decisions. |
| [docs/02-content-guide.md](./docs/02-content-guide.md) | How to add a series and chapters (daily workflow). |
| [docs/03-admin-guide.md](./docs/03-admin-guide.md) | Admin panel walkthrough. |
| [docs/04-deploy.md](./docs/04-deploy.md) | Cloudflare Pages + Worker + custom domain. |
| [docs/05-troubleshooting.md](./docs/05-troubleshooting.md) | Common issues & fixes. |
| [docs/07-data-schema.md](./docs/07-data-schema.md) | Every Firestore field documented. |
| [docs/08-design-system.md](./docs/08-design-system.md) | Colors, fonts, spacing, components. |
| [docs/10-seo-guide.md](./docs/10-seo-guide.md) | SEO checklist for a scanlation SPA. |
| [docs/16-automation-architecture.md](./docs/16-automation-architecture.md) | Full automation pipeline design + hosting comparison. |
| [workers/main/README.md](./workers/main/README.md) | Worker API endpoints reference. |
| [workers/cache-api/README.md](./workers/cache-api/README.md) | Optional edge cache Worker. |
| [DMCA.md](./DMCA.md) | Takedown policy. |
| [CHANGELOG.md](./CHANGELOG.md) | Version history. |

---

## Repo Structure

```
jayascans/
├── index.html               ← SPA shell (the entire site)
├── admin/index.html         ← Admin SPA shell
├── manifest.webmanifest     ← PWA manifest
├── sw.js                    ← Service worker (offline, caching)
├── _redirects               ← Cloudflare Pages routing
├── _headers                 ← Security & cache headers
├── .assetsignore            ← Excludes non-public files from CDN
│
├── assets/
│   ├── css/                 ← Design system (tokens, reset, base, components, pages, admin)
│   ├── js/
│   │   ├── app.js           ← Main SPA entry (dynamic imports)
│   │   ├── admin.js         ← Admin SPA entry
│   │   ├── lib/             ← firebase, api, auth, router, ui, library, utils, settings
│   │   ├── views/           ← One file per route (home, browse, series, reader, library)
│   │   └── admin/           ← Admin tabs (dashboard, series, chapters, comments, tools, settings)
│   └── images/              ← Logo, icons, favicon
│
├── workers/
│   ├── main/                ← Main Worker (scrape, upload, proxy, sitemap, RSS)
│   └── cache-api/           ← Optional edge cache (reduces Firestore reads 8×)
│
├── scripts/
│   ├── grabber-gui.mjs      ← Visual GUI for chapter grabbing
│   ├── grab-chapter.mjs     ← CLI chapter grabber (single + batch)
│   ├── local-import.mjs     ← Full auto: scrape → upload → publish
│   ├── bulk-import.mjs      ← Worker-based bulk import
│   ├── grant-admin.mjs      ← Set Firebase admin claim
│   ├── backup-firestore.mjs ← Export all data to JSON
│   └── migrate-schema.mjs   ← Upgrade legacy docs
│
└── docs/                    ← All documentation
```

---

## Brand & Domain

Centralized for cheap rebrands:
- **Brand config**: `assets/js/lib/site.config.js`
- **Worker URLs**: `workers/main/wrangler.jsonc` → `PUBLIC_BASE_URL`
- **Static metadata**: `index.html`, `manifest.webmanifest`, `robots.txt`

See [docs/13-domain-and-rename.md](./docs/13-domain-and-rename.md) for the full swap procedure.

## License

Source code: see [LICENSE](./LICENSE).
Hosted manga images: see [DMCA.md](./DMCA.md).
