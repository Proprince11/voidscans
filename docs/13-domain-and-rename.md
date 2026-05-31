# 13 — Domain Switching & Rebrand Guide

This makes changing your domain **or** renaming the brand (e.g. VoidScans → RatnaScans) a ~10-minute job instead of a hunt across the codebase.

---

## A. Change the DOMAIN (e.g. to a purchased `ratnascans.xyz`)

Two edits, then add the domain in Cloudflare.

### 1. `assets/js/lib/site.config.js`
```js
baseUrl: 'https://ratnascans.xyz',   // was the workers.dev URL
```

### 2. `wrangler.jsonc` → `vars`
```jsonc
"PUBLIC_BASE_URL": "https://ratnascans.xyz"
```
This is what RSS/sitemap use for absolute links.

### 3. Cloudflare dashboard
1. Buy the domain (Porkbun/Cloudflare Registrar — `.xyz` ≈ $1–10/yr).
2. Cloudflare → Workers & Pages → `voidscans` → **Settings → Domains & Routes → Add Custom Domain** → enter `ratnascans.xyz`.
3. Cloudflare auto-provisions SSL (~1–15 min). Done.

### 4. `robots.txt` (optional but good for SEO)
Update the `Sitemap:` line to the new domain.

> The old `*.workers.dev` URL keeps working, so there's zero downtime — the custom domain is added alongside it.

---

## B. RENAME the brand (VoidScans → RatnaScans)

### Centralized (edit once)
`assets/js/lib/site.config.js`:
```js
name:       'RatnaScans',
shortName:  'RatnaScans',
logoLead:   'RATNA',
logoAccent: 'SCANS',
tagline:    'Premium manhwa, manga & manhua. Free forever.',
```
This instantly updates: footer, mobile-menu logo, share text, and (via `pageTitle()`) any view that uses it.

### Remaining static spots (find-and-replace `VoidScans` / `VOID`+`SCANS`)
A quick search-replace covers these — they're static HTML/manifest, not behind the config:

| File | What to change |
|---|---|
| `index.html` | `<title>`, `og:title`, `og:description`, `twitter:*`, and the navbar logo (`VOID<span>SCANS</span>`) |
| `admin/index.html` | the `<title>` and `.admin-brand` (`VOID<span>ADMIN</span>`) |
| `manifest.webmanifest` | `name`, `short_name`, `description` |
| `assets/js/views/*.js` | the `· VoidScans` title suffixes (or switch them to `pageTitle()` from `site.config.js`) |
| `docs/*`, `README.md` | references (cosmetic) |

> **Fast path:** run a project-wide find/replace of `VoidScans` → `RatnaScans` and `VOID` `SCANS` logo halves. ~5 minutes. The config file handles the dynamic chrome; the find/replace handles the static metadata.

### After renaming
- Bump `sw.js` `CACHE_VERSION` (e.g. `v3.3.2` → `v3.4.0`) so browsers pick up the new branding.
- Firebase project ID (`voidscans-6c66b`) does **not** need to change — it's internal, never shown to users. Leave it.

---

## C. Why it's split this way

- **Dynamic UI** (footer, menus, titles, share) → `site.config.js` (one edit).
- **Static `<head>` metadata** (SEO tags, manifest) → can't read JS at parse time, so they're plain HTML; a find/replace handles them.
- **Server absolute URLs** (RSS, sitemap) → `wrangler.jsonc` var (one edit).

Three files, one find/replace. That's the whole rebrand.
