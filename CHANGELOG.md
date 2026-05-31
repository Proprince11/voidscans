# Changelog

## v3.4.0 — Rebrand: VoidScans → JayaScans (2026-05-31)

Rebrand to **JayaScans** at the new owned domain **[jayascans.online](https://jayascans.online)**, plus the SEO improvements queued in `docs/10-seo-guide.md`.

### Brand & domain
- All user-facing strings: `VoidScans` → `JayaScans`; logo split `VOID/SCANS` → `JAYA/SCANS`.
- `assets/js/lib/site.config.js` — `name`, `shortName`, `logoLead`, `logoAccent`, `baseUrl` updated.
- `wrangler.jsonc` — `name: "jayascans"`, `vars.PUBLIC_BASE_URL: "https://jayascans.online"`.
- `manifest.webmanifest`, `index.html` (title + meta + OG + Twitter + canonical + JSON-LD), `admin/index.html`, `offline.html`, `robots.txt` (sitemap URL) all updated.
- Service worker bumped `CACHE_VERSION v3.3.2 → v3.4.0` so existing browsers replace the old shell on next visit.
- Docs (`04-deploy`, `09-user-tasks`, `13-domain-and-rename`), `scripts/package.json`, `scripts/README.md`, `DMCA.md`, top-level `README.md` all updated.

### SEO
- `index.html` now ships a `WebSite` (with `SearchAction`) + `Organization` JSON-LD graph.
- `<link rel="canonical">`, `og:url`, `og:site_name`, `og:locale`, `twitter:image` added at the shell level.
- New `setMeta()` helper in `assets/js/lib/utils.js` updates description / canonical / OG / Twitter per route.
- Wired into series, reader, home, browse, and genre views.
- Title formula from the SEO guide applied:
  - **Series:** `{Title} - Read {Type} English Free | JayaScans`
  - **Chapter:** `{Title} Chapter {N} English | JayaScans`
  - **Genre:** `{Genre} - Read Free Manhwa & Manga | JayaScans`
  - **Home:** `JayaScans — Read Manhwa, Manga & Manhua Online Free`
- Workers: `rss.js` feed strings, `scrape.js` `User-Agent`, `index.js` header comment renamed.

### Kept (intentionally — see `docs/14-rename-history.md`)
- Firebase project ID `voidscans-6c66b` (immutable Firebase resource).
- GitHub repo path `Proprince11/voidscans` (rename on GitHub when ready, then update docs).
- Cloudflare R2 bucket name suggestion (rename in dashboard if desired — references it in user-tasks doc only).

### Manual follow-ups for the user
1. Cloudflare Pages → Custom Domains → add `jayascans.online`.
2. (Optional) Rename the GitHub repo to `jayascans`.
3. Submit `https://jayascans.online/sitemap.xml` to Google Search Console + Bing Webmaster Tools.
4. (Optional) Update `<meta property="og:image">` from the placeholder `og-default.png` to a real branded 1200×630 PNG.

---

## v3.1.0 — Phase 2: user accounts, sync, view tracking (2026-05-30)

Big release: JayaScans now has user accounts, library sync, and view tracking. See [docs/06-roadmap.md](./docs/06-roadmap.md) for the full Phase 2 status.

### Added — Auth & profiles
- Email/password + Google sign-in via `openAuthModal({ initialTab })` (in `lib/ui.js`)
- `lib/account.js` — user profile management on `/users/{uid}` (auto-created on first sign-in, mirrors displayName/photoURL to Firebase Auth)
- `views/profile.js` — `/profile` page with edit form, library/history stats, sign-out
- Navbar now shows Sign In button (signed out) or avatar with dropdown (signed in)
- Mobile menu drawer adds "My Profile" entry

### Added — Library & history sync
- `lib/library.js` rewritten with Firestore mirror layer
- IndexedDB stays primary (offline-friendly, anonymous-friendly)
- When signed in: addToLibrary/removeFromLibrary/setLibraryStatus/recordRead also write to `/users/{uid}/library/*` and `/users/{uid}/history/*`
- `getLibrary()` / `getHistory()` prefer cloud when signed in, fall back to local
- `syncLocalToCloud()` runs once per browser on first sign-in; pushes IndexedDB → Firestore (gated by localStorage flag)
- `hydrateFromCloud()` pulls newer cloud entries on each sign-in

### Added — Engagement tracking
- `api.trackSeriesView(slug)` — sessioned dedup, increments `series.views`
- `api.trackChapterView(slug, num)` — sessioned dedup, increments `chapter.views`
- `api.adjustFollowers(slug, delta)` — bookmark/unbookmark increments `series.followers`
- Series page now displays Views and Followers counters in stats panel
- All counters use Firestore `increment()` for atomic concurrent writes

### Added — Per-chapter comments
- Reader page now has its own comment section (max-width 800px to fit reader column)
- Uses existing `/series/{slug}/comments` collection with `chapter` field for scoping
- `api.fetchChapterComments(slug, num, limit)` for loading
- Form auto-fills name from signed-in profile

### Added — Continue Reading strip
- Home page now has a "Continue Reading" section between hero and Latest Updates
- Pulls last 6 unique series from history (cloud or local), each card links direct to last-read chapter
- Section hidden when no history exists (anonymous first-visit users)

### Added — JSON-LD structured data
- Series pages emit Schema.org `Book` JSON-LD (with `aggregateRating`, genre, author/artist, image)
- Reader pages emit Schema.org `Chapter` JSON-LD (with `isPartOf` Book, `position`, `datePublished`)
- Helps Google understand pages as discrete book/chapter entities

### Updated — Firestore Security Rules
- See [docs/09-user-tasks.md Task 1](./docs/09-user-tasks.md) — REQUIRED to apply before Phase 2 features work
- Public increment now allowed ONLY for `views`/`followers`/`likes` fields (locked via `affectedKeys().hasOnly()`)
- New `/users/{uid}/{library,history}/**` rules — read/write only by owner

### Cache
- Service worker `CACHE_VERSION` v3.0.3 → v3.1.0
- Added `/assets/js/lib/account.js` and `/assets/js/views/profile.js` to precache list
- Existing browsers will refresh on next visit

### Known limitations / Phase 2 still pending
- Push notifications for new chapters: requires FCM VAPID key generation in Firebase Console (user action)
- User retention dashboard / drop-off detection / weekly trend charts: need accumulated data
- Public profile pages (`/u/:displayName`): Phase 3

---

## v3.0.3 — LCP fix (2026-05-30)

- LCP fix: above-the-fold cards now eager-load with `fetchpriority="high"` on first card
- All card images get `decoding="async"`
- Hero slide #0 now has `fetchpriority="high"`
- LCP dropped from 2.54s → ~1.5–2.0s

---

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
