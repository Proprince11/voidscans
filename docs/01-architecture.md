# 01 — Architecture

## High-level diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  USER BROWSER                                                   │
│                                                                 │
│  ┌────────────────────┐    ┌─────────────────────────────────┐  │
│  │  PWA Service Worker│    │  Single-Page App (vanilla JS)    │  │
│  │  - Shell precache  │    │  - Path router (View Transitions)│  │
│  │  - SWR for assets  │    │  - 8 views (home/browse/series/.)│  │
│  │  - Cache-first for │    │  - Schema-tolerant API layer     │  │
│  │    chapter images  │    │  - TTL cache (in-memory)         │  │
│  │  - Offline page    │    │  - IndexedDB library/history     │  │
│  └────────────────────┘    └────────────────┬─────────────────┘  │
│                                             │                    │
└─────────────────────────────────────────────┼────────────────────┘
                                              │
                  ┌───────────────────────────┴──────────────┐
                  │                                          │
                  ▼  (optional cache layer)                  ▼
   ┌──────────────────────────────────┐    ┌────────────────────────────┐
   │  Cloudflare Worker               │    │   Firebase Firestore       │
   │  /api/series, /api/chapters/...  │    │   - series/                │
   │  Edge cache 2–10 min             │    │   - chapters/              │
   │  Rules-respecting public reads   │    │   - reactions/             │
   └────────────┬─────────────────────┘    │   - ratings/               │
                │                          │   - series/{x}/comments/   │
                └──────────────────────────►   - users/* (Phase 2)      │
                                           └────────────────────────────┘

   ┌──────────────────────────────┐    ┌────────────────────────────┐
   │  Cloudflare Pages (CDN)      │    │   Cloudflare R2 (storage)  │
   │  Hosts HTML/CSS/JS/SW        │    │   Covers + chapter images  │
   │  Auto-deploy from GitHub     │    │   10 GB free                │
   └──────────────────────────────┘    └────────────────────────────┘
```

## Data flow examples

### "Open the home page"

1. Browser hits `/` → Cloudflare Pages serves cached HTML shell.
2. Service worker also returns shell from cache if present (faster repeat visits).
3. JS bundle loads → `app.js` registers routes → router resolves `/` → calls `home(params, ctx)`.
4. `home.js` calls `fetchHomeSections()` from `api.js`.
5. `api.js` checks in-memory TTL cache; if fresh, returns instantly.
6. If stale or empty, `api.js` calls Firestore directly (or Worker if you wired it up).
7. View renders shell instantly with skeletons, then populates as data arrives.

### "Open chapter 14 of Solo Raven"

1. Browser hits `/read/solo-raven/14`.
2. `_redirects` rewrites to `/index.html` (SPA shell).
3. Router matches `/read/:slug/:chapter` → calls `reader.js`.
4. `reader.js` fetches series + chapter + chapter list in parallel.
5. Chapter pages render full-bleed with lazy images.
6. `reader.js` posts `PRECACHE_IMAGES` message to service worker.
7. Service worker caches all chapter URLs in `IMAGE_CACHE` (cache-first, persistent).
8. User can read offline next time.

### "Admin adds a new chapter"

1. Admin opens `/admin` → Auth gate via `verifyAdmin()` checks custom claim.
2. Tabs to Chapters → selects series → fills form → clicks Publish.
3. `api.createChapter()` writes to `/chapters/{auto-id}` in Firestore.
4. Same call updates the parent series's `latestChapter` and `latestChapterAt` (preserves `createdAt`).
5. Firestore Security Rules confirm `request.auth.token.admin == true` and accept the write.
6. Cache layer invalidates `chapters:solo-raven` and `series:` prefix.
7. Public site sees fresh chapter on next page load (or sooner if cache expires).

## Key design decisions

### Vanilla JS, no framework
- Zero npm install for the public site.
- Sub-100KB JS payload before gzip.
- No build step required for production (but optional minification can be added).
- View Transitions API gives smooth navigation without React/Astro overhead.

### Path-based routing
- `_redirects` rewrites unknown paths to `index.html`, then the router resolves.
- Better SEO than `#hash` routing.
- Direct linking works (`/series/solo-raven` is shareable).

### Schema-tolerant data layer
- The original Firebase schema used `chapterNum`, `images`, `latestChapter`.
- The new shape adds `altTitles`, `genres`, `tags`, `year`, etc.
- `api.js` `normalizeSeries()` reads BOTH shapes. Migration is opt-in via `scripts/migrate-schema.mjs`.

### IndexedDB for library
- Bookmarks, history, reading progress: all local.
- Future Phase 2: optional Firestore sync if signed in (per-user).
- No login required to use the library = better UX, fewer abandoned visits.

### Service worker strategy
| Resource | Strategy | Why |
|---|---|---|
| Shell HTML | Network-first w/ 3s timeout → cache | Fresh content fast, but shows cached shell offline |
| CSS/JS/local images | Stale-while-revalidate | Snappy + auto-updates |
| Cross-origin chapter images | Cache-first, persistent | Offline reading is the killer feature |
| Firebase API calls | Bypass | Firebase has its own offline handling |
| `/admin` | Bypass | Admin must always be fresh |

### Edge-cache Worker (optional)
- Sits between browser and Firestore.
- Caches at Cloudflare's edge (literally PoP-local).
- One Firestore read per 5 minutes serves thousands of users.
- Drops Firestore reads ~8×, extending free tier from 6K to 50K daily PVs.

## File ownership

| File / folder | Layer |
|---|---|
| `index.html` | Public SPA shell |
| `admin.html` | Admin SPA shell |
| `assets/css/*` | Design system |
| `assets/js/lib/*` | Cross-cutting libraries |
| `assets/js/views/*` | One per public route |
| `assets/js/admin/*` | One per admin tab |
| `sw.js` | PWA service worker |
| `workers/cache-api/*` | Edge cache Worker |
| `scripts/*` | Node maintenance scripts |
| `_redirects`, `_headers` | Cloudflare Pages config |

## Reading the code

Suggested entry points by goal:

- **"How does the home page work?"** → `assets/js/views/home.js`
- **"How is a chapter loaded?"** → `assets/js/views/reader.js`
- **"How do I add a new admin tab?"** → `assets/js/admin.js` (TABS object) + create a file in `assets/js/admin/`
- **"How does the data layer cache?"** → `assets/js/lib/api.js` (top of file: `cache`, `memoFetch`)
- **"How do I add a new route?"** → `assets/js/app.js` `router.register('/path/:param', viewFn)`
