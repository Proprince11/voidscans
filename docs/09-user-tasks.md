# 09 — User Tasks (What You Need To Do)

This is **the** doc to read first. Everything in this list requires your accounts or a real-world action — Kiro can't do these for you. Each task has copy-paste commands and screenshot-level steps.

> **Total time:** ~45 minutes for the must-do block. Optional polish tasks come after.

---

## ✅ MUST DO — Site won't work safely without these

### Task 1 — Lock down Firestore Security Rules (5 min) 🔴 CRITICAL

**Why:** Right now, anyone could wipe your entire database from any browser console. Lock it down before you deploy.

1. Open **[Firestore Rules](https://console.firebase.google.com/project/voidscans-6c66b/firestore/rules)**
2. Replace the entire contents with the rules below
3. Click **Publish**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // -------- Public reads, admin-only writes --------
    match /series/{seriesId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.admin == true;

      // Comments subcollection: anyone can read + create (with limits), admin can delete
      match /comments/{commentId} {
        allow read: if true;
        allow create: if request.resource.data.text is string
                      && request.resource.data.text.size() >= 2
                      && request.resource.data.text.size() <= 1000;
        allow update: if false;  // Only likes via increment? handled below.
        allow delete: if request.auth != null && request.auth.token.admin == true;
      }
    }

    match /chapters/{chapterId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }

    // -------- Reactions: anyone can increment --------
    match /reactions/{seriesId} {
      allow read: if true;
      allow write: if true;
    }

    // -------- Ratings: anyone can submit --------
    match /ratings/{seriesId} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

> **Note:** "Anyone can write reactions/ratings" sounds risky but is the standard pattern for free anonymous engagement. The frontend rate-limits via localStorage. For production-grade rate limiting, deploy the Cloudflare Worker (Task 7).

**Verify:** Sign out, visit your site, try `db.collection('series').doc('test').delete()` in console. You should get a permission error.

---

### Task 2 — Create your admin account & grant claim (10 min) 🔴 CRITICAL

**Why:** The admin panel uses a custom claim. Without this, you cannot log in to `/admin` even with the correct password.

#### 2a) Create the auth user

1. Open **[Firebase Console → Authentication → Users](https://console.firebase.google.com/project/voidscans-6c66b/authentication/users)**
2. Click **Add user**
3. Enter your email + a strong password
4. Save

#### 2b) Generate a service account key

1. Open **[Service Accounts](https://console.firebase.google.com/project/voidscans-6c66b/settings/serviceaccounts/adminsdk)**
2. Click **Generate new private key** → **Generate key**
3. A JSON file downloads. Move it to your computer's `voidscans/scripts/service-account.json`

> ⚠️ **NEVER commit this file.** It's already in `.gitignore`. If you accidentally push it, regenerate immediately.

#### 2c) Run the grant-admin script

```bash
cd scripts
npm install                                  # one-time
node grant-admin.mjs your-email@example.com
```

You should see:
```
Found user: your-email@example.com (uid: abc123…)
✓ Granted admin claim to your-email@example.com
Next step: Sign out and sign back in at /admin
```

**Verify:** Visit `/admin` → log in. You should see the dashboard, not the "Not Authorized" screen.

---

### Task 3 — Set up Cloudflare R2 for image hosting (15 min) 🟡 RECOMMENDED

**Why:** Catbox/ImgBB die or get takedowns. R2 is free for 10 GB, on Cloudflare's CDN, and you control it.

1. Sign in to **[Cloudflare Dashboard](https://dash.cloudflare.com)** (create a free account if needed)
2. Go to **R2 Object Storage** in the left sidebar
3. Click **Create bucket**
4. Name: `voidscans` · Location hint: closest to your audience (e.g. APAC)
5. Open the bucket → **Settings** tab → **Public Access** → click **Allow Access** under "R2.dev subdomain"
6. Confirm: type the bucket name. R2 gives you a public URL like `https://pub-XXXXXX.r2.dev`
7. Test: drag-drop any image into the bucket. Open `https://pub-XXXXXX.r2.dev/your-image.jpg` in a browser. You should see it.

**How to use:**
- Upload covers: drag-drop into the R2 bucket dashboard.
- Use the resulting URL in the admin "Cover Image URL" field.
- For chapter pages, upload all images, then paste their URLs (one per line) into the admin chapter form.

**Pro tip:** Use a folder structure like `covers/solo-raven.jpg`, `chapters/solo-raven/014/01.webp`. R2 has no folders technically, but URL paths simulate them.

---

### Task 4 — Deploy to Cloudflare Pages (10 min) 🔴 CRITICAL

**Why:** This is how the site goes live for free.

1. Push your repo to GitHub (the `rebuild/premium-v3` branch will be PR'd to `main`)
2. **[Cloudflare Pages → Create](https://dash.cloudflare.com/?to=/:account/pages)** → **Connect to Git**
3. Authorize Cloudflare to access your GitHub
4. Select the `Proprince11/voidscans` repo
5. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/`
   - **Root directory:** *(leave empty)*
6. Click **Save and Deploy**

In ~30 seconds you'll have a URL like `https://voidscans.pages.dev`. The site is live.

**Subsequent deploys:** Every push to `main` auto-deploys.

---

### Task 5 — Get a free domain (Optional, 15 min)

You have several options. Pick one:

#### Option A — `voidscans.pages.dev` (instant, looks "less premium")
Already done by Task 4. No action needed.

#### Option B — `voidscans.is-a.dev` (1–3 days, looks clean)

1. Fork **https://github.com/is-a-dev/register**
2. Add a file: `domains/voidscans.json` with:
   ```json
   {
     "owner": {
       "username": "Proprince11",
       "email": "your@email.com"
     },
     "record": {
       "CNAME": "voidscans.pages.dev"
     }
   }
   ```
3. Open a PR on the upstream repo. Wait 1–3 days for review.
4. Once merged, add `voidscans.is-a.dev` as a Custom Domain in Cloudflare Pages → Settings → Custom Domains.

#### Option C — `voidscans.eu.org` (free, slow, very stable)

Apply at **[nic.eu.org](https://nic.eu.org)**. Approval takes 2–6 weeks. Same CNAME pointer as Option B.

#### Option D — Real `.com`/.xyz` (when you have money — `~$1–$10/year`)

Buy at **[Porkbun](https://porkbun.com)**, then add as Custom Domain in Cloudflare Pages.

> **My recommendation:** Use Option A immediately, then submit Option B. Switch to Option D when you start earning.

---

## 🟢 NICE TO HAVE — Do these as you grow

### Task 6 — Cloudflare Turnstile for comment spam protection (5 min)

**Why:** Anonymous comments will get spam-bombed within days. Turnstile is a free, invisible CAPTCHA from Cloudflare.

1. Cloudflare Dashboard → **Turnstile** → **Add site**
2. Name: `voidscans`
3. Domain: `voidscans.pages.dev` (and `voidscans.is-a.dev` if applicable)
4. Widget mode: **Managed**
5. You get a **Site Key** and a **Secret Key**

Wire-up in code is part of v3.1 roadmap. For now, the 60-second rate limit + min/max length checks slow most spam. If you start getting hit, ping Kiro to wire up Turnstile.

---

### Task 7 — Deploy the Firestore Cache Worker (10 min)

**Why:** When traffic exceeds ~3,000 page views/day, you'll hit Firestore's 50K reads/day free limit. The cache Worker fixes this.

```bash
cd workers/cache-api
npm i -g wrangler          # one time, if you don't have it
wrangler login             # opens browser to authenticate
wrangler deploy
```

Wrangler prints a URL like `https://voidscans-cache.YOUR-USERNAME.workers.dev`.

**Wire it into the site:**
Edit `assets/js/lib/api.js`. Replace the `fetchAllSeries` body with:

```javascript
const res = await fetch('https://voidscans-cache.YOUR-USERNAME.workers.dev/api/series');
return res.json();
```

(Same pattern for `fetchSeriesBySlug`, `fetchChapters`, `fetchChapter`.) Or use a custom domain like `api.voidscans.pages.dev`.

---

### Task 8 — Apply for ad networks (10 min, when you have ~1K daily visitors)

Realistic ad ladder for unlicensed manga:

| Network | Apply at | Notes |
|---|---|---|
| **Adsterra** | adsterra.com | Manga-friendly, accept fast |
| **HilltopAds** | hilltopads.com | Same |
| **PopAds** | popads.net | Popunders only — annoying, but pay well |
| **PropellerAds** | propellerads.com | Mid-tier |

Don't apply until you have at least **1,000 page views/day** for a week. Networks often reject sub-traffic sites.

---

### Task 9 — Weekly backups (1 min, set once)

Add a cron entry on your machine to run weekly:

```bash
# Crontab: every Sunday at 3 AM
0 3 * * 0  cd /path/to/voidscans/scripts && node backup-firestore.mjs
```

This dumps your entire Firestore to `backups/firestore-DATE.json`. Push that file to a private second repo for redundancy.

---

### Task 10 — Submit sitemap to Google (5 min, after first content)

Once you have 5+ series live:

1. **[Google Search Console](https://search.google.com/search-console)** → Add property → Domain verification (Cloudflare DNS makes this 1-click)
2. Add a sitemap. v3 doesn't auto-generate one yet — for now, manually create `sitemap.xml` in repo root with each `/series/SLUG` URL.

---

## 🔵 LATER (Phase 2 features that need user setup)

### When ready to enable user accounts (sign-up / library sync)

1. Firebase Console → **Authentication** → **Sign-in method** → enable **Email/Password** and (optional) **Google**
2. Phase 2 user views are stubbed in `assets/js/lib/auth.js`. Sign-in UI is not yet rendered on `/library` — when you want it, ping Kiro.

### When ready to enable push notifications

1. Firebase Console → **Cloud Messaging** → enable
2. Generate a **Web Push certificate (VAPID key)**
3. Wire-up will be in v3.1 — talk to Kiro.

---

## 🟣 If something breaks

See **[docs/05-troubleshooting.md](./05-troubleshooting.md)** for common issues:
- "I can't log in to admin"
- "Series page is blank"
- "Images don't load"
- "Service worker won't update"
- "Firestore quota exceeded"

---

## Summary checklist

```
🔴 MUST DO (now):
  [ ] Task 1 — Firestore security rules
  [ ] Task 2 — Create admin user + grant claim
  [ ] Task 4 — Deploy to Cloudflare Pages

🟡 STRONGLY RECOMMENDED (this week):
  [ ] Task 3 — Cloudflare R2 bucket
  [ ] Task 5 — Free domain (is-a.dev or .pages.dev)

🟢 WHEN YOU GROW:
  [ ] Task 7 — Cache Worker (~3K daily views)
  [ ] Task 6 — Turnstile (when comments get spammed)
  [ ] Task 8 — Ad networks (~1K daily views)
  [ ] Task 9 — Weekly backups (any time)
  [ ] Task 10 — Search Console (after 5+ series)
```

That's everything you need. Ping Kiro any time something doesn't work as documented — bugs in this guide are Kiro's bugs, not yours.
