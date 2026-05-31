# 14 — Rename History: VoidScans → JayaScans

**Date:** 2026-05-31
**Release:** v3.4.0
**Domain:** old `*.workers.dev` preview → new owned domain **[jayascans.online](https://jayascans.online)**

This doc captures every code/config change made during the rebrand, what was intentionally kept, and the remaining manual steps you (the human) need to take.

---

## Why a separate doc

`docs/13-domain-and-rename.md` is the **generic** playbook for future renames. This doc is the **specific** record of what happened in v3.4.0, so any future rename can copy this template.

---

## Files changed in code

### Centralized config (the "edit-once" surface)
| File | Change |
|---|---|
| `assets/js/lib/site.config.js` | `name: 'VoidScans'` → `'JayaScans'`; `shortName` same; `logoLead: 'VOID'` → `'JAYA'`; `logoAccent` kept as `'SCANS'`; `baseUrl: '…workers.dev'` → `'https://jayascans.online'`; comments refreshed. |
| `wrangler.jsonc` | Worker `name: 'voidscans'` → `'jayascans'`; `vars.PUBLIC_BASE_URL` → `'https://jayascans.online'`. `FIREBASE_PROJECT_ID` kept (see "Kept on purpose" below). |

### Static `<head>` metadata + manifest
| File | Change |
|---|---|
| `index.html` | `<title>`, `<meta description>`, all `og:*`, all `twitter:*`, navbar `aria-label`, navbar logo (`VOID<span>SCANS</span>` → `JAYA<span>SCANS</span>`). Added `<link rel="canonical">`, `og:url`, `og:site_name`, `og:locale`, `twitter:image`, and a `WebSite` + `Organization` JSON-LD graph (with `SearchAction` for Google sitelinks search box). |
| `admin/index.html` | `<title>`, `.admin-brand` (`VOID<span>ADMIN</span>` → `JAYA<span>ADMIN</span>`), the "Sign in to manage VoidScans" sub-text. |
| `manifest.webmanifest` | `name`, `short_name`. (`description` already generic.) |
| `offline.html` | `<title>` only. |
| `robots.txt` | `Sitemap:` URL switched to `https://jayascans.online/sitemap.xml`. |
| `sw.js` | `CACHE_VERSION 'v3.3.2'` → `'v3.4.0'` so existing browsers replace the cached "VoidScans" shell on next visit. Header comment updated. |

### Public views (all 9)
Every view that returned a `title` was switched to use `pageTitle()` from `site.config.js`. Where the SEO guide recommended a long-tail title formula, that formula was applied:

| View | Title pattern now |
|---|---|
| `home.js` | `JayaScans — Read Manhwa, Manga & Manhua Online Free` |
| `browse.js` | `Browse · JayaScans` (via `pageTitle`) |
| `search.js` | `Search · JayaScans` / `Search: {q} · JayaScans` |
| `genre.js` | `{Genre} - Read Free Manhwa & Manga \| JayaScans` |
| `series.js` | `{Title} - Read {Type} English Free \| JayaScans` |
| `reader.js` | `{Title} Chapter {N} English \| JayaScans` |
| `library.js` | `Library · JayaScans` |
| `profile.js` | `My Profile · JayaScans` / `Profile · JayaScans` |
| `notFound.js` | `Not Found · JayaScans` |

Hard-coded share text (`Read X on VoidScans`, `Reading X chapter N on VoidScans`) now reads `SITE.name` from config — future renames are config-only for these strings.

### SEO additions wired in v3.4.0
| File | Change |
|---|---|
| `assets/js/lib/utils.js` | New `setMeta({ title, description, image, url, type })` helper. Updates `<title>`, `<link rel="canonical">`, `<meta name="description">`, all `og:*`, all `twitter:*`. `og:type` always set (defaults to `'website'`) so it doesn't leak across SPA route changes. Plus a small `truncate(str, max)` helper for clean meta-description excerpts. |
| `assets/js/views/home.js` | Calls `setMeta({ type: 'website' })` with site tagline. |
| `assets/js/views/browse.js` | Calls `setMeta({ type: 'website' })` with browse-specific copy. |
| `assets/js/views/genre.js` | Calls `setMeta({ type: 'website' })` per genre, includes count in description. |
| `assets/js/views/series.js` | Calls `setMeta({ type: 'book' })` with cover image + truncated description. |
| `assets/js/views/reader.js` | Calls `setMeta({ type: 'article' })` with first page image + chapter description. |
| `docs/10-seo-guide.md` | Rewrote checklist — items 1–3 now ✅, remaining items are off-platform actions for the human. |

### Workers
| File | Change |
|---|---|
| `workers/main/src/index.js` | Header comment renamed. |
| `workers/main/src/rss.js` | Feed channel `<title>` and `<description>` strings. |
| `workers/main/src/scrape.js` | All three `User-Agent` strings (`VoidScans-Scraper/1.0`, `VoidScans/1.0`). |
| `workers/main/README.md` | Brand strings + R2 bucket suggestion `voidscans-images` → `jayascans-images`. |
| `workers/cache-api/README.md` | Brand strings + Worker name suggestion `voidscans-cache` → `jayascans-cache` + custom-domain example. |

### Scripts + docs
| File | Change |
|---|---|
| `scripts/package.json` | `name: 'voidscans-scripts'` → `'jayascans-scripts'`; `description` updated. |
| `scripts/README.md` | Title + footnote about why the Firebase project ID is kept. |
| `README.md` | Full rebrand. New "Brand & domain" section explaining the centralized config split. New `docs/14` link. SEO bullet added to the feature list. |
| `CHANGELOG.md` | New `v3.4.0` entry summarizing this rename. |
| `DMCA.md` | Brand + domain references (example URL + DMCA email host). |
| `docs/04-deploy.md` | URLs, repo name, worker name, Custom Domain section rewritten for the owned domain. |
| `docs/09-user-tasks.md` | Task 4 deploy URL note, Task 5 rewritten for the owned domain (no more "free domain" branch), R2 bucket suggestion, scripts path cleanup. |
| `docs/13-domain-and-rename.md` | Rewrote as a generic playbook + cross-link to this history doc. |

---

## Kept on purpose (and why)

These names still contain `voidscans`. They are **infrastructure resource IDs** — renaming them in code without first renaming the resource itself would break production.

| What | Where | Why kept |
|---|---|---|
| **Firebase project ID** `voidscans-6c66b` | `assets/js/lib/firebase.js`, `wrangler.jsonc` (`FIREBASE_PROJECT_ID`), `assets/js/admin/settings.js` quick-links, `docs/05-troubleshooting.md`, `docs/09-user-tasks.md` | Firebase project IDs are **immutable**. The only way to "rename" is to create a new project, export Firestore + Auth users, import them into the new project, regenerate the web SDK config, redeploy. That's a real migration with downtime risk — your call when (or if) to do it. |
| **Firebase API key + appId + messagingSenderId** | `assets/js/lib/firebase.js` | Bound to the immutable project ID. Same reason as above. |
| **IndexedDB name** `voidscans` | `assets/js/lib/library.js` (`DB_NAME`) | Renaming this would orphan **every existing user's bookmarks, reading history, and progress** on their device. The DB is invisible to them, so the brand mismatch has zero visible impact. If you ever want to rename it, do it in a release that includes a migration step. |
| **GitHub repo path** `Proprince11/voidscans` | `docs/04-deploy.md`, `docs/09-user-tasks.md` | Just text references. The repo can be renamed on GitHub — see "Manual follow-ups" below. |
| **Cloudflare R2 bucket name** `voidscans` | `docs/09-user-tasks.md` (Task 3 setup) | If you've already created the bucket, leave it. If you haven't, the doc now suggests `jayascans-images` (in `workers/main/README.md`). Bucket names are also semi-immutable — renaming requires copy-then-delete. |
| Historical CHANGELOG entries | `CHANGELOG.md` v3.0.0 / v3.1.0 sections | Pre-rename history; left to preserve the timeline. The new v3.4.0 entry tells the rename story. |

---

## Manual follow-ups (you, the human)

### Required

1. **Cloudflare Pages → custom domain.** Add `jayascans.online` to your Pages project (Workers & Pages → your project → Custom Domains → Set up a custom domain). Cloudflare auto-provisions SSL in ~1–15 min. Optionally add `www.jayascans.online` too.

2. **Update `assets/js/lib/firebase.js`** if you migrate to a new Firebase project. Otherwise leave it — the existing `voidscans-6c66b` project keeps serving JayaScans data.

### Strongly recommended

3. **Rename the GitHub repo.** GitHub → Settings → Repository name → `voidscans` → `jayascans`. GitHub auto-redirects the old URL. Then update `Proprince11/voidscans` references in `docs/04-deploy.md` and `docs/09-user-tasks.md`.

4. **Submit to Search Console + Bing.** New domain = new property:
   - https://search.google.com/search-console → Add property → `jayascans.online` → submit `https://jayascans.online/sitemap.xml`.
   - https://www.bing.com/webmasters → same.

5. **Create a real OG share image.** `/assets/images/og-default.png` is currently a placeholder reference — make a 1200×630 PNG with the JayaScans wordmark + tagline, save to that path. Twitter/Discord/Slack previews will pick it up automatically (already wired in `index.html` and via `setMeta` per route).

### Optional (when you have time)

6. **Migrate the Firebase project** to a `jayascans` ID if the brand mismatch in admin URLs bothers you. Steps:
   - New project at console.firebase.google.com.
   - `npm run backup` from `scripts/` to export Firestore.
   - `firebase auth:export users.json` to export auth users.
   - Import both into the new project (`firebase auth:import`, custom Firestore restore script).
   - Regenerate the web SDK config in the new project's Settings.
   - Update `assets/js/lib/firebase.js` and `wrangler.jsonc` `FIREBASE_PROJECT_ID`.
   - Update Firestore Security Rules (copy from old project).
   - Redeploy.
   - Optionally: delete the old project after a week of monitoring.

7. **Rename the IndexedDB.** Add a one-time migration in `assets/js/lib/library.js` that opens the old `voidscans` DB, copies all stores into a new `jayascans` DB, then deletes the old DB. Ship in a single release. Until then, the mismatch is invisible to users.

8. **Rename the R2 bucket.** Cloudflare → R2 → create `jayascans-images` → use `rclone` or the dashboard to copy contents → delete the old bucket → update `wrangler.jsonc` if you've bound it. Existing image URLs will break unless you keep the old bucket alive as a redirect — usually not worth the hassle.

---

## Verification checklist

After deploy, smoke-test:

```
✓ https://jayascans.online                  loads, title says "JayaScans — Read Manhwa…"
✓ https://jayascans.online/browse           title "Browse · JayaScans"
✓ https://jayascans.online/series/<slug>    title formula `{Title} - Read … | JayaScans`,
                                            <meta description> populated, OG tags set
✓ https://jayascans.online/read/<slug>/1    title `{Title} Chapter 1 English | JayaScans`,
                                            JSON-LD type=Chapter present
✓ https://jayascans.online/sitemap.xml      returns XML with jayascans.online URLs
✓ https://jayascans.online/rss              channel title "JayaScans — Latest Chapters"
✓ https://jayascans.online/robots.txt       Sitemap line points at jayascans.online
✓ https://jayascans.online/manifest.webmanifest   "name": "JayaScans"
✓ /admin                                    title "Admin · JayaScans", brand JAYA·ADMIN
✓ Service worker                            CACHE_VERSION v3.4.0 active in DevTools
✓ View source on /                          WebSite + Organization JSON-LD present
✓ Lighthouse → SEO score                    100 (or 90+ if no real og-default.png yet)
```

If any of the above are wrong, the rebrand isn't fully cut over. Open an issue with the broken URL and Kiro will fix it.
