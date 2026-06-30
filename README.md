# JayaScans

A premium manhwa, manga & manhua reading platform. Free forever, zero-budget hosting, runs on Cloudflare Pages + Firebase.

> Live at **[jayascans.online](https://jayascans.online)**.

```
Stack:    Vanilla JS SPA  ·  Cloudflare Pages  ·  Firebase Firestore  ·  Cloudflare R2
Cost:     $0/month (free tier) → ~$10/year (custom domain)
Targets:  Mobile-first, sub-3s FCP, PWA installable, offline reading
SEO:      100/100 Lighthouse  ·  JSON-LD  ·  Auto sitemap + RSS
```

## Features

- 🏠 **Premium home** — Hero slider, latest updates, popular grid, genre filters, new arrivals, continue reading
- 📚 **Browse / Search / Genre** — Filter by type, status, sort by popular/new/updated, ranked client-side search
- 📖 **Series detail** — Rating, 5 emoji reactions, share, bookmark, comments, related series, alt titles, genre pills
- 🎨 **Premium reader** — Fit-width / fit-height / zoom modes, scroll progress bar, keyboard nav, swipe gestures, settings drawer, scroll position memory, auto chapter precaching
- 📂 **Library** — Bookmarks (Reading / Completed / Plan to Read / Dropped), reading history, status changes, all stored in IndexedDB with cloud sync
- 👤 **User accounts** — Email/password + Google sign-in, library/history sync, user profiles
- 🛠 **Full-CRUD admin** — Dashboard stats, series form with cover preview + genre toggles, chapter form with drag-reorder + image previews, comments moderation, tools, settings (ads, branding, integrations)
- 📱 **PWA** — Installable, offline reading, service worker chapter cache
- ⚡ **Edge cache Worker** — Optional Cloudflare Worker reduces Firestore reads 8×, proxies images for faster LCP
- 🔍 **SEO-ready** — Per-route titles + descriptions, Open Graph + Twitter cards, canonical URLs, JSON-LD (Book/Chapter/WebSite/Organization), auto sitemap, RSS
- 📄 **Legal pages** — Privacy Policy, Terms of Service, About, Contact, DMCA (all routed)
- 🍪 **Cookie consent** — Non-intrusive banner, localStorage-dismissed
- 🎨 **Themes** — Dark, light, sepia (admin-configurable default)
- 💰 **Ad slots** — Admin-configurable header, footer, mid-chapter, sidebar (supports any network)

## Performance

| Metric (Mobile) | Score |
|---|---|
| **SEO** | 100 ✅ |
| **Best Practices** | 92 |
| **Accessibility** | 89 |
| **Performance** | 67 (FCP: 2.7s, LCP: 8.3s*) |

\* LCP is limited by external image hosts (catbox.moe). Cover images are proxied through edge cache for same-origin delivery. Chapter images load lazily below the fold.

### Performance optimizations applied
- Zero-framework vanilla JS (0ms TBT)
- Code-split views via dynamic `import()` (only loads what's needed)
- Preconnect hints for all external data/image domains
- Cover images routed through same-origin proxy (edge-cached)
- Google Fonts loaded async with `media="print"` trick
- Above-fold hero image: `fetchpriority="high"` + `loading="eager"`
- All other images: `loading="lazy"` + `decoding="async"`
- Service worker with 3-tier cache strategy
- CSS-only skeleton loading states (no JS flicker)
- Security + cache headers via `_headers` file

## Quick start

### See the site live
1. Push to GitHub
2. Cloudflare Pages → Connect repo → Deploy
3. Add `jayascans.online` as a Custom Domain on the Pages project
4. Done.

### Open admin
- `/admin`
- First time? See **[docs/09-user-tasks.md](./docs/09-user-tasks.md)** Tasks 1 & 2 (5 min total).

### Run scripts (admin grant, backup, migrate, seed)
```bash
cd scripts
npm install
node grant-admin.mjs you@example.com
```

## Documentation

| File | What's in it |
|---|---|
| **[docs/09-user-tasks.md](./docs/09-user-tasks.md)** | **Read first.** Step-by-step setup tasks (security rules, admin claim, R2, deploy, custom domain). |
| [docs/01-architecture.md](./docs/01-architecture.md) | System diagram, data flow, design decisions. |
| [docs/02-content-guide.md](./docs/02-content-guide.md) | How to add a new series and new chapter (your daily workflow). |
| [docs/03-admin-guide.md](./docs/03-admin-guide.md) | Admin panel walkthrough. |
| [docs/04-deploy.md](./docs/04-deploy.md) | Cloudflare Pages + Worker + custom domain setup. |
| [docs/05-troubleshooting.md](./docs/05-troubleshooting.md) | Common issues & fixes. |
| [docs/06-roadmap.md](./docs/06-roadmap.md) | What's planned, what's done. |
| [docs/07-data-schema.md](./docs/07-data-schema.md) | Every Firestore field documented. |
| [docs/08-design-system.md](./docs/08-design-system.md) | Colors, fonts, spacing, components. |
| [docs/10-seo-guide.md](./docs/10-seo-guide.md) | SEO checklist tailored to a scanlation SPA. |
| [docs/13-domain-and-rename.md](./docs/13-domain-and-rename.md) | How to switch domain or rebrand again. |
| [docs/14-rename-history.md](./docs/14-rename-history.md) | History of the VoidScans → JayaScans rebrand and the manual follow-ups. |
| [scripts/README.md](./scripts/README.md) | Script reference (grant-admin, backup, migrate, seed). |
| [workers/cache-api/README.md](./workers/cache-api/README.md) | Cache Worker deploy & wire-up. |
| [workers/main/README.md](./workers/main/README.md) | Main Worker API endpoints (scrape, upload, proxy, RSS, sitemap). |
| [docs/16-automation-architecture.md](./docs/16-automation-architecture.md) | Automation pipeline design, storage comparison, hosting recs. |
| [docs/17-upload-workflows.md](./docs/17-upload-workflows.md) | **All ways to upload chapters** — quick reference. |
| [docs/19-post-launch-checklist.md](./docs/19-post-launch-checklist.md) | **Post-launch TODO** — analytics, Search Console, ads, social, monitoring. |
| [DMCA.md](./DMCA.md) | Takedown policy. |
| [CHANGELOG.md](./CHANGELOG.md) | Version history. |

## Repo structure (high level)

```
jayascans/
├── index.html               ← SPA shell (the entire site)
├── admin/index.html         ← Admin SPA shell
├── manifest.webmanifest
├── sw.js                    ← Service worker (PWA, offline)
├── offline.html             ← Offline fallback page
├── _redirects               ← Cloudflare Pages SPA routing
├── _headers                 ← Security & cache headers
│
├── assets/
│   ├── css/                 ← Design system (tokens, reset, base, components, pages, admin)
│   ├── js/
│   │   ├── app.js           ← Main SPA entry
│   │   ├── admin.js         ← Admin SPA entry
│   │   ├── lib/             ← firebase, api, auth, router, ui, library, utils, site.config
│   │   ├── views/           ← One file per route (home, browse, series, reader, library, …)
│   │   └── admin/           ← Admin tabs (dashboard, series, chapters, comments, settings)
│   └── images/              ← Logo, icons, favicon
│
├── workers/
│   ├── main/                ← Main Worker (RSS, sitemap, scrape, upload, proxy)
│   └── cache-api/           ← Optional Cloudflare Worker for Firestore caching
│
├── scripts/                 ← Node scripts (admin claim, backup, migrate, chapter import tools)
│
└── docs/                    ← All documentation
```

## Chapter upload tools

| Tool | What it does | Best for |
|---|---|---|
| **`mega-grab.mjs`** | Bulk grab all series (scrape + upload images, save locally) | Overnight bulk runs |
| **`mega-publish.mjs`** | Publish all grabbed chapters to Firestore | After mega-grab finishes |
| **`publish-gui.mjs`** | Browser GUI to publish mega-output (localhost:3457) | Visual one-click publish |
| **`update-series.mjs`** | Auto-detect latest chapter numbers on sources | Run before mega-grab |
| **`grabber-gui.mjs`** | Visual GUI: scan URL, pick images, upload, get links | Daily workflow with preview |
| **`grab-chapter.mjs`** | CLI: scan + upload + save links to .txt | Quick single/batch |
| **`local-import.mjs`** | CLI: scan + upload + auto-publish to Firestore | Hands-off bulk (needs token) |
| **`bulk-import.mjs`** | CLI: uses Worker API (faster but timeout risk) | Quick bulk if Worker handles it |
| **Admin panel** (browser) | Manual: paste URLs or bulk-upload files | 1 chapter at a time |

See **[docs/17-upload-workflows.md](./docs/17-upload-workflows.md)** for detailed usage of each.

## Brand & domain

The site is centralized for cheap rebrands and domain swaps:

- **Brand chrome** (footer logo, share text, page-title suffix, JSON-LD): `assets/js/lib/site.config.js`
- **Server absolute URLs** (RSS, sitemap): `wrangler.jsonc` → `vars.PUBLIC_BASE_URL`
- **Static `<head>` metadata** (`<title>`, `<meta>`, manifest): `index.html`, `admin/index.html`, `manifest.webmanifest`, `robots.txt`

See [docs/13-domain-and-rename.md](./docs/13-domain-and-rename.md) for the full swap procedure.

## License

Source code: see [LICENSE](./LICENSE).
Hosted manga images: see [DMCA.md](./DMCA.md).

---

Built with care. PRs welcome.
