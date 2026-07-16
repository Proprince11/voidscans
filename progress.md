# Voidscans Website Progress Report

## 1. What We Have Done So Far (Recently Completed)
- **Mobile Hero UI Polish**: Adjusted the mobile hero layout to eliminate empty space, fix centering and text scaling, stack the hero poster above the text, and fine-tune the poster size (clamped to 85% of container height).
- **R2 Storage Integration Setup**: Added Cloudflare R2 configurations to the worker environment (`wrangler.jsonc`), binding the `R2_BUCKET` to the `jayascans` bucket and setting up the `R2_PUBLIC_BASE` url.
- **Selective Storage Routing**: Established a storage strategy where chapter page bulk uploads safely default to `Catbox` (for DMCA safety), while cover images explicitly target the `r2` storage backend.
- **R2 Upload Fix**: Replaced `file.stream()` with `await file.arrayBuffer()` in `upload.js` to fix Cloudflare Worker compatibility.
- **Upload Error Logging**: Failover chain now collects per-backend errors and returns them in the API response.
- **Admin UI Notifications**: Upload toasts now show the specific backend name (e.g., "Cover uploaded to r2").

## 2. Latest Changes (This Session)

### Security Fix: `/api/env-test` Endpoint
- **Problem**: The `/api/env-test` endpoint was UNAUTHENTICATED and leaked `Object.keys(env)` (all environment variable names, including secrets).
- **Fix**: Added `await verifyAdmin(request)` gate and removed the `keys` field from the response. Now only authenticated admins can access it.

### Bug Fix: Cache Worker Leaking Unpublished Content
- **Problem**: The cache worker (`workers/cache-api`) did NOT include `published` in its normalization, and did NOT filter out unpublished series/chapters. Since `undefined !== false` is `true`, the client-side filter was ineffective — all drafts leaked into the public cache.
- **Fix**: Added `published: d.published !== false` to both `normalizeSeries()` and `normalizeChapter()` in the cache worker. Added `.filter(s => s.published !== false)` to the `/api/series` endpoint and `.filter(c => c.published !== false)` to the `/api/chapters/:slug` endpoint. Drafts are now properly hidden at the edge.

### Feature: Server-Side View Tracking (`POST /api/track-view`)
- **Problem**: Client-side view tracking was commented out because it required Firestore write access from the browser (vulnerable to abuse, requires Firestore rules to allow public writes on view fields).
- **Solution**: Created a new public `POST /api/track-view` endpoint in the main worker that:
  - Accepts `{ type: "series"|"chapter", slug, chapter? }` JSON body
  - Rate-limits by IP (1 view per IP per key per 60 seconds, in-memory map with eviction)
  - Uses Firestore REST `commit` API with `fieldTransforms.increment` for atomic counter bumps
  - Requires `FIREBASE_SA_TOKEN` env var (service account token stored as encrypted secret)
  - Gracefully degrades if token isn't set (returns ok but doesn't count)
  - For chapter views, also increments the parent series view count
- **Frontend changes**:
  - Rewrote `trackSeriesView()` and `trackChapterView()` in `api.js` to call the worker endpoint (no more direct Firestore writes from browser)
  - Re-enabled view tracking calls in `reader.js` and `series.js` (un-commented, now using server endpoint)
  - Added `trackSeriesView` / `trackChapterView` to respective import lists

## 3. Remaining Tasks

### Phase 1: Deploy & Verify Uploads
- `[ ]` Set `FIREBASE_SA_TOKEN` as encrypted secret: `wrangler secret put FIREBASE_SA_TOKEN`
- `[ ]` Deploy the updated main worker: `wrangler deploy`
- `[ ]` Deploy the updated cache worker: `cd workers/cache-api && wrangler deploy`
- `[ ]` Test `/api/env-test` (must pass admin auth now)
- `[ ]` Test cover upload → should go to R2, show toast
- `[ ]` Test chapter bulk upload → should go to Catbox
- `[ ]` Test `/api/track-view` → verify rate limiting and view increment

### Phase 2: Remaining Cleanup
- `[ ]` Remove `/api/env-test` endpoint entirely once R2 is confirmed working (it's a debug endpoint)
- `[ ]` Consider adding KV-based rate limiting for `/api/track-view` if in-memory map proves insufficient (Worker isolates can restart, resetting the map)
- `[ ]` Commit and push to a feature branch for review

### Phase 3: Final Testing
- `[ ]` Verify unpublished series/chapters are invisible to regular users on the live site
- `[ ]` Verify view counts increment when visiting series/chapter pages
- `[ ]` Merge to main and deploy to production
