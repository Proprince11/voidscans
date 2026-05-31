# 10 — SEO Guide (tailored to this app)

A practical, step-by-step SEO plan for a scanlation SPA on Cloudflare Workers. Ordered by impact-per-effort. Do the 🔴 ones first.

> Reality check: scanlation sites rank mostly on **long-tail title queries** ("[series] chapter [n] english") and **brand queries** once you have a following. You won't out-rank MangaDex on generic terms — you win by being the fast, clean result for specific series people already searched a name for.

---

## 0. The one structural caveat (read first)

This is a **client-rendered SPA** — the HTML shell is near-empty and JS fills it in. Googlebot *does* render JS, but it's slower and less reliable than server-rendered HTML. Two mitigations are already in place and two are worth adding:

| Mitigation | Status |
|---|---|
| JSON-LD structured data (Book + Chapter) injected per page | ✅ done |
| `/sitemap.xml` auto-generated from Firestore | ✅ done (Worker) |
| Per-route `<title>` updates | ✅ done |
| **Dynamic `<meta description>` + `og:` per route** | 🔴 add (below) |
| **Prerendering for bots** (optional, bigger lift) | 🟡 later |

---

## 🔴 1. Submit to Google Search Console (15 min)

1. [search.google.com/search-console](https://search.google.com/search-console) → Add property → **Domain** (once you have the custom domain) or **URL prefix** (for the workers.dev URL now).
2. Verify (Cloudflare DNS = 1-click TXT, or the HTML-tag method — add the tag to `index.html` `<head>`).
3. **Sitemaps** → submit `https://YOURDOMAIN/sitemap.xml`.
4. Repeat for [Bing Webmaster Tools](https://www.bing.com/webmasters) (Bing powers DuckDuckGo + others; easy extra reach).

## 🔴 2. Per-page meta description + Open Graph (dynamic)

Right now only `<title>` changes per route. Add dynamic `description` + `og:`/`twitter:` so series pages get rich previews in search + social shares.

Add a tiny helper (in `assets/js/lib/utils.js`):
```js
export function setMeta({ description, image, url }) {
  const set = (sel, attr, val) => {
    if (!val) return;
    let el = document.head.querySelector(sel);
    if (!el) { el = document.createElement('meta'); document.head.appendChild(el); }
    el.setAttribute(attr.k, attr.v); el.setAttribute('content', val);
  };
  if (description) {
    set('meta[name="description"]', { k:'name', v:'description' }, description);
    set('meta[property="og:description"]', { k:'property', v:'og:description' }, description);
  }
  if (image) set('meta[property="og:image"]', { k:'property', v:'og:image' }, image);
  if (url)   set('meta[property="og:url"]', { k:'property', v:'og:url' }, url);
}
```
Call it in the series view after load:
```js
setMeta({
  description: `Read ${s.title} (${s.type}) in English. ${s.genres.join(', ')}. ${s.description.slice(0,140)}`,
  image: s.cover, url: location.href
});
```
(Ping Kiro to wire this across views — it's ~20 lines.)

## 🔴 3. Title formula that ranks

Match what people actually type. Set per-route titles to:

| Page | Title pattern |
|---|---|
| Series | `{Title} - Read {Type} English Free \| {Brand}` |
| Chapter | `{Title} Chapter {N} English \| {Brand}` |
| Genre | `{Genre} {Type} - Read Free English \| {Brand}` |
| Home | `{Brand} - Read Manhwa, Manga & Manhua Online Free` |

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
🔴 Search Console + Bing + submit sitemap
🔴 Dynamic meta description + og per route
🔴 Title formula (chapter = "[series] chapter N english")
🟡 canonical link per route, breadcrumbs JSON-LD
🟡 chapter-page internal links (related + genres)
🟡 unique descriptions + alt titles + genres filled
🟢 community (Discord/Telegram) for brand signals
🟢 bot prerender (when traffic justifies)
```
