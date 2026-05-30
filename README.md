# VoidScans

A premium manhwa, manga & manhua reading platform. Free forever, zero-budget hosting, runs on Cloudflare Pages + Firebase.

```
Stack:    Vanilla JS SPA  ·  Cloudflare Pages  ·  Firebase Firestore  ·  Cloudflare R2
Cost:     $0/month (free tier) → $0–$10/year (custom domain)
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

## Quick start

### See the site live
1. Push to GitHub
2. Cloudflare Pages → Connect repo → Deploy
3. Done. URL: `https://voidscans.isthe.workers.dev`

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
| **[docs/09-user-tasks.md](./docs/09-user-tasks.md)** | **Read first.** Step-by-step setup tasks (security rules, admin claim, R2, deploy, domain). |
| [docs/01-architecture.md](./docs/01-architecture.md) | System diagram, data flow, design decisions. |
| [docs/02-content-guide.md](./docs/02-content-guide.md) | How to add a new series and new chapter (your daily workflow). |
| [docs/03-admin-guide.md](./docs/03-admin-guide.md) | Admin panel walkthrough. |
| [docs/04-deploy.md](./docs/04-deploy.md) | Cloudflare Pages + Worker + custom domain setup. |
| [docs/05-troubleshooting.md](./docs/05-troubleshooting.md) | Common issues & fixes. |
| [docs/06-roadmap.md](./docs/06-roadmap.md) | What's planned, what's done. |
| [docs/07-data-schema.md](./docs/07-data-schema.md) | Every Firestore field documented. |
| [docs/08-design-system.md](./docs/08-design-system.md) | Colors, fonts, spacing, components. |
| [scripts/README.md](./scripts/README.md) | Script reference (grant-admin, backup, migrate, seed). |
| [workers/cache-api/README.md](./workers/cache-api/README.md) | Cache Worker deploy & wire-up. |
| [DMCA.md](./DMCA.md) | Takedown policy. |
| [CHANGELOG.md](./CHANGELOG.md) | Version history. |

## Repo structure (high level)

```
voidscans/
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
│   │   ├── lib/             ← firebase, api, auth, router, ui, library, utils
│   │   ├── views/           ← One file per route (home, browse, series, reader, library, …)
│   │   └── admin/           ← Admin tabs (dashboard, series, chapters, comments, settings)
│   └── images/              ← Logo, icons, favicon
│
├── workers/
│   └── cache-api/           ← Optional Cloudflare Worker for Firestore caching
│
├── scripts/                 ← Node maintenance scripts (admin claim, backup, migrate, seed)
│
└── docs/                    ← All documentation
```

## License

Source code: see [LICENSE](./LICENSE).
Hosted manga images: see [DMCA.md](./DMCA.md).

---

Built with care. PR welcome.
