# Changelog

## v3.0.0 — Premium SPA rebuild (2026-05-30)

Full rewrite. The repo went from a 4-page hand-written site to a single-page application with proper architecture, full CRUD admin, PWA, and offline reading.

### Added
- Single-page app with path-based routing (`/series/:slug`, `/read/:slug/:chapter`, etc.)
- Premium home page: hero slider, latest updates, popular, new arrivals, genre filter
- Browse page with genre/type/status/sort filters + paginated grid
- Search page (debounced, ranked, URL-synced)
- Genre detail pages
- Premium series page: rating, 5 emoji reactions, share, bookmark, comments, related, alt titles, description toggle
- Premium reader: fit modes, zoom 75–150 %, scroll progress, keyboard nav, swipe gestures, settings drawer, scroll position memory, auto chapter precaching for offline
- Library: bookmarks (Reading/Completed/Planned/Dropped), reading history — all in IndexedDB
- Admin v2 SPA with full CRUD: dashboard stats, series form (cover preview, genre toggles), chapter form (drag-reorder pages, image previews), comments moderation, settings
- PWA: manifest, service worker (3 caches), offline fallback page
- Cloudflare Worker for Firestore edge caching (optional, deploy when needed)
- Maintenance scripts: `grant-admin`, `backup-firestore`, `migrate-schema`, `seed-sample`
- 9 doc files (architecture, content guide, admin guide, deploy, troubleshooting, roadmap, schema, design system, user tasks)

### Fixed (from v2 audit)
- `series.html` `style.backgroundImg` typo (was: backgroundImg, now: backgroundImage in proper SPA)
- "Browse" nav link going to `#`
- Reader Next button always visible (now hidden on last chapter)
- Hard-coded "Read official translation" instead of real chapter title
- `latestChapter` update overwriting `createdAt` (preserved now via `latestChapterAt` field)
- Reader not scrolling to top on chapter change
- `innerHTML +=` in loops (replaced with single render)
- `description` shown without paragraph breaks (now respects `\n`)
- Mobile menu HTML missing despite CSS existing (added)
- No 404 page (added)
- No browse / search / genre pages (added)
- No Update on series → only Create + Delete (Update added)
- No image preview in admin (added)
- No drag-reorder for chapter pages (added)
- Admin role security: any authenticated user could write (now requires `admin` custom claim — see Task 1+2)

### Security
- Admin gated by Firebase custom claim (`admin: true`), not just authentication
- Firestore Security Rules locked down to admin-only writes (must be applied — see [Task 1](./docs/09-user-tasks.md))
- `service-account.json` added to `.gitignore`

### Architecture
- Schema-tolerant data layer (works with old AND new field names while you migrate)
- TTL cache + inflight dedupe in `api.js` (5 min for series, 2 min for chapters)
- View Transitions API used for smooth route changes when supported
- All views use proper cleanup functions to prevent memory leaks

### Known limitations
- User accounts (sign-up flow + library sync) stubbed but not yet wired into UI — Phase 2
- Push notifications: not yet implemented — Phase 2
- Turnstile CAPTCHA: not yet wired — needs site key (Task 6)
- Auto-sitemap generator: not yet — manual XML for now
- PNG icons: PWA uses SVG icons (modern browsers OK, older Android may show fallback)

---

## v2.0.0 — Initial flat-file scaffold (Pre-rebuild)
- Hand-written `index.html`, `series.html`, `reader.html`, `admin.html`
- Firebase Firestore for data
- One CSS file (~1600 lines)
