# JayaScans

A premium manhwa, manga & manhua reading platform. Free forever, zero-budget hosting, runs on Cloudflare Pages + Firebase.

> Live at **[jayascans.online](https://jayascans.online)**.

```
Stack:    Vanilla JS SPA  ·  Cloudflare Pages  ·  Firebase Firestore  ·  Cloudflare R2
Cost:     $0/month (free tier) → ~$10/year (custom domain)
Targets:  Mobile-first, sub-1s LCP, PWA installable, offline reading
```

## Features

- 🏠 **Premium home** — Hero slider, latest updates, popular grid, genre filters, new arrivals
- 📚 **Browse / Search / Genre** — Filter by type, status, sort by popular/new/updated, ranked client-side search
- 📖 **Series detail** — Rating, 5 emoji reactions, share, bookmark, comments, related series, alt titles, genre pills
- 🎨 **Premium reader** — Fit-width / fit-height / zoom modes, scroll progress bar, keyboard nav, swipe gestures, settings drawer, scroll position memory, auto chapter precaching
- 📂 **Library** — Bookmarks (Reading / Completed / Plan to Read / Dropped), reading history, status changes, all stored in IndexedDB
- 🛠 **Full-CRUD admin** — Dashboard stats, series form with cover preview + genre toggles, chapter form with drag-reorder + image previews, comments moderation, settings
- 📱 **PWA** — Installable, offline reading, service worker chapter cache
- ⚡ **Edge cache Worker** — Optional Cloudflare Worker reduces Firestore reads 8×
- 🔍 **SEO-ready** — Per-route titles + descriptions, Open Graph + Twitter cards, canonical URLs, JSON-LD (Book/Chapter/WebSite/Organization), auto sitemap, RSS

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
| **Admin panel** (browser) | Manual: paste URLs or bulk-upload files | 1 chapter at a time |
| **`grabber-gui.mjs`** | Visual GUI: scan URL, pick images, upload, get links | Daily workflow with preview |
| **`grab-chapter.mjs`** | CLI: scan + upload + save links to .txt | Quick single/batch without GUI |
| **`local-import.mjs`** | CLI: scan + upload + auto-publish to Firestore | Hands-off bulk (needs token) |
| **`bulk-import.mjs`** | CLI: uses Worker API (faster but timeout risk) | Quick bulk if Worker handles it |

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
