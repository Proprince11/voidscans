# Requirements Document

## Introduction

This feature redesigns the JayaScans homepage UI/UX across four focused areas and adds a new articles/blog system:

1. **Mobile Hero Section** — The current mobile layout collapses `.hero-content` to a single column, leaving the cover image at only 140px wide with a large empty area to its right. The fix aligns mobile with the desktop two-column (cover + metadata) treatment, scaled appropriately for touch screens.

2. **Latest Updates Carousel** — The current `.update-list` is a static CSS grid of compact rows. It will be replaced with a horizontally scrollable, auto-rotating card carousel whose cover cards are sized and styled consistently with the rest of the card system. Premium polish criteria have been added (scroll-snap, gradient fade edges, shimmer loading state, entrance animation, hover micro-interactions, and overflow containment).

3. **Browse by Genre Redesign** — The current genre strip is a plain horizontal scrollable row of `.tag-pill` elements with no visual weight or hierarchy. It will be reimplemented as a visually rich grid of genre tiles with icons/imagery and clear hover states.

4. **Popular Now & New Arrivals (minor polish)** — These sections are already well-received. Small improvements are suggested around visual density and consistent spacing.

5. **Articles / Blog System** — A new admin-managed blog system enabling staff to publish SEO-friendly articles (editorials, recommendations, announcements) directly from the admin panel using a no-code block builder. Admins compose articles by adding and reordering content blocks — Text, Image, Hyperlink, Series Card, and Chapter Card — with zero HTML knowledge required. Articles are stored in Firestore and rendered on two new public routes (`/articles` and `/articles/:slug`). Series and Chapter blocks link readers directly to relevant content on the site. A "Latest Articles" preview section is also added to the homepage.

All changes must use the existing design token system (`tokens.css`), respect the established breakpoints (`<480px`, `480–768px`, `768–1024px`, `1024–1440px`, `>1440px`), and be implemented in vanilla JS + CSS with no new dependencies.

---

## Glossary

- **Hero_Section**: The full-width banner at the top of the homepage containing a cover image, title, genres, description and CTA buttons, implemented as an auto-rotating slide show.
- **Hero_Cover**: The `<img>` element inside `.hero-cover` that displays a series' cover art within the hero.
- **Hero_Meta**: The text column inside `.hero-content` containing title, badges, genres, description and action buttons.
- **Updates_Carousel**: The redesigned "Latest Updates" section — a horizontally scrollable strip of cover cards with title overlays that auto-rotates.
- **Update_Card**: A single item in the Updates_Carousel — portrait cover image with title and latest chapter overlaid at the bottom.
- **Genre_Grid**: The redesigned "Browse by Genre" section — a responsive grid of genre tiles replacing the flat pill strip, rendered with class `.genre-grid`.
- **Genre_Tile**: A single item in the Genre_Grid — a labelled, icon-accented tile linking to a genre browse page.
- **Card_Grid**: The existing `.card-grid` component used in Popular Now and New Arrivals.
- **Design_Token**: A CSS custom property defined in `tokens.css` (e.g., `--accent`, `--s-4`, `--r-md`).
- **Homepage**: The view rendered by `assets/js/views/home.js` at the root route `/`.
- **Mobile**: Viewport widths strictly below 768px.
- **Desktop**: Viewport widths of 768px and above.
- **Reduced_Motion**: The `prefers-reduced-motion: reduce` media query state.
- **Visible_Group**: The set of Update_Cards that fit fully within the carousel viewport width at any given scroll position.
- **Article**: A Firestore document in the `articles/` collection representing a single blog post or editorial piece. Fields include `slug`, `title`, `excerpt`, `blocks` (JSON array of content blocks), `coverImage`, `category`, `tags`, `author`, `publishedAt`, `updatedAt`, `published`, `views`, and `featured`.
- **Article_Listing_Page**: The public view rendered by `assets/js/views/articles.js` at the route `/articles`, displaying all published articles with pagination or infinite scroll.
- **Article_Detail_Page**: The public view rendered by `assets/js/views/article.js` at the route `/articles/:slug`, displaying the full content of a single Article with SEO meta tags and JSON-LD schema.
- **Article_Editor**: The admin-panel form rendered by `assets/js/admin/articles.js` under the "Articles" tab, used to create and edit Articles. Uses a no-code block builder — admins add, reorder, and delete content blocks (Text, Image, Hyperlink, Series Card, Chapter Card) without writing any HTML or code.
- **Article_Card**: A horizontal card component used on both the Article_Listing_Page and the homepage "Latest Articles" section, displaying the Article's cover image, title, excerpt, category badge, and publication date.
- **Content_Block**: A single unit of article content stored as a JSON object with a `type` field and type-specific data fields. The five block types are: `text`, `image`, `hyperlink`, `series`, and `chapter`.
- **Block_Builder**: The interactive UI area within the Article_Editor where admins add, configure, reorder, and delete Content_Blocks to compose the article body without writing code.
- **Series_Block**: A Content_Block of type `series` that renders the existing `seriesCard()` component for a chosen series, linking readers to that series detail page.
- **Chapter_Block**: A Content_Block of type `chapter` that renders a styled card linking readers directly to a specific chapter of a specific series.

---

## Requirements

### Requirement 1: Mobile Hero Layout Fix

**User Story:** As a mobile reader, I want the hero section to display the cover image and series metadata side by side — just like on desktop — so that I can see the cover art and read the title without wasted empty space.

#### Acceptance Criteria

1. WHEN the Homepage is rendered on a viewport width strictly below 768px, THE Hero_Section SHALL display the Hero_Cover and Hero_Meta in a two-column row layout, with the cover on the left and the metadata on the right.
2. WHEN the Homepage is rendered on a viewport width strictly below 768px, THE Hero_Cover SHALL render at a fixed width of 120px and an aspect ratio of 2:3, producing a height of 180px.
3. WHEN the Homepage is rendered on a viewport width strictly below 768px, THE Hero_Meta SHALL occupy all remaining horizontal space to the right of the Hero_Cover, and no child element of Hero_Meta SHALL overflow the viewport edge.
4. WHEN the Homepage is rendered on a viewport width strictly below 768px, THE Hero_Section SHALL have a minimum height of 240px so content is not clipped on small phones.
5. WHEN the Homepage is rendered on a viewport width strictly below 768px, THE Hero_Meta SHALL display the series title clamped to 2 lines with an ellipsis, and the rendered font size SHALL be no smaller than 1.25rem and no larger than 1.75rem.
6. WHEN the Homepage is rendered on a viewport width strictly below 768px, THE Hero_Meta SHALL display the description clamped to 2 lines, and the total height of the Hero_Section SHALL not exceed 360px.
7. WHEN the Homepage is rendered on a viewport width of 768px or greater, THE Hero_Section SHALL display the Hero_Cover and Hero_Meta in a two-column row layout where the cover column is narrower than the metadata column, unchanged from the pre-feature behavior.
8. IF the Hero_Cover image fails to load on any viewport width, THEN a solid dark placeholder (matching the page's raised surface color) SHALL be displayed at 120px × 180px on Mobile and at the full column width × proportional height on Desktop.
9. WHILE the Reduced_Motion preference is active, THE Hero_Section SHALL not auto-rotate between slides and SHALL not animate the background, but SHALL still respond to manual swipe gestures and dot-button clicks to change the active slide.

---

### Requirement 2: Latest Updates Carousel

**User Story:** As a reader, I want the Latest Updates section to show cover cards in a sideways-scrollable, auto-rotating carousel so that I can quickly browse recent updates visually rather than reading a flat list.

#### Acceptance Criteria

1. WHEN the Homepage is rendered, THE Updates_Carousel SHALL display Update_Cards in a single horizontal row that the user can scroll left and right by touch swipe or mouse drag without any page-level vertical scroll being triggered.
2. WHEN the Homepage is rendered and the Updates_Carousel contains more cards than fit in one Visible_Group, THE Updates_Carousel SHALL automatically advance to the next Visible_Group every 4 seconds.
3. WHEN a user performs a swipe, drag, or dot-button click on the Updates_Carousel, THE Updates_Carousel SHALL pause auto-rotation for 8 seconds before resuming; after the 8-second pause, auto-rotation SHALL resume from the current position.
4. WHILE the Reduced_Motion preference is active, THE Updates_Carousel SHALL not auto-rotate and SHALL still support manual scroll and swipe navigation.
5. WHEN the Homepage is rendered on a viewport width strictly below 768px, each Update_Card SHALL render at a fixed width of 120px.
6. WHEN the Homepage is rendered on a viewport width of 768px or greater, each Update_Card SHALL render at a fixed width of 160px.
7. THE Update_Card SHALL display the series cover image filling the card's full width at a 2:3 aspect ratio, with the image cropped to fill the space without distortion.
8. THE Update_Card SHALL display the series title text overlaid at the bottom of the cover image, clamped to 2 lines with an ellipsis, at a font size of 12px on Mobile and 14px on Desktop.
9. THE Update_Card SHALL display the latest chapter number as a small text badge overlaid at the top-right corner of the cover image.
10. WHEN the Updates_Carousel contains 8 or fewer Update_Cards, THE Updates_Carousel SHALL display one navigation dot per card below the strip; WHEN the count exceeds 8, dots SHALL represent Visible_Groups rather than individual cards.
11. IF a series in the latest updates has no cover image, THEN the Update_Card SHALL display a dark placeholder background at the correct card dimensions.
12. WHEN the Homepage is rendered on a viewport width strictly below 768px, THE Updates_Carousel SHALL show at least 2 full Update_Cards and a partial third card simultaneously, so that scrollability is visually apparent.
13. WHEN the Homepage is rendered on a viewport width of 768px or greater, THE Updates_Carousel SHALL show at least 4 full Update_Cards and a partial fifth card simultaneously.
14. WHEN a user taps or clicks the cover image or title area of an Update_Card, THE browser SHALL navigate to the series detail page for that series.
15. WHEN a user taps or clicks the chapter badge of an Update_Card, THE browser SHALL navigate to the chapter reader for that series at the displayed chapter number.
16. WHEN the Updates_Carousel contains a number of Update_Cards equal to or fewer than the number that fit in one Visible_Group, THE Updates_Carousel SHALL not auto-rotate and SHALL not display navigation dots.
17. THE Updates_Carousel scroll container SHALL use CSS `scroll-snap-type: x mandatory` and each Update_Card SHALL use `scroll-snap-align: start`, so that swipe and drag interactions snap cleanly to card boundaries without any JavaScript-driven scroll position correction.
18. WHEN the Homepage is rendered, THE Updates_Carousel container SHALL display a left gradient fade overlay and a right gradient fade overlay, each 48px wide, using the page background color fading to transparent, to suggest additional scrollable content beyond both edges; the overlays SHALL be rendered as CSS pseudo-elements and SHALL not intercept pointer events.
19. WHEN an Update_Card's cover image has not yet loaded, THE Update_Card SHALL display an animated shimmer placeholder (cycling between the page's raised surface color and a slightly lighter tone using a CSS `@keyframes` linear-gradient animation) at the card's full dimensions until the image loads or permanently fails.
20. WHEN the Updates_Carousel first enters the viewport, each Update_Card SHALL animate in with a staggered `fadeUp` entrance — translating from 16px below its final position to 0 with opacity going from 0 to 1 — with a 60ms delay increment per card index; WHILE the Reduced_Motion preference is active, this entrance animation SHALL be skipped entirely and cards SHALL appear at full opacity immediately.
21. WHEN a user hovers over an Update_Card on a device that supports hover, THE Update_Card SHALL scale to 1.04 and display a 0 4px 16px box-shadow using the gold accent color at 40% opacity; the transition duration SHALL be 200ms ease-out; WHILE the Reduced_Motion preference is active, the scale and shadow transition SHALL be suppressed and only a border-color change to the gold accent SHALL apply.
22. THE gap between consecutive Update_Cards in the scroll container SHALL be set using the project's spacing Design_Token `--s-3` (12px), ensuring consistent gutters without hardcoded pixel values in JavaScript.
23. THE Updates_Carousel scroll container SHALL have `overflow-x: auto` and `overflow-y: hidden` set explicitly, and the parent section SHALL have `overflow: hidden` so that no horizontal scrollbar or layout overflow propagates to the page body at any viewport width.

---

### Requirement 3: Browse by Genre Grid Redesign

**User Story:** As a reader, I want the genre section to look visually rich and easy to scan so that I can quickly identify and navigate to my preferred genre.

#### Acceptance Criteria

1. WHEN the Homepage is rendered, THE Genre_Grid SHALL display Genre_Tiles in a responsive CSS grid with the following column counts by viewport width: 2 columns below 480px, 3 columns from 480px to 767px, 4 columns from 768px to 1023px, and 5 columns at 1024px and above.
2. THE Genre_Tile SHALL display the genre name centered within the tile at a font size of 14px and semibold weight.
3. THE Genre_Tile SHALL display the following genre-specific emoji above the genre name: All → 📚, Action → ⚔️, Adventure → 🗺️, Comedy → 😂, Drama → 🎭, Fantasy → 🧙, Romance → 💕, Martial Arts → 🥋, School Life → 🏫, Sci-Fi → 🚀, Horror → 👻, Mystery → 🔍, Slice of Life → ☕, Supernatural → 👁️, Isekai → 🌀, Tragedy → 💔, Sports → 🏆, Mecha → 🤖, Historical → 🏯, Psychological → 🧠, Thriller → 🔪.
4. THE Genre_Tile SHALL have a background color matching the page's raised surface, a 1px solid border in the default border color, and a border-radius of 12px.
5. WHEN a user hovers a Genre_Tile on a device that supports hover, THE Genre_Tile's border color SHALL transition to the gold accent color and the tile SHALL shift upward by 2px; the transition duration SHALL match the project's fast transition token (which resolves to 0ms under Reduced_Motion).
6. THE Genre_Tile SHALL have a minimum rendered height of 64px to meet mobile touch target guidelines.
7. WHEN a user taps or clicks a Genre_Tile for a specific genre, THE browser SHALL navigate to `/genre/{slug}` where `{slug}` is derived by lowercasing the genre name and replacing spaces with hyphens (e.g., "Martial Arts" → `martial-arts`), consistent with the transformation in the existing `genreStrip` function.
8. WHEN the Homepage is rendered, THE Genre_Grid SHALL include an "All Genres" Genre_Tile as the first item, and tapping or clicking it SHALL navigate to `/browse`.
9. THE Genre_Grid (class `.genre-grid`) SHALL be the genre component rendered on the Homepage; the existing `.tag-row.scroll.genre-strip` component SHALL remain in the codebase and continue to be used on other pages (browse, series detail) without modification.
10. WHEN a Genre_Tile receives keyboard focus, THE Genre_Tile SHALL display a visible 2px solid gold outline with 2px offset, and this focus indicator SHALL not appear when focus is received via mouse click.
11. IF the GENRES list is empty or unavailable at render time, THEN the "Browse by Genre" section SHALL be omitted from the Homepage DOM entirely.

---

### Requirement 4: Consistent Card Sizing Across Sections

**User Story:** As a reader, I want all cover cards on the homepage to look consistently sized and proportioned so that the page feels polished and professionally designed.

#### Acceptance Criteria

1. WHEN the Homepage is rendered, THE Popular Now Card_Grid and the New Arrivals Card_Grid SHALL each use `grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))` on viewports below 480px, `minmax(160px, 1fr)` from 480px to 767px, `minmax(180px, 1fr)` from 768px to 1023px, and `minmax(200px, 1fr)` at 1024px and above — matching the existing `.card-grid` definitions already in the codebase.
2. WHEN the Homepage is rendered on any viewport width, THE card title within `.card` elements (Popular Now, New Arrivals, Continue Reading) SHALL render at 14px font size.
3. THE card title within `.card` elements SHALL be clamped to a maximum of 2 visible lines with an ellipsis, preventing any single card title from extending to 3 or more lines regardless of title length.
4. IF a cover image within a `.card` element has not loaded by the time the card enters the viewport, THEN the card SHALL display an animated shimmer placeholder (cycling between the page's raised surface color and a slightly lighter surface color) until the image successfully loads or permanently fails.
5. IF a cover image permanently fails to load, THEN the shimmer animation SHALL stop and the card SHALL display a static dark placeholder at the correct card dimensions.

---

### Requirement 5: Popular Now & New Arrivals Polish

**User Story:** As a reader, I want the Popular Now and New Arrivals sections to feel tight and well-spaced so that browsing the homepage feels fluid.

#### Acceptance Criteria

1. WHEN the Homepage is rendered, THE Popular Now section SHALL display a maximum of 12 series cards; if the data source returns more than 12, only the first 12 SHALL be rendered, and the "View all →" link SHALL remain visible to access the full list.
2. WHEN the Homepage is rendered, THE New Arrivals section SHALL display a maximum of 12 series cards; if the data source returns more than 12, only the first 12 SHALL be rendered, and the "View all →" link SHALL remain visible to access the full list.
3. WHEN the Homepage is rendered, THE section header for both Popular Now and New Arrivals SHALL render the gold left-border accent bar on the section title, consistent with the existing `.section-header` + `.section-title` component behavior.
4. WHEN the Homepage is rendered on a viewport width strictly below 768px, THE Popular Now and New Arrivals sections SHALL each have a minimum of 24px of vertical padding above and below the section content.
5. WHEN the Popular Now data source returns fewer than 4 series, THE Homepage SHALL render an empty-state component in place of the card grid, containing a prompt to visit the admin panel; no empty grid columns or ghost whitespace SHALL be visible.
6. WHEN the New Arrivals data source returns fewer than 4 series, THE Homepage SHALL render an empty-state component in place of the card grid, containing a prompt to visit the admin panel; no empty grid columns or ghost whitespace SHALL be visible.

---

### Requirement 6: Articles / Blog System

**User Story:** As a site administrator, I want to publish SEO-friendly articles (editorials, top-10 lists, announcements, upcoming release previews) directly from the admin panel, so that readers can discover and engage with curated content, and so that the site gains indexable, rankable pages on Google.

#### Acceptance Criteria

##### Storage

1. THE System SHALL store each Article as a Firestore document in a top-level `articles/` collection, using the article `slug` as the document ID.
2. THE System SHALL persist the following fields on every Article document: `slug` (string, URL-safe), `title` (string), `excerpt` (string, maximum 160 characters), `blocks` (JSON array of Content_Block objects — see criterion 3), `coverImage` (string, public URL), `category` (string — one of "recommendations", "news", "editorial", "announcements"), `tags` (array of strings), `author` (string), `publishedAt` (Firestore Timestamp), `updatedAt` (Firestore Timestamp), `published` (boolean), `views` (number), `featured` (boolean).
3. THE `blocks` field SHALL be a JSON-serialized array where each element is an object with a `type` field and type-specific data fields, as follows:
   - `{ type: "text", value: "<string — plain paragraph text, no HTML>" }`
   - `{ type: "image", url: "<public image URL>", alt: "<optional alt text>", caption: "<optional caption>" }`
   - `{ type: "hyperlink", label: "<link display text>", url: "<destination URL>", newTab: <boolean> }`
   - `{ type: "series", slug: "<series slug>" }`
   - `{ type: "chapter", seriesSlug: "<series slug>", chapterNum: <number>, label: "<optional override label>" }`
4. THE Firestore security rules SHALL permit any client to read documents in the `articles/` collection and SHALL permit writes only when `request.auth.token.admin == true`.

##### Public Routing and Views

4. WHEN a user navigates to `/articles`, THE System SHALL render the Article_Listing_Page showing all Articles where `published == true`, ordered by `publishedAt` descending.
5. WHEN the Article_Listing_Page is rendered and there are more than 12 published Articles, THE Article_Listing_Page SHALL load an additional batch of 12 Article_Cards from Firestore each time the user scrolls to the bottom of the visible list, continuing until no more published Articles remain.
6. WHEN a user navigates to `/articles/:slug`, THE System SHALL render the Article_Detail_Page for the Article whose `slug` matches the URL parameter.
7. IF no published Article exists for the requested `slug`, THEN THE Article_Detail_Page SHALL render the existing 404 Not Found view.
8. WHEN the Article_Detail_Page is rendered, THE System SHALL call `setMeta()` with the Article's `title`, `excerpt` (as the meta description), canonical URL `/articles/{slug}`, and `coverImage` (as the `og:image` value).
9. WHEN the Article_Detail_Page is rendered, THE System SHALL inject a JSON-LD `<script type="application/ld+json">` block into the document `<head>` containing an `Article` schema object with at minimum: `@type: "Article"`, `headline`, `datePublished`, `dateModified`, `image`, `author.name`, and `publisher.name`.
10. WHEN the Article_Detail_Page is rendered, THE System SHALL iterate over the Article's `blocks` array in order and render each Content_Block into the `.article-body` container using a block renderer function, as follows:
    - `text` block: rendered as a `<p>` element containing the escaped `value` string.
    - `image` block: rendered as a `<figure>` containing an `<img>` with `src=url`, `alt=alt`, `loading="lazy"`, and an optional `<figcaption>` when `caption` is non-empty.
    - `hyperlink` block: rendered as a `<a>` element with `href=url`, `rel="noopener"`, and `target="_blank"` when `newTab` is true, displaying the escaped `label` text.
    - `series` block: rendered using the existing `seriesCard()` component from `_components.js`, fetching the series data from the already-loaded series catalog; IF the series slug is not found in the catalog, THEN the block SHALL be omitted from the rendered output without error.
    - `chapter` block: rendered as a styled card showing the series cover thumbnail, series title, and a "Read Chapter {chapterNum}" call-to-action link pointing to `/read/{seriesSlug}/{chapterNum}`; the optional `label` field overrides the default "Read Chapter N" display text when present.
11. WHEN the Article_Detail_Page is rendered, THE System SHALL call `trackArticleView(slug)` after the page content has been painted; this call SHALL be non-blocking (not awaited during initial render) and SHALL be session-deduplicated so that repeated visits to the same article URL within the same browser session do not increment the counter more than once.
12. THE Article_Detail_Page SHALL display the Article's `coverImage` as a full-width hero image above the article body; IF the `coverImage` field is empty or the image fails to load, THEN the hero image area SHALL be omitted from the DOM rather than showing a broken image.

##### API Layer and Caching

13. THE System SHALL expose the following functions in `api.js`: `fetchArticles({ limitTo, category })`, `fetchArticleBySlug(slug)`, `createArticle(data)`, `updateArticle(slug, patch)`, `deleteArticle(slug)`, and `trackArticleView(slug)`; the `createArticle` and `updateArticle` functions SHALL serialize the `blocks` array to a JSON string before writing to Firestore and the `fetchArticleBySlug` function SHALL parse the stored JSON string back to an array on read.
14. WHEN `fetchArticles({ limitTo, category })` is called, THE System SHALL cache the result under a key that includes the serialized parameter values (e.g., `articles:all:${limitTo}:${category || ''}`) with a TTL of 5 minutes; a second call with the same parameters within 5 minutes SHALL return the cached result without issuing a new Firestore read.
15. WHEN `fetchArticleBySlug(slug)` is called, THE System SHALL cache the result under the key `articles:slug:{slug}` with a TTL of 2 minutes; a second call within 2 minutes SHALL return the cached result without issuing a new Firestore read.
16. WHEN `createArticle()` is called, THE System SHALL invalidate all cache entries with the prefix `articles:` so that the next `fetchArticles()` call reflects the new article; WHEN `updateArticle(slug, patch)` or `deleteArticle(slug)` is called, THE System SHALL invalidate both the `articles:` prefixed list cache entries and the per-slug cache entry `articles:slug:{slug}`.

##### Admin Panel

17. WHEN an admin opens the admin panel, THE admin panel SHALL display an "Articles" tab alongside the existing tabs (Dashboard, Series, Chapters, etc.), implemented by adding a new entry to the `TABS` object in `admin.js` and a new tab link in `admin/index.html`.
18. WHEN an admin selects the "Articles" tab, THE Article_Editor SHALL render a list view of all Articles (both published and draft), displaying each Article's `title`, `category`, `published` status, and `publishedAt` date, with action buttons for Edit, Delete, and View (opens public `/articles/{slug}` in a new tab).
19. WHEN an admin clicks "New Article" or "Edit" on an existing Article, THE Article_Editor SHALL render a metadata form containing the following fields: Title (text input), Slug (text input, auto-derived from Title by lowercasing and replacing spaces and non-alphanumeric characters with hyphens, and editable by the admin), Excerpt (textarea, maxlength 160), Cover Image URL (text input), Category (dropdown with options: "recommendations", "news", "editorial", "announcements"), Tags (text input, comma-separated), Author (text input), Published (toggle), and Featured (toggle).
20. WHEN an admin clicks "New Article" or "Edit", THE Article_Editor SHALL display the Block_Builder below the metadata form. The Block_Builder SHALL consist of: (a) an ordered list of existing Content_Blocks with a delete button on each, (b) an "Add Block" toolbar with exactly five buttons labeled "Text", "Image", "Link", "Series", and "Chapter".
21. WHEN an admin clicks the "Text" button in the Block_Builder, THE Article_Editor SHALL append a new `text` block to the block list, showing a `<textarea>` input for the paragraph text; the admin types plain text (no HTML knowledge required).
22. WHEN an admin clicks the "Image" button in the Block_Builder, THE Article_Editor SHALL append a new `image` block to the block list, showing three inputs: a URL text input (for the image URL — hotlinked from Catbox, ImgBB, or any public host), an optional Alt Text input, and an optional Caption input; a small `<img>` preview SHALL update live as the admin types a valid URL.
23. WHEN an admin clicks the "Link" button in the Block_Builder, THE Article_Editor SHALL append a new `hyperlink` block to the block list, showing three inputs: a Label text input (the displayed link text), a URL text input, and a "Open in new tab" checkbox.
24. WHEN an admin clicks the "Series" button in the Block_Builder, THE Article_Editor SHALL append a new `series` block to the block list, showing a searchable dropdown or text input that autocompletes from the existing series catalog fetched via `fetchAllSeries()`; selecting a series displays a miniature series card preview using `seriesCard()`.
25. WHEN an admin clicks the "Chapter" button in the Block_Builder, THE Article_Editor SHALL append a new `chapter` block to the block list, showing: a series selector (same autocomplete as the Series block), a chapter number input, and an optional Label override input; after the series and chapter number are entered, THE Article_Editor SHALL display a preview of the chapter card.
26. WHEN an admin hovers over a Content_Block in the Block_Builder, THE Block_Builder SHALL display up-arrow and down-arrow reorder buttons on that block; clicking the up-arrow SHALL move the block one position earlier in the array, and clicking the down-arrow SHALL move it one position later, updating the live preview immediately.
27. WHEN the admin edits any block field or reorders blocks, THE Article_Editor SHALL render a live preview of the complete article body (all blocks in order) in a read-only panel adjacent to or below the Block_Builder, using the same block renderer that the Article_Detail_Page uses.
28. WHEN an admin submits the Article form, THE System SHALL validate that `title`, `slug`, `excerpt`, `category`, and `author` are non-empty, and that the `blocks` array contains at least one block, before calling `createArticle()` or `updateArticle()`; IF any required field is empty or the block list is empty, THEN THE Article_Editor SHALL display an inline validation error for that field and SHALL not submit to Firestore.
29. WHEN an admin clicks Delete on an Article in the list view, THE Article_Editor SHALL display a confirmation dialog before calling `deleteArticle(slug)`; IF the admin confirms, THEN the Article SHALL be deleted from Firestore and removed from the list view.

##### Homepage Integration

30. WHEN the Homepage is rendered and at least one published Article exists, THE Homepage SHALL display a "Latest Articles" section below the Browse by Genre section, containing up to 3 Article_Cards; featured Articles (where `featured == true`) ordered by `publishedAt` descending SHALL fill available slots first, and any remaining slots SHALL be filled by non-featured published Articles ordered by `publishedAt` descending.
31. WHEN the Homepage is rendered and no published Articles exist, THE Homepage SHALL omit the "Latest Articles" section from the DOM entirely; no empty container, heading, or placeholder SHALL be visible.
32. THE Article_Card SHALL display: the Article's `coverImage` as an `<img>` element (or a styled CSS dark-surface placeholder element — not a broken `<img>` — if `coverImage` is absent or fails to load), `title` (clamped to 2 lines), `excerpt` (clamped to 2 lines), `category` badge, and formatted `publishedAt` date.
33. WHEN a user taps or clicks an Article_Card, THE browser SHALL navigate to `/articles/{slug}` for that Article.
