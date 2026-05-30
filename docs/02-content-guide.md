# 02 — Content Guide (Daily Workflow)

How to add a new series and add chapters. This is your day-to-day workflow.

---

## Adding a new series (~3 min)

### 1. Upload the cover image to R2

1. Open Cloudflare Dashboard → R2 → your `voidscans` bucket.
2. Drag-drop the cover image (recommended: 600 × 900 px, < 200 KB, WebP or JPG).
3. Click the uploaded file → copy the public URL (e.g. `https://pub-XXXX.r2.dev/covers/solo-raven.jpg`).

> Naming convention: `covers/[slug].webp` keeps things tidy.

### 2. Open the admin

- Visit `/admin` and log in.
- Click **Series** tab → **+ New Series**.

### 3. Fill the form

| Field | Tip |
|---|---|
| **Title** | "Solo Raven" |
| **Slug** | Auto-fills from title. Keep lowercase + dashes. URL becomes `/series/solo-raven`. |
| **Cover URL** | Paste the R2 link from step 1. Live preview shows below. |
| **Type** | Manhwa / Manga / Manhua |
| **Status** | Ongoing / Completed / Hiatus / Dropped |
| **Author / Artist / Year** | Optional but improves SEO |
| **Alt Titles** | Korean / Chinese / Japanese title, comma-separated |
| **Genres** | Click to toggle. Pick 2–4. |
| **Tags** | Comma-separated. Free-form (`op-mc, regression, magic`). |
| **Description** | 2–3 paragraphs. Use line breaks (\n preserved). |
| **Featured** | Shows in hero slider on home |
| **Hot** | Shows HOT badge on cards |
| **New** | Shows NEW badge on cards |

Click **Create Series**.

### 4. Verify

- Visit `/series/solo-raven` → series page loads.
- Visit `/` → series should appear in Latest / New Arrivals.

---

## Adding a new chapter (~5 min)

### 1. Upload chapter pages to R2

For chapter 14 of Solo Raven:

1. Cloudflare R2 → bucket → New folder structure (use slashes in object names): `chapters/solo-raven/014/`.
2. Upload all pages numbered: `01.webp`, `02.webp`, `03.webp`, …
3. Each gets a public URL like `https://pub-XXXX.r2.dev/chapters/solo-raven/014/01.webp`.

> **Image format tip:** WebP at quality 80 is ~30% smaller than JPG with no visible loss. Use [Squoosh](https://squoosh.app) or `cwebp` to convert.

### 2. Open the admin

- `/admin` → **Chapters** tab.
- Select your series from the dropdown.
- Click **+ New Chapter**.

### 3. Fill the form

| Field | Tip |
|---|---|
| **Chapter Number** | Auto-incremented from the latest. |
| **Chapter Title** | Optional but appears in the URL bar and Open Graph. |
| **Page URLs** | Paste all page URLs, one per line, in order. |

The image preview grid populates as you type. Drag tiles to reorder. Click × to remove a wrong page.

Click **Publish Chapter**.

### 4. Verify

- Click the eye icon next to the new chapter row → opens `/read/solo-raven/14` in a new tab.
- The chapter loads. Reader shows progress bar, prev/next buttons, settings drawer.
- Series page now shows the new chapter at the top of the list.
- Home page updates with the new chapter in Latest Updates within 5 minutes (cache TTL).

> **Force a refresh:** Admin → Settings → Clear Cache, then reload the public site.

---

## Editing existing content

### Edit a series
1. Admin → Series → find the row → click the pencil icon.
2. Update any field. Cover preview updates live.
3. Click **Save Changes**.

### Edit a chapter
1. Admin → Chapters → select series → find chapter → pencil icon.
2. Reorder pages by dragging. Add or remove URLs.
3. Click **Save Changes**.

### Delete
- Series: pencil icon → trash icon → confirm. **All chapters cascade delete.**
- Chapter: same flow at chapter level.

---

## Image hosting fallback options

If R2 isn't set up yet, you can also paste:
- **Catbox** (`https://files.catbox.moe/abc.jpg`) — free, but content can be deleted without notice.
- **ImgBB** (`https://i.ibb.co/...`) — free, no hotlink restrictions.

Mix-and-match works fine. Long-term, consolidate on R2 for reliability.

---

## SEO tips per series

- **Title:** Include "Manhwa" or "Manga" — searchers Google "Solo Raven manhwa".
- **Description:** First sentence = the hook. First 160 chars become meta description.
- **Genres:** Pick the 2–3 most accurate. Don't keyword-stuff.
- **Cover:** 600×900, well-cropped, recognizable thumbnail.

---

## Common gotchas

- **Slug must be unique.** Admin uses slug as the document ID. If you re-use a slug, the new series will overwrite the old.
- **Don't change a slug after publishing.** It breaks bookmarks and search engine links. If you must, also `301` redirect (manual via Cloudflare Pages rules).
- **Latest chapter sort uses `latestChapterAt`.** If you backdate by manually creating a chapter with an old timestamp, it won't bubble to top of Latest Updates. That's intentional.
- **Cache TTL is 5 min.** New content takes up to 5 min to appear publicly. Use Settings → Clear Cache for instant refresh.
