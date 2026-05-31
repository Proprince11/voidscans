# 10 — SEO Guide (tailored to this app)

A practical, step-by-step SEO plan for a scanlation SPA on Cloudflare Workers. Ordered by impact-per-effort. Do the 🔴 ones first.

> **Status (2026-05-31):** The 🔴 in-code items below were implemented as part of the JayaScans rebrand (see [docs/14-rename-history.md](./14-rename-history.md) and [CHANGELOG.md](../CHANGELOG.md) v3.4.0). What's left for **you** to do is the off-platform actions: Search Console submission, custom domain DNS, branded `og-default.png`, and community-building.

> Reality check: scanlation sites rank mostly on **long-tail title queries** ("[series] chapter [n] english") and **brand queries** once you have a following. You won't out-rank MangaDex on generic terms — you win by being the fast, clean result for specific series people already searched a name for.

---

## 0. The one structural caveat (read first)

This is a **client-rendered SPA** — the HTML shell is near-empty and JS fills it in. Googlebot *does* render JS, but it's slower and less reliable than server-rendered HTML. Two mitigations are already in place and two are worth adding:

| Mitigation | Status |
|---|---|
| JSON-LD structured data (Book + Chapter) injected per page | ✅ done |
| `WebSite` + `Organization` JSON-LD in shell HTML (sitelinks search box) | ✅ done (v3.4.0) |
| `/sitemap.xml` auto-generated from Firestore | ✅ done (Worker) |
| Per-route `<title>` updates with the recommended title formula | ✅ done (v3.4.0) |
| Dynamic `<meta description>` + `og:` per route + canonical | ✅ done (v3.4.0 — `setMeta()` in `utils.js`) |
| **Prerendering for bots** (optional, bigger lift) | 🟡 later |

---

## 🔴 1. Submit to Google Search Console (15 min) — DO THIS NOW

1. [search.google.com/search-console](https://search.google.com/search-console) → Add property → **Domain** → enter `jayascans.online`.
2. Verify (Cloudflare DNS = 1-click TXT, or the HTML-tag method — add the tag to `index.html` `<head>`).
3. **Sitemaps** → submit `https://jayascans.online/sitemap.xml`.
4. Repeat for [Bing Webmaster Tools](https://www.bing.com/webmasters) (Bing powers DuckDuckGo + others; easy extra reach).

## ✅ 2. Per-page meta description + Open Graph (dynamic) — DONE

Implemented in v3.4.0. The helper lives in `assets/js/lib/utils.js`:

```js
import { setMeta, truncate } from '../lib/utils.js';

setMeta({
  title:       'Solo Raven - Read Manhwa English Free | JayaScans',
  description: truncate(`Read Solo Raven (Manhwa) in English on JayaScans. Genres: Action, Fantasy. ${s.description}`, 180),
  image:       s.cover,
  url:         location.href,
  type:        'book'           // 'website' | 'article' | 'book'
});
```

Wired into: home, browse, genre, series, reader. Adding it to a new view = one import + one call.

## ✅ 3. Title formula that ranks — DONE

Applied in v3.4.0:

| Page | Title pattern |
|---|---|
| Series | `{Title} - Read {Type} English Free \| JayaScans` |
| Chapter | `{Title} Chapter {N} English \| JayaScans` |
| Genre | `{Genre} - Read Free Manhwa & Manga \| JayaScans` |
| Home | `JayaScans — Read Manhwa, Manga & Manhua Online Free` |

The chapter pattern is the money-maker — it matches "[series] chapter [n] english" searches exactly.

---

## 🟡 4. Technical hygiene (already mostly done)

- ✅ `robots.txt` allows crawl, disallows `/admin`, points to sitemap.
- ✅ Mobile-first, fast LCP (you fixed it to ~green).
- ✅ HTTPS (Cloudflare).
- ✅ Canonical via `og:url` (add `<link rel="canonical">` per route too — same helper).
- Add **hreflang** only if you add other languages later.
- Keep **Core Web Vitals** green: lazy-load below-fold images (done), avoid layout shift (CLS already 0).

## 🟡 5. Internal linking (free ranking juice)

- "Related series" on each series page → ✅ already there (links by genre).
- Add **"You might also like"** + **genre tag links** on chapter pages too (more internal links = better crawl depth).
- Breadcrumbs (`Home > Genre > Series > Chapter`) with BreadcrumbList JSON-LD — easy win, ping Kiro.

## 🟡 6. Content signals

- Fill **alt titles** (helps non-English-title searches) → import already grabs these.
- Write **2–3 sentence unique descriptions** (don't just paste MangaDex). Unique text ranks better.
- Use real **genres + tags** (import fills these).

---

## 🟢 7. Off-page (the long game)

- Get listed on manga directory/aggregator link lists.
- A Discord/Telegram community → drives brand searches (the strongest signal).
- Don't buy links. Don't spam. For this niche, **consistent releases + a community** beat any link scheme.

---

## 🟢 8. Optional: prerender for bots (bigger lift, do when traffic justifies)

If JS-render indexing proves flaky (check Search Console "Coverage"), add a Worker branch that serves **static HTML to crawlers**:
- Detect bot UA (`Googlebot`, `bingbot`, etc.) in the main Worker.
- For series/chapter routes, server-render a minimal HTML snapshot (title, description, cover, JSON-LD, links) from Firestore — reusing the `firestore.js` helpers already in the Worker.
- Humans still get the SPA; bots get instant HTML.

This is the single biggest SEO upgrade available but it's ~a day of work. Ping Kiro when ready.

---

## Checklist

```
✅ DONE in code (v3.4.0):
  ✓ WebSite + Organization JSON-LD in index.html (sitelinks search box)
  ✓ Book / Chapter JSON-LD per route
  ✓ setMeta() wired to home/browse/genre/series/reader
  ✓ Title formula applied (chapter pattern matches the money queries)
  ✓ canonical link via setMeta()
  ✓ /sitemap.xml auto-generated from Firestore
  ✓ /rss feeds (global + per-series)

🔴 DO NOW (off-platform):
  [ ] Search Console + Bing + submit sitemap
  [ ] Replace placeholder /assets/images/og-default.png with a real 1200×630 brand image

🟡 NICE TO ADD:
  [ ] Breadcrumbs JSON-LD (Home > Genre > Series > Chapter)
  [ ] Chapter-page internal links (related + genres)
  [ ] Unique 2–3 sentence descriptions per series (don't paste MangaDex)
  [ ] Fill alt titles + genres for every series

🟢 LONG GAME:
  [ ] Community (Discord/Telegram) for brand signals
  [ ] Bot prerender (when traffic justifies)
```
