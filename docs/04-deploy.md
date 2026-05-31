# 04 — Deploy

Step-by-step deployment to Cloudflare Pages, plus optional Cloudflare Worker and custom domain.

## Cloudflare Pages (main site)

### 1. Push code to GitHub

The repo is already on GitHub. After this rebuild, you'll have a `rebuild/premium-v3` branch. Open the PR to `main` first, then merge.

### 2. Create the Pages project

1. **[Cloudflare Dashboard](https://dash.cloudflare.com)** → Workers & Pages → **Create application** → **Pages** → **Connect to Git**.
2. Authorize Cloudflare on your GitHub account.
3. Select the `voidscans` repo (rename to `jayascans` first if you've done that on GitHub).
4. Production branch: `main`.

### 3. Build settings (no build step required)

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | *(empty)* |
| Build output directory | `/` |
| Root directory | *(empty)* |
| Environment variables | *(none needed)* |

Click **Save and Deploy**. First deploy takes ~30 seconds.

### 4. Verify the deploy

- URL: `https://jayascans.online` (custom domain) or the auto-generated `*.workers.dev` preview URL.
- Open DevTools → Network tab → check that:
  - Service worker registers (look in Application → Service Workers).
  - Manifest loads (`/manifest.webmanifest` returns 200).
  - SPA routes work: try `/series/sample-solo-raven` directly. Should not 404.
  - `_redirects` is honored (the 200 above is the proof).

### 5. Auto-deploy on push

Once configured, every push to `main` deploys in ~30 seconds. Branch pushes get preview URLs (`https://abc123.jayascans.pages.dev` or whatever Cloudflare assigns).

---

## Optional: deploy the cache Worker

Skip until you cross ~3K daily page views.

### 1. Install Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 2. Deploy

```bash
cd workers/cache-api
wrangler deploy
```

You'll see:
```
Published jayascans-cache (1.23 sec)
  https://jayascans-cache.YOUR-USERNAME.workers.dev
```

### 3. Wire it into the site

In `assets/js/lib/api.js`, swap the Firestore reads for the Worker:

```javascript
// Before
export async function fetchAllSeries({ limitTo = 200 } = {}) {
  return memoFetch(`series:all:${limitTo}`, TTL.series, async () => {
    const q = query(collection(db, 'series'), orderBy('createdAt', 'desc'), limit(limitTo));
    const snap = await getDocs(q);
    return snap.docs.map(d => normalizeSeries(d.data(), d.id));
  });
}

// After
const API_BASE = 'https://jayascans-cache.YOUR-USERNAME.workers.dev';

export async function fetchAllSeries({ limitTo = 200 } = {}) {
  return memoFetch(`series:all:${limitTo}`, TTL.series, async () => {
    const res = await fetch(`${API_BASE}/api/series`);
    if (!res.ok) throw new Error('API failed');
    const arr = await res.json();
    return arr.slice(0, limitTo);
  });
}
```

Apply the same pattern to `fetchSeriesBySlug`, `fetchChapters`, `fetchChapter`. Push, redeploy.

### 4. Custom domain for the Worker (optional)

1. Cloudflare Dashboard → Workers & Pages → `jayascans-cache` → Triggers → Custom Domains.
2. Add `api.jayascans.online` (or your real domain).
3. Update `API_BASE` in `api.js`.

---

## Custom domain for the main site

You already own **jayascans.online** — point it at the Pages project:

1. Cloudflare Dashboard → Pages project → Custom Domains → **Add custom domain** → enter `jayascans.online`.
2. Cloudflare auto-creates the DNS records and provisions SSL (~1–15 min).
3. Add `www.jayascans.online` too if you want www → root redirect.

### Free fallback options (if jayascans.online ever lapses)
- The auto-generated `*.workers.dev` URL — instant, no setup, free forever.
- `*.is-a.dev` — submit GitHub PR, takes 1–3 days.
- `*.eu.org` — apply at nic.eu.org, 2–6 weeks.

---

## Environment variables

Currently the site needs no env vars (all config in `firebase.js`).

If you later add a Turnstile site key:
- Cloudflare Pages → Settings → Environment variables → add `TURNSTILE_SITE_KEY`.
- Reference it in code via `process.env` (only available in Pages Functions, not in static HTML).
- For static HTML, you'd inline it via a build step or hardcode (it's a public key — that's fine).

---

## Rollback

If a deploy breaks production:
1. Cloudflare Pages → your project → Deployments tab.
2. Find the last good deploy → click **Retry deployment** or **Rollback**.
3. Old version restored in ~30 seconds.

---

## Health check after deploy

Quick smoke test:
```
✓ /                         loads home, hero rotates
✓ /browse                   filters work
✓ /series/[your-slug]       series page populates
✓ /read/[slug]/1            reader loads, swipe works
✓ /admin                    login, dashboard renders
✓ /404page                  404 page (router catches *)
✓ DevTools → Application:   service worker active, manifest valid
✓ Lighthouse mobile score:  > 85 across the board
```
