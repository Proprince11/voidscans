# Design Document: Mobile UI & Homepage Redesign

## Overview

This feature delivers six coordinated improvements to the JayaScans homepage and introduces a full articles/blog system. All work is constrained to vanilla JS + CSS with no build step, no npm dependencies, and Cloudflare Pages CDN hosting with Firebase Firestore as the data store.

The six areas of change are:

1. **Mobile Hero Layout Fix** — CSS-only fix to `.hero-content` so mobile shows a 120px cover + remaining metadata in a two-column row, matching the desktop treatment.
2. **Latest Updates Carousel** — Replace the `.update-list` grid with a CSS scroll-snap horizontal carousel. JS handles only auto-rotation (setInterval), pause logic, dot rendering, and IntersectionObserver entrance animation.
3. **Browse by Genre Grid** — Replace the flat `.genre-strip` pill row on the homepage with a responsive `.genre-grid` of emoji+label tiles.
4. **Consistent Card Sizing** — Unify card dimensions across Popular Now, New Arrivals, and Continue Reading using existing `.card-grid` CSS rules.
5. **Popular Now & New Arrivals Polish** — Cap both sections at 12 cards, enforce empty states when < 4 results, maintain section padding on mobile.
6. **Articles / Blog System** — New Firestore `articles/` collection, a no-code block builder in admin, two public routes (`/articles`, `/articles/:slug`), a pure-function block renderer, JSON-LD SEO, and a "Latest Articles" homepage section.

### Key Constraints

- Zero new npm dependencies or build tooling
- All CSS uses tokens from `assets/css/tokens.css`
- Breakpoints: `<480px`, `480–768px`, `768–1024px`, `1024–1440px`, `>1440px`
- Bottom nav on mobile (`<768px`), top nav on desktop (`>=768px`)
- Firestore free tier — minimize reads via the existing `memoFetch` / TTL cache pattern

---

## Architecture

### File Change Summary

| File | Change type | Reason |
|------|-------------|---------|
| `assets/css/components.css` | Modified | Add `.updates-carousel`, `.update-card`, `.article-card`, `.chapter-cta-block` |
| `assets/css/pages.css` | Modified | Add `.genre-grid`, `.genre-tile`, `.article-body`, `.article-hero`, `.article-listing` |
| `assets/js/views/home.js` | Modified | Carousel, genre grid, latest articles section, cap popular/new arrivals |
| `assets/js/views/_components.js` | Modified | Add `genreGrid()`, `GENRE_ICONS`, `articleCard()`, update `updateCard()` |
| `assets/js/lib/api.js` | Modified | Add article CRUD: `fetchArticles`, `fetchArticleBySlug`, `createArticle`, `updateArticle`, `deleteArticle`, `trackArticleView` |
| `assets/js/app.js` | Modified | Register `/articles` and `/articles/:slug` routes |
| `assets/js/admin.js` | Modified | Add `articles` entry to `TABS` object |
| `admin/index.html` | Modified | Add Articles nav item to sidebar |
| `assets/js/views/articles.js` | **New** | Article listing page view |
| `assets/js/views/article.js` | **New** | Article detail page view + `renderBlocks()` |
| `assets/js/admin/articles.js` | **New** | Admin Articles tab: list view + editor + block builder |

### Why no new framework or build step

The project is a vanilla JS SPA deployed to Cloudflare Pages with static files. Adding a bundler would require CI/CD changes beyond this spec's scope. All new components follow the established pattern of returning HTML strings from pure functions, using `innerHTML` assignment.

### Data flow diagram — Article creation (admin → Firestore)

```
Admin clicks Save Article
  → validateArticleForm(formData) — pure, returns bool
    IF invalid: show inline errors, stop
  → JSON.stringify(blocks) → blocksJson string
  → createArticle({ ...meta, blocks: blocksJson })
      → setDoc(doc(db, 'articles', slug), payload)
      → cacheBust('articles:')
  → toast('Article saved') + navigate back to list
```

### Data flow diagram — Article read (public page → api.js → Firestore)

```
User navigates to /articles/:slug
  → router calls articleDetail(params, ctx)
  → fetchArticleBySlug(slug)
      → cacheGet('articles:slug:{slug}')  [hit? return cached]
      → getDocs(query articles where slug == slug limit 1)
      → JSON.parse(doc.blocks) → blocks array
      → cacheSet('articles:slug:{slug}', article, 2min TTL)
  → setMeta(title, excerpt, url, coverImage)
  → inject JSON-LD <script> into <head>
  → fetchAllSeries() [already cached from other sections, 0 extra reads]
  → renderBlocks(blocks, seriesCatalog) → HTML string
  → ctx.outlet.innerHTML = fullArticleHTML
  → trackArticleView(slug) [non-blocking, sessioned]
```

---

## Components and Interfaces

### 1. Mobile Hero Layout Fix

**CSS change only — no JS changes.**

In `assets/css/components.css`, the existing `.hero-content` block currently uses `grid-template-columns: 1fr` at the default (mobile-first) level and switches to `200px 1fr` at `≥768px`. The fix adds a new rule scoped to `<768px`:

```css
/* NEW — mobile hero two-column fix */
@media (max-width: 767px) {
  .hero-content {
    grid-template-columns: 120px 1fr;
    gap: var(--s-3);
    min-height: 240px;
    max-height: 360px;
    align-items: start;
    padding: var(--s-4);
  }
  .hero-cover {
    width: 120px;
    aspect-ratio: 2/3; /* height: 180px */
  }
  .hero-title {
    font-size: clamp(1.25rem, 4vw, 1.75rem);
    -webkit-line-clamp: 2;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .hero-desc {
    -webkit-line-clamp: 2;
  }
  .hero-meta {
    min-width: 0; /* prevents overflow past viewport edge */
  }
}
```

The existing `@media (min-width: 768px)` desktop rule is unchanged.

**Rationale:** CSS-only fix is safer than JS for layout. The `min-width: 0` on `.hero-meta` is the key overflow guard — without it, flex/grid children can overflow the grid column.

### 2. Latest Updates Carousel

#### New CSS classes (in `assets/css/components.css`)

| Class | Description |
|-------|-------------|
| `.updates-carousel-wrap` | Outer container with `overflow: hidden`; hosts `::before`/`::after` gradient fade pseudo-elements |
| `.updates-carousel` | The scrollable strip: `display: flex`, `overflow-x: auto`, `overflow-y: hidden`, `scroll-snap-type: x mandatory`, `-ms-overflow-style: none`, `scrollbar-width: none` |
| `.update-card` | Individual card: `flex-shrink: 0`, `width: 120px` mobile / `160px` desktop, `scroll-snap-align: start`, `aspect-ratio: 2/3`, `position: relative` |
| `.update-card-img` | Cover image: `width: 100%`, `height: 100%`, `object-fit: cover` |
| `.update-card-title` | Title overlay: `position: absolute`, `bottom: 0`, gradient background, `-webkit-line-clamp: 2`, `font-size: 12px` mobile / `14px` desktop |
| `.update-card-chapter` | Chapter badge: `position: absolute`, `top: var(--s-2)`, `right: var(--s-2)` |
| `.updates-carousel-dots` | Dot row below strip |
| `.updates-carousel-dot` | Individual dot; `.active` class for current position |
| `.update-card-shimmer` | Shimmer keyframe animation on `.skel` class applied to card before image loads |

#### Gradient fade overlays

```css
.updates-carousel-wrap::before,
.updates-carousel-wrap::after {
  content: '';
  position: absolute;
  top: 0; bottom: 0;
  width: 48px;
  pointer-events: none;
  z-index: 2;
}
.updates-carousel-wrap::before {
  left: 0;
  background: linear-gradient(to right, var(--bg), transparent);
}
.updates-carousel-wrap::after {
  right: 0;
  background: linear-gradient(to left, var(--bg), transparent);
}
```

#### JS responsibilities (in `home.js` — `setupCarousel()` function)

- `setInterval(advance, 4000)` — auto-rotation
- On `scroll`, `touchstart`, or dot `click`: `clearInterval` + `setTimeout(resume, 8000)`
- `IntersectionObserver` on the wrap element — on first intersection, add staggered `fadeUp` class to each card with `animation-delay: calc(N * 60ms)`
- Render dots: count = cards ≤ 8 ? cards : Math.ceil(cards / visibleCount)
- Check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` — skip all setInterval calls if true; still set up dot click and scroll handlers
- Return `cleanup` function that clears interval and disconnects observer

**No JS scroll position manipulation.** Advancing the carousel uses CSS scroll-snap — JS calls `carousel.scrollBy({ left: cardWidth + gap, behavior: 'smooth' })` to trigger the next snap position. The browser handles snapping.

### 3. Browse by Genre Grid

#### New function: `genreGrid()` in `_components.js`

```js
export const GENRE_ICONS = {
  'All':          '📚',
  'Action':       '⚔️',
  'Adventure':    '🗺️',
  'Comedy':       '😂',
  'Drama':        '🎭',
  'Fantasy':      '🧙',
  'Romance':      '💕',
  'Martial Arts': '🥋',
  'School Life':  '🏫',
  'Sci-Fi':       '🚀',
  'Horror':       '👻',
  'Mystery':      '🔍',
  'Slice of Life':'☕',
  'Supernatural': '👁️',
  'Isekai':       '🌀',
  'Tragedy':      '💔',
  'Sports':       '🏆',
  'Mecha':        '🤖',
  'Historical':   '🏯',
  'Psychological':'🧠',
  'Thriller':     '🔪',
};

export function genreGrid() {
  const items = ['All', ...GENRES];
  if (!items.length) return '';
  return `
    <div class="genre-grid" role="list" aria-label="Browse by genre">
      ${items.map(g => {
        const slug = g === 'All' ? '' : g.toLowerCase().replace(/\s+/g, '-');
        const href = g === 'All' ? '/browse' : `/genre/${encodeURIComponent(slug)}`;
        const icon = GENRE_ICONS[g] || '📖';
        return `
          <a href="${href}" class="genre-tile" role="listitem" aria-label="${esc(g)}">
            <span class="genre-tile-icon" aria-hidden="true">${icon}</span>
            <span class="genre-tile-label">${esc(g)}</span>
          </a>`;
      }).join('')}
    </div>
  `;
}
```

The existing `genreStrip()` function is **preserved unchanged** for use on browse and series detail pages.

#### New CSS classes (in `assets/css/pages.css`)

```css
.genre-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--s-3);
}
@media (min-width: 480px) { .genre-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 768px) { .genre-grid { grid-template-columns: repeat(4, 1fr); } }
@media (min-width: 1024px) { .genre-grid { grid-template-columns: repeat(5, 1fr); } }

.genre-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--s-2);
  min-height: 64px;
  padding: var(--s-3) var(--s-2);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--r-md); /* 12px */
  text-decoration: none;
  color: var(--text);
  transition: border-color var(--t-fast), transform var(--t-fast);
  cursor: pointer;
}
.genre-tile:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}
.genre-tile:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.genre-tile:focus:not(:focus-visible) { outline: none; }
.genre-tile-icon { font-size: 1.5rem; line-height: 1; }
.genre-tile-label { font-size: 14px; font-weight: var(--fw-semibold); text-align: center; }
```

### 4. Article Card Component

#### New function: `articleCard(article)` in `_components.js`

```js
export function articleCard(article) {
  if (!article) return '';
  const { slug, title, excerpt, category, coverImage, publishedAt } = article;
  const href = `/articles/${encodeURIComponent(slug)}`;
  const dateStr = publishedAt?.toDate
    ? publishedAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';
  const imgHtml = coverImage
    ? `<img src="${esc(coverImage)}" alt="${esc(title)}" class="article-card-img" loading="lazy" decoding="async"
           onerror="this.parentElement.classList.add('no-image'); this.remove();">`
    : '';
  return `
    <a href="${href}" class="article-card" aria-label="${esc(title)}">
      <div class="article-card-cover ${coverImage ? '' : 'no-image'}">${imgHtml}</div>
      <div class="article-card-body">
        <span class="badge badge-accent">${esc(category || '')}</span>
        <h3 class="article-card-title">${esc(title)}</h3>
        <p class="article-card-excerpt">${esc(excerpt || '')}</p>
        <time class="article-card-date">${esc(dateStr)}</time>
      </div>
    </a>
  `;
}
```

#### CSS classes (in `assets/css/components.css`)

```css
.article-card {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: var(--s-3);
  padding: var(--s-3);
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  text-decoration: none;
  color: var(--text);
  transition: border-color var(--t-fast), background var(--t-fast);
}
.article-card:hover { border-color: var(--accent); background: var(--surface-2); }
.article-card-cover {
  width: 100px;
  aspect-ratio: 16/9;
  border-radius: var(--r-sm);
  overflow: hidden;
  background: var(--surface-3);
  flex-shrink: 0;
}
.article-card-cover.no-image { background: var(--surface-3); }
.article-card-img { width: 100%; height: 100%; object-fit: cover; }
.article-card-body { display: flex; flex-direction: column; gap: var(--s-1); min-width: 0; }
.article-card-title {
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  margin: 0;
}
.article-card-excerpt {
  font-size: var(--fs-xs);
  color: var(--text-muted);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  margin: 0;
}
.article-card-date { font-size: var(--fs-xs); color: var(--text-faint); }
```

### 5. Block Renderer

#### Function: `renderBlocks(blocks, seriesCatalog)` in `assets/js/views/article.js`

Pure function — takes an array of block objects and the series catalog map, returns an HTML string. No DOM writes. All user content passes through `esc()`.

```js
export function renderBlocks(blocks, seriesCatalog = new Map()) {
  if (!Array.isArray(blocks)) return '';
  return blocks.map(block => {
    switch (block.type) {
      case 'text':
        return `<p class="article-block-text">${esc(block.value || '')}</p>`;
      case 'image':
        return `
          <figure class="article-block-figure">
            <img src="${esc(block.url || '')}" alt="${esc(block.alt || '')}" loading="lazy" decoding="async">
            ${block.caption ? `<figcaption>${esc(block.caption)}</figcaption>` : ''}
          </figure>`;
      case 'hyperlink':
        return `
          <p class="article-block-link">
            <a href="${esc(block.url || '')}" rel="noopener"
               ${block.newTab ? 'target="_blank"' : ''}>${esc(block.label || block.url || '')}</a>
          </p>`;
      case 'series': {
        const s = seriesCatalog.get(block.slug);
        return s ? seriesCard(s) : '';  // omit silently if not found
      }
      case 'chapter': {
        const s = seriesCatalog.get(block.seriesSlug);
        const label = block.label || `Read Chapter ${esc(String(block.chapterNum || ''))}`;
        const href = `/read/${encodeURIComponent(block.seriesSlug)}/${encodeURIComponent(block.chapterNum)}`;
        return `
          <div class="chapter-cta-block">
            ${s?.cover ? `<img src="${esc(proxyImage(s.cover))}" alt="${esc(s?.title || '')}" loading="lazy">` : ''}
            <div class="chapter-cta-meta">
              <span class="chapter-cta-series">${esc(s?.title || block.seriesSlug)}</span>
              <a href="${href}" class="btn btn-primary">${esc(label)}</a>
            </div>
          </div>`;
      }
      default: return '';
    }
  }).join('\n');
}
```

#### CSS for block types (in `assets/css/pages.css`)

```css
.article-body { display: flex; flex-direction: column; gap: var(--s-5); }
.article-block-text { color: var(--text-soft); line-height: var(--lh-loose); margin: 0; }
.article-block-figure { margin: 0; }
.article-block-figure img { width: 100%; border-radius: var(--r-md); }
.article-block-figure figcaption { font-size: var(--fs-xs); color: var(--text-muted); margin-top: var(--s-2); }
.article-block-link { margin: 0; }
.article-block-link a { color: var(--accent); text-decoration: underline; }
.chapter-cta-block {
  display: grid;
  grid-template-columns: 60px 1fr;
  gap: var(--s-3);
  align-items: center;
  padding: var(--s-4);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}
.chapter-cta-block img { width: 60px; aspect-ratio: 2/3; object-fit: cover; border-radius: var(--r-sm); }
.chapter-cta-meta { display: flex; flex-direction: column; gap: var(--s-2); }
.chapter-cta-series { font-size: var(--fs-sm); font-weight: var(--fw-semibold); color: var(--text); }
```

### 6. Article Listing and Detail Pages

#### `assets/js/views/articles.js` — exported function `articles(params, ctx)`

- Renders heading + loading skeleton
- Calls `fetchArticles({ limitTo: 12 })`
- Renders grid of `articleCard()` components
- `IntersectionObserver` on a sentinel element at bottom — on trigger calls `fetchArticles({ limitTo: 12, startAfter: lastDoc })` to paginate
- Sets meta: title "Articles — {SITE.name}", description from site tagline

#### `assets/js/views/article.js` — exported function `article(params, ctx)`

- Reads `params.slug`
- Calls `fetchArticleBySlug(slug)` — if null, renders `notFound()` and returns
- Calls `setMeta({ title, description: excerpt, url: /articles/{slug}, image: coverImage })`
- Injects JSON-LD `<script type="application/ld+json">` into `document.head`
- Calls `fetchAllSeries()` to build `seriesCatalog` (already cached — 0 extra reads)
- Calls `renderBlocks(blocks, seriesCatalog)` to get article HTML
- Assigns to `ctx.outlet.innerHTML`
- Calls `trackArticleView(slug)` asynchronously (fire-and-forget, after `requestAnimationFrame`)
- Returns `{ title: article.title, cleanup: () => { /* remove JSON-LD script */ } }`

---

## Data Models

### Article Firestore Document Schema

**Collection:** `articles/`  
**Document ID:** `{slug}` (URL-safe string)

```
{
  slug:        string   // URL-safe, used as doc ID
  title:       string   // Article headline
  excerpt:     string   // Max 160 chars; used as meta description
  blocks:      string   // JSON.stringify() of ContentBlock[] array
  coverImage:  string   // Public image URL (hotlinked)
  category:    "recommendations" | "news" | "editorial" | "announcements"
  tags:        string[] // Array of tag strings
  author:      string
  publishedAt: Timestamp
  updatedAt:   Timestamp
  published:   boolean
  views:       number   // Incremented by trackArticleView
  featured:    boolean  // Prioritized in homepage Latest Articles section
}
```

**Note on `blocks` field:** Firestore does not support nested arrays of objects cleanly (causes issues with array-contains queries and partial updates). The `blocks` field is stored as a JSON string. `createArticle` and `updateArticle` call `JSON.stringify(blocks)` before writing. `fetchArticleBySlug` calls `JSON.parse(doc.blocks)` on read. If the string is malformed, it defaults to `[]` via a try/catch.

### Block Type Schemas

All five block types share the `type` discriminant field. Stored as elements in the `blocks` JSON array.

```js
// 1. Text block
{ type: "text", value: string }

// 2. Image block
{
  type: "image",
  url: string,       // public image URL
  alt: string,       // optional, may be empty string
  caption: string    // optional, may be empty string
}

// 3. Hyperlink block
{
  type: "hyperlink",
  label: string,     // displayed link text
  url: string,       // destination URL
  newTab: boolean    // true -> target="_blank"
}

// 4. Series block
{
  type: "series",
  slug: string       // series slug; looked up in seriesCatalog at render time
}

// 5. Chapter block
{
  type: "chapter",
  seriesSlug: string,
  chapterNum: number,
  label: string      // optional; overrides "Read Chapter N" if non-empty
}
```

### Article API Functions

```js
// Fetch list of published articles with optional filters
fetchArticles({ limitTo = 12, category = null, startAfter = null })
// Cache key: articles:all:{limitTo}:{category || ''}, TTL: 5 min

// Fetch a single article by slug, parses blocks JSON on read
fetchArticleBySlug(slug)
// Cache key: articles:slug:{slug}, TTL: 2 min

// Create new article (admin only)
createArticle(data)  // serializes data.blocks to JSON string; uses slug as doc ID
// On success: cacheBust('articles:')

// Partial update (admin only)
updateArticle(slug, patch)  // if patch.blocks present, re-serializes to JSON string
// On success: cacheBust('articles:') + cacheBust('articles:slug:{slug}')

// Delete article (admin only)
deleteArticle(slug)
// On success: cacheBust('articles:') + cacheBust('articles:slug:{slug}')

// Increment view count — sessioned, non-blocking
trackArticleView(slug)
// Checks sessionStorage key vs:article:{slug}; if already set, skips
// Uses increment(1) on articles/{slug}.views
```

---

## Carousel State Machine

The `setupCarousel()` function in `home.js` manages the following states:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CAROUSEL STATE MACHINE                           │
│                                                                     │
│  [INIT]                                                             │
│    │                                                                │
│    ▼ cards <= visibleCount OR reducedMotion == true                 │
│  [STATIC] ──────────────────────────────────────────────────────┐   │
│    │ (no auto-rotation, no dots)                                 │   │
│    │ cards > visibleCount AND reducedMotion == false             │   │
│    ▼                                                             │   │
│  [AUTO_ROTATING] ◄──────────────────────────────────────────┐   │   │
│    │ every 4000ms: advance()                                 │   │   │
│    │ on user gesture (scroll/swipe/dot-click)                │   │   │
│    ▼                                                         │   │   │
│  [PAUSED]                                                    │   │   │
│    │ setTimeout(resume, 8000ms)                              │   │   │
│    │ after 8000ms: ────────────────────────────────────────► │   │   │
│    │ on page hidden (visibilitychange)                       │   │   │
│    ▼                                                         │   │   │
│  [BACKGROUND] (clearInterval, hold position)                │   │   │
│    │ on page visible: ───────────────────────────────────►   │   │   │
│                                                             └───┘   │
└─────────────────────────────────────────────────────────────────────┘
```

**State transitions:**

| From | Trigger | To |
|------|---------|-----|
| INIT | cards > visibleCount AND !reducedMotion | AUTO_ROTATING |
| INIT | cards <= visibleCount OR reducedMotion | STATIC |
| AUTO_ROTATING | user scroll/swipe/dot-click | PAUSED |
| PAUSED | 8000ms timeout elapsed | AUTO_ROTATING |
| AUTO_ROTATING | `document.visibilitychange` → hidden | BACKGROUND |
| BACKGROUND | `document.visibilitychange` → visible | AUTO_ROTATING |
| Any | route cleanup (SPA navigation) | DESTROYED (clearInterval + disconnect observer) |

**Reduced motion behavior:**
- Transition `--t-fast`, `--t-base`, `--t-slow`, `--t-slower` all resolve to `0ms` via the existing `prefers-reduced-motion` rule in `tokens.css`
- Carousel enters STATIC state — no `setInterval`, no entrance animations, no scale hover effects
- Manual scroll/swipe/dot navigation still works
- Hover: only border-color change to `--accent` (no scale/shadow)

---

## Admin Block Builder State Model

The block builder in `assets/js/admin/articles.js` uses a JS closure to hold state — no framework, no virtual DOM.

```
State:
  blocks: ContentBlock[]   // ordered array, mutated in-place
  
Actions:
  addBlock(type)           // blocks.push(defaultBlock(type)); render()
  deleteBlock(idx)         // blocks.splice(idx, 1); render()
  moveBlockUp(idx)         // if idx > 0: swap blocks[idx] and blocks[idx-1]; render()
  moveBlockDown(idx)       // if idx < blocks.length-1: swap; render()
  updateBlock(idx, patch)  // Object.assign(blocks[idx], patch); renderPreview()

Render cycle:
  render()        → rebuilds entire block list DOM from blocks[]
                  → calls renderPreview()
  renderPreview() → calls renderBlocks(blocks, seriesCatalog)
                  → sets previewPanel.innerHTML
```

The `render()` function regenerates the entire block builder list on each mutation. This is deliberate: with at most ~20 blocks per article, full re-render is imperceptible and eliminates diffing complexity. The preview panel is a `<div class="article-preview-panel">` positioned adjacent to or below the block list.

Each block row in the builder:
```html
<div class="block-row" data-idx="N">
  <div class="block-row-handle">
    <button data-action="up">▲</button>
    <button data-action="down">▼</button>
  </div>
  <div class="block-row-content">
    <!-- type-specific inputs -->
  </div>
  <button class="block-row-delete" data-action="delete">✕</button>
</div>
```

**Series/Chapter block autocomplete:** On mount, the admin tab calls `fetchAllSeries()` and builds a `<datalist id="series-options">` with all series titles/slugs. Series and Chapter block inputs use `list="series-options"` for native browser autocomplete. No custom dropdown JS required.

**Image URL live preview:** The Image block's URL input has an `input` event listener that sets a `<img class="block-img-preview">` `src` attribute on each keystroke. A 400ms debounce avoids flickering during typing.

---

## SEO Strategy for Articles

### Per-article `setMeta()` call

The Article_Detail_Page calls the existing `setMeta()` utility (from `utils.js`) with:

```js
setMeta({
  title: article.title,           // <title> + og:title
  description: article.excerpt,   // <meta name="description"> + og:description (≤160 chars)
  url: `${SITE.baseUrl}/articles/${article.slug}`,  // <link rel="canonical"> + og:url
  image: article.coverImage || null,  // og:image (omitted if absent)
  type: 'article'                 // og:type
});
```

### JSON-LD Article Schema

Injected as `<script type="application/ld+json" data-ld="article">` into `document.head`. The `data-ld` attribute allows the cleanup function to remove it on SPA navigation to prevent stale metadata in the head.

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{article.title}",
  "datePublished": "{article.publishedAt.toDate().toISOString()}",
  "dateModified": "{article.updatedAt.toDate().toISOString()}",
  "image": "{article.coverImage}",
  "author": {
    "@type": "Person",
    "name": "{article.author}"
  },
  "publisher": {
    "@type": "Organization",
    "name": "{SITE.name}",
    "logo": {
      "@type": "ImageObject",
      "url": "{SITE.baseUrl}/assets/images/logo.svg"
    }
  },
  "description": "{article.excerpt}",
  "url": "{SITE.baseUrl}/articles/{article.slug}",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "{SITE.baseUrl}/articles/{article.slug}"
  }
}
```

The JSON-LD script is inserted **once per article page visit** and removed in the view's `cleanup()` function when the router navigates away, preventing duplicate structured data when the user navigates between articles within the SPA.

### Cloudflare Pages / `_redirects`

The existing `_redirects` file already routes all paths to `index.html` for SPA fallback. No changes are needed — `/articles` and `/articles/:slug` will be handled by the client-side router after the initial HTML shell loads.

---

## Firestore Security Rules Additions

Add the following rule block to the existing `firestore.rules` file alongside the existing `series`, `chapters`, `reactions`, and `reports` rules:

```javascript
match /articles/{slug} {
  // Public read — anyone can read published articles
  allow read: if true;

  // Write only for admin-claimed users
  allow write: if request.auth != null
               && request.auth.token.admin == true;
}
```

**Note:** The `read: if true` allows the article listing page and detail page to load without authentication. The `views` counter increment in `trackArticleView` is also a write; this needs a limited rule allowing counter increments for unauthenticated users:

```javascript
match /articles/{slug} {
  allow read: if true;
  allow update: if request.resource.data.diff(resource.data).affectedKeys()
                   .hasOnly(['views'])
                && request.resource.data.views == resource.data.views + 1;
  allow write: if request.auth != null
               && request.auth.token.admin == true;
}
```

This mirrors the pattern already used for `series.views` tracking in the existing rules.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

#### Redundancy Elimination

Before listing properties, redundancy is eliminated:

- Requirements 5.1 and 5.2 (Popular cap at 12, New Arrivals cap at 12) describe the same invariant applied to two different arrays — they are combined into one property.
- Requirements 2.7 and 2.8 both describe the update card rendering invariant — they are combined into one property.
- Requirements 6.9 and 6.10 both test what the article detail page emits into the head — they are combined.
- Requirements 6.15 and 6.16 both test the caching TTL pattern — they are combined into one general caching property.
- Requirements 3.3 (emoji mapping) and 3.7 (slug derivation) are distinct pure functions; both retained.
- Requirements 6.26 (block reorder), 6.28 (validation), 6.30 (homepage article selection), 6.32 (articleCard fields), 6.33 (articleCard href) are all testable pure-function properties; all retained.

---

### Property 1: Hero meta never overflows the viewport on mobile

*For any* series item rendered as a hero slide on a viewport strictly below 768px, no child element of `.hero-meta` should have a layout width that causes it to overflow the `.hero-content` grid column assigned to it (i.e., `container width - 120px - gap`).

**Validates: Requirements 1.3**

---

### Property 2: Hero title font size stays within clamp bounds on mobile

*For any* viewport width W in the range [0, 768), the computed font-size of `.hero-title` should be greater than or equal to 1.25rem and less than or equal to 1.75rem.

**Validates: Requirements 1.5**

---

### Property 3: Carousel scrolls horizontally without triggering vertical page scroll

*For any* set of update cards whose total width exceeds the carousel container width, the `.updates-carousel` container should scroll horizontally and its `overflow-y` should be `hidden`, ensuring no vertical scroll bar or overflow appears.

**Validates: Requirements 2.1, 2.23**

---

### Property 4: Carousel pause-and-resume after any user gesture

*For any* user gesture (scroll event, touchstart event, or dot-button click) on the Updates_Carousel, auto-rotation should pause and a resume timer of exactly 8000ms should be scheduled; after 8000ms, auto-rotation should resume from the current carousel position.

**Validates: Requirements 2.3**

---

### Property 5: Update card image aspect ratio and fill

*For any* update card rendered from a series with a cover image, the card's image element should have an aspect ratio of 2:3, `object-fit: cover`, and `width: 100%` of the card, at any supported viewport width.

**Validates: Requirements 2.7**

---

### Property 6: Update card title clamped for any title length

*For any* series title string of any length (including titles exceeding 100 characters), the rendered `.update-card-title` element should have `-webkit-line-clamp: 2` applied, preventing more than 2 lines from being visible.

**Validates: Requirements 2.8**

---

### Property 7: Carousel dot count follows the card count rule

*For any* number of update cards N rendered in the carousel, if N ≤ 8 then the dot count equals N; if N > 8 then the dot count equals `Math.ceil(N / visibleGroupSize)`. If N ≤ visibleGroupSize, no dots are rendered.

**Validates: Requirements 2.10, 2.16**

---

### Property 8: Staggered entrance animation delay per card index

*For any* update card at array index N that enters the viewport and triggers the IntersectionObserver, the card's `animation-delay` CSS value should equal `N * 60ms`.

**Validates: Requirements 2.20**

---

### Property 9: Genre grid column count matches breakpoint for any viewport width

*For any* viewport width W: the `.genre-grid` should display exactly 2 columns when W < 480px, exactly 3 columns when 480px ≤ W < 768px, exactly 4 columns when 768px ≤ W < 1024px, and exactly 5 columns when W ≥ 1024px.

**Validates: Requirements 3.1**

---

### Property 10: Genre emoji mapping is complete and correct for all genres

*For any* genre name in the `GENRES` array (plus "All"), the `GENRE_ICONS` map should contain an entry for that genre, and `genreGrid()` should render the specified emoji alongside the genre name in the output HTML string.

**Validates: Requirements 3.3**

---

### Property 11: Genre tile slug derivation for any genre name

*For any* genre name string in the `GENRES` array, the derived URL slug should equal the genre name lowercased with all whitespace sequences replaced by hyphens (e.g., "Martial Arts" → `martial-arts`), consistent with the transformation used in the existing `genreStrip` function.

**Validates: Requirements 3.7**

---

### Property 12: Card title always clamped to 2 lines

*For any* series with a title of any length, the `.card-title` element rendered by `seriesCard()` should have `-webkit-line-clamp: 2` applied, preventing any card from displaying more than 2 lines of title text.

**Validates: Requirements 4.3**

---

### Property 13: Popular Now and New Arrivals capped at 12 for any input size

*For any* array of series data of size N passed to the Popular Now or New Arrivals section renderer, the rendered `.card-grid` should contain exactly `Math.min(N, 12)` card elements.

**Validates: Requirements 5.1, 5.2**

---

### Property 14: Article round-trip — all required fields preserved

*For any* valid Article data object (with all required fields populated), calling `createArticle(data)` followed by `fetchArticleBySlug(data.slug)` should return an article object containing all required fields with values matching the input data, including the `blocks` array (deserialized from the JSON string).

**Validates: Requirements 6.1, 6.2, 6.3**

---

### Property 15: Blocks JSON serialization round trip

*For any* `blocks` array containing any combination of the five block types (with any string content, including empty strings, Unicode, special characters), `JSON.parse(JSON.stringify(blocks))` should produce an array of equal length with each element having the same `type` field and the same type-specific data fields.

**Validates: Requirements 6.3**

---

### Property 16: Article meta and JSON-LD emitted for any article

*For any* Article object passed to the article detail view renderer, `setMeta()` should be called exactly once with `title = article.title`, `description = article.excerpt`, `url` containing `article.slug`, and `image = article.coverImage`; the injected JSON-LD object should contain `@type: "Article"`, `headline = article.title`, `datePublished`, `dateModified`, `image`, `author.name`, and `publisher.name`.

**Validates: Requirements 6.9, 6.10**

---

### Property 17: Block renderer produces one HTML element per block

*For any* `blocks` array of length N containing only known block types, `renderBlocks(blocks, catalog)` should return a string that, when parsed as HTML, contains exactly N root-level elements (or fewer if any `series` or `chapter` blocks reference slugs absent from the catalog, in which case they are omitted silently).

**Validates: Requirements 6.11**

---

### Property 18: trackArticleView is session-deduplicated

*For any* article slug, calling `trackArticleView(slug)` multiple times within the same browser session (same `sessionStorage` context) should result in the `views` counter being incremented by exactly 1, regardless of how many times the function is called.

**Validates: Requirements 6.12**

---

### Property 19: fetchArticles and fetchArticleBySlug are TTL-cached

*For any* call to `fetchArticles(params)` or `fetchArticleBySlug(slug)`, a second call with the same arguments made within the TTL window (5 minutes for fetchArticles, 2 minutes for fetchArticleBySlug) should return the cached result, with Firestore's `getDocs` called exactly once across both calls.

**Validates: Requirements 6.15, 6.16**

---

### Property 20: Article mutations invalidate the correct cache entries

*For any* call to `createArticle`, `updateArticle(slug, patch)`, or `deleteArticle(slug)`, all cache keys with the prefix `articles:` should be removed from the cache; for `updateArticle` and `deleteArticle`, the per-slug cache key `articles:slug:{slug}` should also be removed.

**Validates: Requirements 6.17**

---

### Property 21: Block reorder is a pure array swap

*For any* `blocks` array of length N and any valid index `i` (where 0 < i < N), calling `moveBlockUp(i)` should produce an array identical to the original except `blocks[i]` and `blocks[i-1]` are swapped; calling `moveBlockDown(i)` (where i < N-1) should swap `blocks[i]` and `blocks[i+1]`. The total array length should be unchanged.

**Validates: Requirements 6.26**

---

### Property 22: Article form validation rejects any missing required field

*For any* article form data object in which at least one of `title`, `slug`, `excerpt`, `category`, `author` is an empty string, or in which `blocks` is an empty array, `validateArticleForm(data)` should return `false`; if and only if all required fields are non-empty and `blocks.length >= 1`, it should return `true`.

**Validates: Requirements 6.28**

---

### Property 23: Homepage Latest Articles selection: featured first, max 3

*For any* array of published articles containing a mix of featured and non-featured items, the homepage Latest Articles section should render at most 3 article cards, with all featured articles (sorted by `publishedAt` descending) appearing before non-featured articles (sorted by `publishedAt` descending).

**Validates: Requirements 6.30**

---

### Property 24: articleCard renders all required fields for any article

*For any* Article object with all required fields populated, `articleCard(article)` should return an HTML string containing the article's `title`, `excerpt`, `category` (as a badge), and a formatted `publishedAt` date; the outermost element's `href` attribute should equal `/articles/{article.slug}`.

**Validates: Requirements 6.32, 6.33**

---

## Error Handling

### Network / Firestore Failures

| Scenario | Handling |
|----------|----------|
| `fetchArticles` throws | Article listing renders empty state with "Couldn't load articles" message and retry button |
| `fetchArticleBySlug` returns null | Article detail renders existing `notFound()` view |
| `fetchArticleBySlug` throws | Article detail renders error state with "Couldn't load article" |
| `createArticle` / `updateArticle` throws | Admin shows `toast('Save failed: {error.message}', 'error')`, does not navigate away |
| `deleteArticle` throws | Admin shows `toast('Delete failed', 'error')`, keeps item in list |
| `trackArticleView` throws | Silent swallow — `console.debug` only; never blocks page render |
| `blocks` JSON.parse fails | Defaults to `[]`; article renders with no body blocks, no crash |

### Image Loading

| Scenario | Handling |
|----------|----------|
| Update card cover image fails to load | Card background stays dark (`--surface-3`); shimmer stops |
| Hero cover fails to load | `onerror` removes src attribute; dark placeholder shown at 120×180px mobile / full column desktop |
| Article card `coverImage` fails | `onerror` adds `.no-image` class, removes `<img>`; styled dark-surface box shown |
| Series block: slug not in catalog | Block is omitted from rendered output silently |

### Admin Block Builder

| Scenario | Handling |
|----------|----------|
| Image URL input not a valid URL | Preview `<img>` shows native broken-image state; save is still allowed (admin is responsible for URL validity) |
| Series autocomplete: typed slug matches nothing | Block is saved with the entered slug; if the series doesn't exist, the block renders empty on the public page |
| Form submission with empty required fields | `validateArticleForm()` returns false; inline error messages appear below each invalid field; no Firestore write |

---

## Testing Strategy

### Dual Testing Approach

Both unit/example-based tests and property-based tests are used. The feature includes significant pure logic (block renderer, slug derivation, form validation, cache invalidation, article selection/sorting) that is well-suited for property-based testing. UI and infrastructure aspects use example-based tests.

### Property-Based Testing

**Library:** [fast-check](https://fast-check.io) — browser-compatible, no build step required via CDN ESM import in test files.

**Test runner:** Native browser test harness or a lightweight test runner (e.g., `uvu`) that can run in Node.js against the pure functions extracted from each module.

**Configuration:** Each property test runs a minimum of 100 iterations. Each test file is tagged with the feature and property number.

**Test file locations:**
- `tests/properties/article-api.test.js` — Properties 14–20
- `tests/properties/block-renderer.test.js` — Properties 15, 17
- `tests/properties/components.test.js` — Properties 6, 10, 11, 12, 13, 24
- `tests/properties/carousel.test.js` — Properties 7, 8
- `tests/properties/admin-editor.test.js` — Properties 21, 22, 23

**Example tag format:**
```js
// Feature: mobile-ui-homepage-redesign, Property 15: Blocks JSON serialization round trip
fc.assert(
  fc.property(arbitraryBlocksArray, (blocks) => {
    const roundTripped = JSON.parse(JSON.stringify(blocks));
    // assert equivalence...
  }),
  { numRuns: 100 }
);
```

### Unit / Example-Based Tests

Unit tests cover the specific examples, edge cases, and UI behaviors not addressed by property tests:

- Hero layout: computed CSS at `<768px` and `>=768px` viewports
- Hero cover: 120px width on mobile, fallback placeholder on image error
- Carousel: setInterval called with 4000ms; reduced-motion skips auto-rotation
- Genre grid: "All Genres" tile renders first with `/browse` href
- Genre tile focus: `:focus-visible` outline visible; no outline on mouse click
- Empty genre list: section omitted from DOM
- Article card: formatted `publishedAt` date for specific inputs
- Carousel shimmer: `.skel` class applied before image load
- Article listing: pagination sentinel triggers next Firestore fetch
- Admin block builder: each "Add Block" button appends correct default block
- Admin delete: confirmation dialog appears before `deleteArticle` is called
- JSON-LD cleanup: script element removed on SPA route change

### Integration Tests

- `fetchArticles` → Firestore → returns array of normalized articles
- `createArticle` → Firestore → `fetchArticleBySlug` returns correct data (blocks round-trip)
- `trackArticleView` → Firestore increment → re-fetch shows incremented count
- Firestore security rules: unauthenticated write to `articles/` is rejected; authenticated admin write succeeds

### Accessibility Checks

- Genre tiles: keyboard focus ring visible (`focus-visible`), minimum 64px touch target
- Article cards: meaningful `aria-label` on card links
- Carousel: dots have `aria-label="Slide N"` attributes
- All images: non-decorative images have non-empty `alt` attributes
- JSON-LD: valid schema markup (validated with Schema.org validator during manual review)
