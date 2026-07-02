# Implementation Plan: Mobile UI & Homepage Redesign

## Overview

Vanilla JS + CSS changes across 11 files (8 modified, 3 new). No build step. Tasks are grouped by layer so each subagent has a clear, self-contained file target.

## Tasks

- [x] 1. CSS foundations — hero fix, carousel styles, article card, chapter CTA block
  - [x] 1.1 Add mobile hero two-column fix to `assets/css/components.css`
    - Add `@media (max-width: 767px)` block targeting `.hero-content`, `.hero-cover`, `.hero-title`, `.hero-desc`, `.hero-meta`
    - Use 120px column, clamp font-size, min/max-height, min-width: 0 on `.hero-meta`
    - Do NOT modify the existing `@media (min-width: 768px)` desktop rule
    - _Requirements: 1.1–1.8_
  - [x] 1.2 Add carousel component CSS to `assets/css/components.css`
    - Add `.updates-carousel-wrap`, `.updates-carousel`, `.update-card`, `.update-card-img`, `.update-card-title`, `.update-card-chapter`, `.updates-carousel-dots`, `.updates-carousel-dot`
    - Include gradient fade overlays as `::before`/`::after` on `.updates-carousel-wrap`
    - Include shimmer and fadeUp keyframes, hover micro-interaction with reduced-motion fallback
    - _Requirements: 2.1, 2.5–2.23_
  - [x] 1.3 Add article card and chapter CTA block CSS to `assets/css/components.css`
    - Add `.article-card`, `.article-card-cover`, `.article-card-img`, `.article-card-body`, `.article-card-title`, `.article-card-excerpt`, `.article-card-date`
    - Add `.chapter-cta-block`, `.chapter-cta-meta`, `.chapter-cta-series`
    - _Requirements: 6.10, 6.32_

- [x] 2. CSS pages — genre grid, article body, article listing, article hero
  - [x] 2.1 Add genre grid CSS to `assets/css/pages.css`
    - Add `.genre-grid` responsive grid (2/3/4/5 cols at breakpoints)
    - Add `.genre-tile`, `.genre-tile-icon`, `.genre-tile-label` with hover, focus-visible ring
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 3.10_
  - [x] 2.2 Add article page CSS to `assets/css/pages.css`
    - Add `.article-body`, `.article-block-text`, `.article-block-figure`, `.article-block-link`
    - Add `.article-hero`, `.article-hero-img`, `.article-listing`, `.article-listing-header`
    - _Requirements: 6.10, 6.11, 6.12_

- [x] 3. JS components layer — `assets/js/views/_components.js`
  - [x] 3.1 Add `GENRE_ICONS` map and `genreGrid()` function
    - Export `GENRE_ICONS` object with all 21 entries (All + 20 genres)
    - Export `genreGrid()` returning `.genre-grid` HTML with emoji tiles
    - Preserve existing `genreStrip()` unchanged
    - _Requirements: 3.1–3.11_
  - [x] 3.2 Add `articleCard()` function
    - Export `articleCard(article)` returning `.article-card` HTML
    - Handle missing coverImage with `.no-image` class, format `publishedAt` date
    - _Requirements: 6.32, 6.33_
  - [x] 3.3 Add `updateCard()` function for carousel
    - Export `updateCard(series)` returning `.update-card` HTML with cover, title overlay, chapter badge
    - Include shimmer placeholder when no cover
    - _Requirements: 2.5–2.15_

- [x] 4. API layer — `assets/js/lib/api.js`
  - [x] 4.1 Add article Firestore functions
    - Add `fetchArticles({ limitTo, category, startAfter })` with TTL cache key `articles:all:{limitTo}:{category||''}`
    - Add `fetchArticleBySlug(slug)` with cache key `articles:slug:{slug}`, parse `blocks` JSON on read
    - _Requirements: 6.14, 6.15_
  - [x] 4.2 Add article write and tracking functions
    - Add `createArticle(data)` — serialize `blocks` to JSON string, use slug as doc ID, cacheBust `articles:`
    - Add `updateArticle(slug, patch)` — re-serialize blocks if present, bust list + slug caches
    - Add `deleteArticle(slug)` — delete doc, bust list + slug caches
    - Add `trackArticleView(slug)` — session-deduplicated via `sessionStorage`, non-blocking atomic increment
    - _Requirements: 6.13, 6.16_

- [x] 5. Home view — `assets/js/views/home.js`
  - [x] 5.1 Replace Latest Updates list with carousel
  - [x] 5.2 Replace genre strip with genre grid and add Latest Articles section
  - [x] 5.3 Cap Popular Now and New Arrivals, enforce empty states

- [x] 6. Public article views
  - [x] 6.1 Create `assets/js/views/articles.js` — article listing page
  - [x] 6.2 Create `assets/js/views/article.js` — article detail page + `renderBlocks()`

- [x] 7. Admin articles tab — `assets/js/admin/articles.js`
  - [x] 7.1 Article list view
  - [x] 7.2 Article editor form — metadata fields
  - [x] 7.3 Block builder UI

- [x] 8. App wiring
  - [x] 8.1 Register article routes in `assets/js/app.js`
  - [x] 8.2 Add Articles tab to admin panel

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1.1", "1.2", "1.3", "2.1", "2.2"] },
    { "wave": 2, "tasks": ["3.1", "3.2", "3.3", "4.1", "4.2"] },
    { "wave": 3, "tasks": ["5.1", "5.2", "5.3", "6.1", "6.2"] },
    { "wave": 4, "tasks": ["7.1", "7.2", "7.3"] },
    { "wave": 5, "tasks": ["8.1", "8.2"] }
  ]
}
```

## Notes

- All CSS uses design tokens from `tokens.css` — no hardcoded hex values or pixel values outside the token scale
- The existing `genreStrip()`, `seriesCard()`, `updateRow()`, `rankItem()`, `emptyState()` functions in `_components.js` must remain unchanged
- The existing hero slider JS (`setupHeroSlider()`) in `home.js` must remain unchanged
- Article `blocks` field is stored as a JSON string in Firestore (not a nested array) — always `JSON.stringify()` on write, `JSON.parse()` on read
- `trackArticleView` uses `sessionStorage` key `vs:article:{slug}` (mirrors existing `vs:viewed:series:{slug}` pattern)
