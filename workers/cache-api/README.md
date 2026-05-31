# JayaScans Cache Worker

A Cloudflare Worker that caches Firestore reads at the edge.

## Why this exists

Without this Worker, every page view hits Firestore directly. That eats the free tier (50K reads/day) at ~6,000 page views/day.

With this Worker:
- Browser → Worker (cached for 2–10 min at the edge) → Firestore (only on cache miss).
- One Firestore read serves thousands of page views.
- Free tier now lasts ~50,000 page views/day.

**This is OPTIONAL.** The site works without it. Deploy when traffic grows past ~3K page views/day.

## Endpoints

| Method | Path | Cache TTL |
|---|---|---|
| `GET` | `/api/series` | 5 min |
| `GET` | `/api/series/:slug` | 5 min |
| `GET` | `/api/chapters/:slug` | 2 min |
| `GET` | `/api/chapter/:slug/:num` | 10 min |
| `GET` | `/api/health` | — |

## Deploy

You need Wrangler installed (`npm i -g wrangler`) and a Cloudflare account.

```bash
cd workers/cache-api
wrangler deploy
```

Wrangler will give you a URL like `https://jayascans-cache.YOUR-USERNAME.workers.dev`.

## Wire it into the site

Once deployed, edit `assets/js/lib/api.js` and switch the data layer to call the Worker instead of Firestore directly. See `docs/04-deploy.md` for the exact code change.

## Custom domain

To serve from `api.jayascans.online`:

1. Cloudflare → Workers & Pages → `jayascans-cache` → Triggers → Custom Domains → Add Custom Domain.
2. Update `ALLOW_ORIGIN` in `wrangler.jsonc` if you want to lock it down (default `*`).

## Notes

- Firestore Security Rules still apply to public reads. This Worker uses unauthenticated REST so your rules **must** allow public read on `series` and `chapters` collections.
- Writes still go through the Firebase SDK directly from admin (not through this Worker). That's intentional — admin needs auth, and writes shouldn't be cached.
