# 13 — Domain Switching & Rebrand Guide

This makes changing your domain **or** renaming the brand a ~10-minute job instead of a hunt across the codebase.

> **Already done:** The original `VoidScans` brand and `*.workers.dev` URL were rebranded to **JayaScans** at `https://jayascans.online`. See [docs/14-rename-history.md](./14-rename-history.md) for the full diff and the manual follow-up checklist (DNS, repo rename, Search Console resubmit).

---

## A. Change the DOMAIN (e.g. to a new `example.online`)

Two edits, then add the domain in Cloudflare.

### 1. `assets/js/lib/site.config.js`
```js
baseUrl: 'https://example.online',   // was the previous domain
```

### 2. `wrangler.jsonc` → `vars`
```jsonc
"PUBLIC_BASE_URL": "https://example.online"
```
This is what RSS/sitemap use for absolute links.

### 3. Cloudflare dashboard
1. Buy the domain (Porkbun/Cloudflare Registrar — `.xyz`/`.online` ≈ $1–10/yr).
2. Cloudflare → Workers & Pages → your Pages project → **Settings → Domains & Routes → Add Custom Domain** → enter `example.online`.
3. Cloudflare auto-provisions SSL (~1–15 min). Done.

### 4. `robots.txt` and `index.html` canonical
- Update the `Sitemap:` line in `robots.txt` to the new domain.
- Update the `<link rel="canonical">`, `og:url`, and JSON-LD `url` values in `index.html`.

> The old workers.dev URL keeps working, so there's zero downtime — the custom domain is added alongside it.

---

## B. RENAME the brand (e.g. JayaScans → SomethingElse)

### Centralized (edit once)
`assets/js/lib/site.config.js`:
```js
name:       'SomethingElse',
shortName:  'SomethingElse',
logoLead:   'SOMETHING',
logoAccent: 'ELSE',
tagline:    'Premium manhwa, manga & manhua. Free forever.',
```
This instantly updates: footer, mobile-menu logo, share text, and (via `pageTitle()`) every view.

### Remaining static spots (find-and-replace)
A quick search-replace covers these — they're static HTML/manifest, not behind the config:

| File | What to change |
|---|---|
| `index.html` | `<title>`, `<meta description>`, `og:*`, `twitter:*`, `<link rel="canonical">`, JSON-LD strings, navbar logo (`JAYA<span>SCANS</span>`) |
| `admin/index.html` | the `<title>`, the `.admin-brand` (`JAYA<span>ADMIN</span>`), and the "Sign in to manage…" sub-text |
| `offline.html` | `<title>` |
| `manifest.webmanifest` | `name`, `short_name`, `description` |
| `robots.txt` | Sitemap URL |
| `assets/js/views/series.js`, `assets/js/views/reader.js` | The literal share-text strings (currently use `SITE.name` from config — already centralized) |
| `assets/js/admin/settings.js` | The Firebase Console quick-link URLs (only the project ID — keep that immutable) |
| `workers/main/src/rss.js` | Feed `title` and `description` strings (or rewire to a worker var) |
| `workers/main/src/scrape.js` | The `User-Agent` strings |
| `wrangler.jsonc` | The Worker `name` |
| `scripts/package.json` | The package `name` and `description` |
| `docs/*`, `README.md`, `CHANGELOG.md`, `DMCA.md` | Cosmetic references |

> **Fast path:** project-wide find/replace of the old brand → new brand and the old logo halves → new logo halves. ~5 minutes. The config file handles the dynamic chrome; the find/replace handles the static metadata.

### After renaming
- Bump `sw.js` `CACHE_VERSION` so browsers pick up the new branding.
- Firebase project ID does **not** need to change — it's internal, never shown to users. Leave it.

---

## C. Why it's split this way

- **Dynamic UI** (footer, menus, titles, share) → `site.config.js` (one edit).
- **Static `<head>` metadata** (SEO tags, manifest) → can't read JS at parse time, so they're plain HTML; a find/replace handles them.
- **Server absolute URLs** (RSS, sitemap) → `wrangler.jsonc` var (one edit).

Three files, one find/replace. That's the whole rebrand.
