# 18 — File Reference & Architecture

Every file in the project, what it does, and how they connect.

---

## Root Files

| File | Purpose |
|---|---|
| `index.html` | Public SPA shell — the entire reader site loads from this one HTML file |
| `admin/index.html` | Admin panel SPA shell — separate app for content management |
| `sw.js` | Service Worker — caches pages offline, precaches chapter images |
| `offline.html` | Fallback page shown when completely offline |
| `manifest.webmanifest` | PWA manifest — installable app metadata |
| `robots.txt` | Tells search engines what to crawl (blocks /admin) |
| `_redirects` | Cloudflare Pages routing config (SPA fallback) |
| `_headers` | Security headers + cache control rules |
| `.assetsignore` | Tells Cloudflare Worker which files NOT to serve as static assets |
| `design-demo.html` | Temporary design preview (not deployed) |

---

## assets/css/ — Design System

| File | Purpose |
|---|---|
| `tokens.css` | All design tokens (colors, spacing, fonts, shadows, z-index, motion). Change here = entire site updates. Also contains theme overrides (light/sepia) and ad slot styles. |
| `reset.css` | CSS reset (normalize browser defaults) |
| `base.css` | Body styles, typography, containers, sections, layout utilities (.row, .stack, .gap-*), visibility helpers |
| `components.css` | Reusable UI components: buttons, cards, badges, tags, inputs, modals, toasts, comments, navbar, bottom-nav, hero, chapter list, file-drop, FAB |
| `pages.css` | Page-specific styles: browse layout, series detail, reader canvas, reader nav strip, reader recommendations, page loading states |
| `admin.css` | Admin panel styles: sidebar, tables, stats cards, upload helpers, image preview grid, login/auth screens |

**How they connect:** `index.html` loads them in order: tokens → reset → base → components → pages. Admin loads tokens → reset → base → components → admin.

---

## assets/js/lib/ — Shared Libraries

| File | Purpose | Key Exports |
|---|---|---|
| `firebase.js` | Initialize Firebase app + export `db` (Firestore) and `auth` instances | `app`, `db`, `auth` |
| `api.js` | ALL data reads/writes. In-memory TTL cache. Normalizes old/new schema. Tries edge cache Worker first, falls back to Firestore. | `fetchAllSeries`, `fetchChapters`, `fetchChapter`, `createSeries`, `createChapter`, `postComment`, `searchSeries`, etc. |
| `auth.js` | Firebase Auth wrapper. Sign in/up/out, Google auth, admin verification, token management. `adminFetch()` attaches auth headers. | `signIn`, `signUp`, `signOut`, `getUser`, `isAdmin`, `adminFetch` |
| `router.js` | Path-based SPA router with View Transitions. Registers route patterns, intercepts link clicks, handles back/forward. Global error catch. | `register`, `navigate`, `start`, `onAfterNavigate` |
| `settings.js` | Loads/caches/watches the admin-configurable site settings from Firestore `/site/settings`. localStorage fallback. | `getSettings`, `loadSettings`, `saveSettings`, `watchSettings` |
| `site.config.js` | Brand config (site name, domain, logo split, tagline, cache API URL). Single source of truth for rebranding. | `SITE`, `pageTitle()` |
| `library.js` | IndexedDB for bookmarks, reading history, progress. Cloud sync to Firestore when signed in. Reader preferences. | `addToLibrary`, `recordRead`, `getHistory`, `getReaderPrefs`, etc. |
| `branding.js` | Applies admin-uploaded logo, injects ad scripts into slots. Watches for live changes. | `applyBranding`, `watchBrandingChanges` |
| `theme.js` | Dark/light/sepia theme toggle. Persists to localStorage. | `applyInitialTheme`, `cycleTheme`, `getTheme` |
| `discord.js` | Fires Discord webhook embed when a chapter is published (admin-configured). | `announceChapter` |
| `account.js` | User profile management (display name, avatar). | `getProfile`, `onProfileChange` |
| `ui.js` | UI primitives: toast notifications, confirm modal, drawer, spinner, skeleton, progress bar, share, back-to-top FAB, auth modal. | `toast`, `confirmModal`, `drawer`, `spinner`, `openAuthModal` |
| `utils.js` | Pure utility functions: HTML escaping, slugify, timeAgo, debounce, throttle, proxyImage, setMeta (SEO), truncate, icon SVGs. | `esc`, `html`, `proxyImage`, `proxyReaderImage`, `setMeta`, `timeAgo`, etc. |

**Data flow:** Views call `api.js` → `api.js` checks in-memory cache → tries edge cache Worker → falls back to Firestore → normalizes data → returns to view.

---

## assets/js/views/ — Public Pages (one per route)

| File | Route | What it renders |
|---|---|---|
| `home.js` | `/` | Hero slider, continue reading, latest updates, popular grid, genre strip, new arrivals |
| `browse.js` | `/browse` | Filter panel (type/status/genre/sort), paginated card grid |
| `search.js` | `/search` | Client-side ranked search across all series |
| `genre.js` | `/genre/:slug` | Genre-filtered browse view |
| `series.js` | `/series/:slug` | Cover, metadata, stats, reactions, rating, comments (with GIF + replies), chapter list (with read progress badge), recommendations |
| `reader.js` | `/read/:slug/:chapter` | Full-bleed chapter reader: all images load immediately, loading spinners, tap-to-retry on failure, top/bottom nav, progress bar, next-chapter precache, keyboard/swipe nav |
| `library.js` | `/library` | Bookmarks (Reading/Completed/Planned/Dropped tabs), reading history |
| `profile.js` | `/profile` | User profile (display name, avatar, sign out) |
| `notFound.js` | `*` | 404 page |
| `_components.js` | (shared) | Reusable HTML builders: `seriesCard()`, `updateRow()`, `genreStrip()`, `emptyState()`, `buildRecommendations()`, `buildLatestUpdates()` |

**How routing works:** `app.js` registers all routes → user clicks link → `router.js` intercepts → dynamic `import()` loads the view module → view function renders into `#app` outlet.

---

## assets/js/admin/ — Admin Panel Tabs

| File | Tab | What it does |
|---|---|---|
| `dashboard.js` | Dashboard | Stats overview (series count, chapter count, ongoing/completed), recently updated table, quick action buttons |
| `series.js` | Series | Full CRUD: list with search, create/edit form with cover preview + genre toggles, MangaDex/AniList import |
| `chapters.js` | Chapters | Create/edit chapters: series selector, page URL textarea, bulk file upload, webpage scraper, drag-reorder preview, Discord announce on publish |
| `comments.js` | Comments | Moderation: list all comments across series, delete/flag |
| `reports.js` | Reports | Engagement analytics: reactions, ratings, comments, chapter counts per series, top performers, activity feed |
| `tools.js` | Tools | Image extractor (URL → curated ZIP download), storage backend status |
| `settings.js` | Settings | Site branding, monetization (Ko-fi, ads, Stripe/PayPal), integrations (Discord webhook), theme defaults, feature toggles |
| `import.js` | (used by series) | MangaDex + AniList metadata importers (auto-fills series form from external APIs) |

---

## assets/js/app.js — Main SPA Entry

**What it does:**
1. Applies theme from localStorage (no flash)
2. Loads site settings from Firestore
3. Registers all routes with dynamic imports (code-split)
4. Mounts navbar, bottom nav, footer, back-to-top FAB
5. Handles auth chrome (sign-in button / avatar dropdown)
6. Active nav highlighting + reader mode (hide nav)
7. Mobile menu drawer
8. Starts the router

---

## assets/js/admin.js — Admin SPA Entry

**What it does:**
1. Auth gate: shows login → verifies admin custom claim → shows admin shell (or "not authorized")
2. Hash-based tab router (`#dashboard`, `#series`, `#chapters`, etc.)
3. Each tab is an async function that renders into the outlet

---

## workers/main/ — Cloudflare Worker (API endpoints)

| File | Purpose |
|---|---|
| `src/index.js` | Main router: CORS, auth verification (JWT decode), routes requests to handlers |
| `src/scrape.js` | `GET /api/scrape` (extract images from URL), `POST /api/scrape-rehost` (scrape + upload), `POST /api/zip-urls` (bundle as ZIP), `GET /api/scrape-zip` |
| `src/upload.js` | `POST /api/upload` (file → Catbox/ImgBB/R2 with failover chain), storage info endpoint |
| `src/proxy.js` | `GET /api/proxy-image` (reverse proxy with Referer for hotlinked images), `GET /api/mangadex/manga/:uuid` (MangaDex CORS proxy) |
| `src/sitemap.js` | `GET /sitemap.xml` (auto-generated from Firestore series) |
| `src/rss.js` | `GET /rss` (global feed), `GET /rss/series/:slug` (per-series feed) |
| `src/firestore.js` | Firestore REST API helpers (list docs, query docs, unwrap values) |
| `src/zip.js` | Minimal ZIP file builder (store-only, no compression — images are already compressed) |
| `wrangler.jsonc` | Worker config: name, vars (PUBLIC_BASE_URL, STORAGE_PRIMARY, FIREBASE_PROJECT_ID), routes, asset binding |
| `package.json` | Wrangler dev dependency |

**Auth flow:** Admin endpoints extract JWT from `Authorization: Bearer <token>` header → decode payload → check `exp` + `aud` + `admin` claim → allow or reject.

**Storage chain:** Upload tries primary (Catbox) → if fails, tries backup (ImgBB) → if fails, tries R2 (if configured). Configurable via `STORAGE_PRIMARY` env var.

---

## workers/cache-api/ — Edge Cache Worker

| File | Purpose |
|---|---|
| `src/index.js` | Caches Firestore reads at Cloudflare's edge. Endpoints: `/api/series`, `/api/series/:slug`, `/api/chapters/:slug`, `/api/chapter/:slug/:num`. Reduces Firestore reads 8×. |
| `wrangler.jsonc` | Config: FIREBASE_PROJECT_ID, ALLOW_ORIGIN |

**How it works:** Browser → cache Worker → edge cache check → if miss, query Firestore REST API → cache response for 2-10 min → return. Next reader gets cached version instantly.

---

## scripts/ — Local Tools & Automation

| File | Purpose | Needs Token? |
|---|---|---|
| `mega-grab.mjs` | Bulk multi-series grabber. Reads `series.json`, scrapes + uploads images, saves to `mega-output/`. Concurrency, alternating hosts, WebP compression, timeouts. | No |
| `mega-publish.mjs` | Publishes all grabbed chapters from `mega-output/` to Firestore. Skips existing. Token refresh prompt. | Yes |
| `publish-gui.mjs` | Browser GUI (localhost:3457) for publishing mega-output. Visual progress. | Yes (in browser) |
| `grabber-gui.mjs` | Browser GUI (localhost:3456) for single chapters. Visual image picker, deselect junk, upload, get links. | No |
| `grab-chapter.mjs` | CLI: single or batch chapter grab. Saves links to .txt files. | No |
| `local-import.mjs` | CLI: scrape + upload + publish to Firestore. Token refresh, retry. | Yes |
| `bulk-import.mjs` | CLI: uses Worker API (faster, but timeout risk on large chapters). | Yes |
| `update-series.mjs` | Auto-detects latest chapter numbers on source sites, updates `series.json`. Skips completed series. | No |
| `grant-admin.mjs` | Sets Firebase custom claim `admin: true` on a user. Uses firebase-admin SDK. | Service account |
| `backup-firestore.mjs` | Exports all Firestore collections to JSON. | Service account |
| `migrate-schema.mjs` | Upgrades legacy Firestore docs to v3 schema (adds missing fields). | Service account |
| `scheduled-grab.bat` | Windows batch file for Task Scheduler. Runs update-series then mega-grab. | No |
| `series.json` | Config: list of series with slug, source URL pattern, start/end chapter, status. | — |
| `.env` | Local secrets: IMGBB_API_KEY. Not committed to git. | — |
| `.env.example` | Template showing expected env vars. | — |

**Workflow:** `update-series.mjs` → `mega-grab.mjs` → `publish-gui.mjs` (or `mega-publish.mjs`)

---

## docs/ — Documentation

| File | Content |
|---|---|
| `01-architecture.md` | System diagram, data flow, design decisions |
| `02-content-guide.md` | How to add series + chapters (daily workflow) |
| `03-admin-guide.md` | Admin panel walkthrough |
| `04-deploy.md` | Cloudflare Pages + Worker deployment |
| `05-troubleshooting.md` | Common issues & fixes |
| `06-roadmap.md` | Planned features |
| `07-data-schema.md` | Every Firestore field documented |
| `08-design-system.md` | Colors, fonts, spacing, components |
| `09-user-tasks.md` | Setup tasks (security rules, admin claim, R2, deploy) |
| `10-seo-guide.md` | SEO checklist for scanlation SPA |
| `11-monetization.md` | Ko-fi, ads, payment integration |
| `12-build-tutorial.md` | How to build from scratch |
| `13-domain-and-rename.md` | Domain swap / rebrand procedure |
| `14-rename-history.md` | VoidScans → JayaScans rename log |
| `15-admin-settings.md` | Admin settings reference |
| `16-automation-architecture.md` | Full automation pipeline design, storage comparison, hosting recs |
| `17-upload-workflows.md` | All upload methods with usage examples |
| `18-file-reference.md` | This file |

---

## Data Flow Summary

```
Reader opens page
    → app.js boots router
    → router matches URL to view
    → view calls api.js
    → api.js checks in-memory cache (TTL)
    → if miss: tries edge cache Worker (3s timeout)
    → if miss: queries Firestore directly
    → normalizes response (handles old + new schema)
    → view renders HTML into #app
    → service worker caches for offline

Admin publishes chapter
    → admin panel calls api.js createChapter()
    → writes to Firestore /chapters/{id}
    → updates series.latestChapter
    → fires Discord webhook (if configured)
    → cache Worker will serve fresh data within TTL expiry (2-5 min)
```

---

## Git Branches

| Branch | Status | Content |
|---|---|---|
| `main` | Active | Everything deployed |
| `feat/threaded-comments` | Dormant | Reply/thread functionality for comments. Merge when ready. |
