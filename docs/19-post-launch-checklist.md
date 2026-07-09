# 19 — Post-Launch Checklist

Everything YOU (the human) need to do manually. Code changes are already done — this is all external platform actions.

---

## ✅ Already Done (by Kiro / Antigravity)

- [x] Privacy Policy page (`/privacy`)
- [x] Terms of Service page (`/terms`)
- [x] About page (`/about`)
- [x] Contact page (`/contact`)
- [x] DMCA page (`/dmca`) — was only a markdown file, now a proper routed page
- [x] Footer updated with all legal links (Privacy, Terms, About, Contact, DMCA)
- [x] Footer updated with social link icons (Discord, Twitter/X, Telegram) — auto-renders when you fill `site.config.js`
- [x] Cookie/privacy consent banner (auto-dismissed, localStorage-persisted)
- [x] OG image meta tags updated to reference `/assets/images/og-default.png`
- [x] **OG share image generated & committed** → `assets/images/og-default.png` ✅ (done by Antigravity)
- [x] Google Search Console verification meta tag placeholder added to `index.html`
- [x] Cloudflare Analytics instruction comment added
- [x] Routes registered for all new pages
- [x] CSS for legal pages, about, contact, footer social icons, cookie banner
- [x] **🔐 JWT security vulnerability patched** → `workers/main/src/index.js` now verifies RS256 signatures via Firebase public keys — forged admin tokens are no longer possible ✅ (done by Antigravity)

---

## 🔴 Do RIGHT NOW (15–30 min total)

### Step 1: Cloudflare Web Analytics Token

| | |
|---|---|
| **Where** | https://dash.cloudflare.com → select your site → Analytics & Logs → Web Analytics |
| **What** | Click "Add Site" or find your existing site. Copy the token (a short string like `abcdef1234567890`) |
| **Then** | Open `index.html`, find the line `data-cf-beacon='{"token": ""}'` → paste your token between the quotes |
| **Push** | Commit & push to deploy |

---

### Step 2: Google Search Console

| | |
|---|---|
| **Where** | https://search.google.com/search-console |
| **What** | |

1. Click **"Add property"** → choose **"URL prefix"** → enter `https://jayascans.online`
2. Choose verification method: **"HTML tag"**
   - Google will give you a meta tag like: `<meta name="google-site-verification" content="abc123xyz">`
   - Open `index.html`, find the commented-out line `<!-- <meta name="google-site-verification" ...> -->`
   - Uncomment it and paste your actual content value
   - Push to deploy, then click Verify in Search Console
3. Go to **Sitemaps** in the left menu → enter `https://jayascans.online/sitemap.xml` → Submit
4. Go to **URL Inspection** → paste `https://jayascans.online/` → click **"Request Indexing"**
5. Repeat for:
   - `https://jayascans.online/browse`
   - `https://jayascans.online/series/the-apocalypse-is-here`
   - `https://jayascans.online/series/hero-x-demon-empress`
   - `https://jayascans.online/series/lookism`

---

### Step 3: Bing Webmaster Tools

| | |
|---|---|
| **Where** | https://www.bing.com/webmasters |
| **What** | |

1. Sign in (use your Microsoft account)
2. Click **"Add Site"** → enter `https://jayascans.online`
3. Choose verification: **"Import from Google Search Console"** (easiest — one click)
4. Or use DNS TXT record (add via Cloudflare DNS)
5. Go to **Sitemaps** → Submit `https://jayascans.online/sitemap.xml`

---

### ~~Step 4: Create OG Share Image~~ ✅ DONE

> **Completed by Antigravity.** The OG image has been generated and committed to `assets/images/og-default.png`. It shows the JAYASCANS branding on a dark premium background with manga-style artwork. No further action needed — just push to deploy.

---

### Step 5: Set Up Domain Emails

| | |
|---|---|
| **Where** | https://dash.cloudflare.com → your domain → Email → Email Routing |
| **What** | |

1. Click **"Email Routing"** → Enable it
2. Click **"Create address"**:
   - Custom address: `contact` → Routes to: your personal email (e.g. Gmail)
   - Click Save
3. Create another:
   - Custom address: `dmca` → Routes to: your personal email
   - Click Save
4. Cloudflare will add the required MX/TXT DNS records automatically
5. Test: send an email to `contact@jayascans.online` from another account — check it arrives

---

### Step 6: Fill Social Links

| | |
|---|---|
| **Where** | `assets/js/lib/site.config.js` in your repo |
| **What** | Fill in your social URLs |

```js
social: {
  discord: 'https://discord.gg/YOUR_INVITE_CODE',
  telegram: '',  // leave empty if not using
  twitter: 'https://x.com/YOUR_HANDLE'
}
```

The footer will automatically render the icons once these have values. Push to deploy.

---

## 🟡 Do This Week

### Step 7: Create Discord Server

| | |
|---|---|
| **Where** | https://discord.com (or the app) |
| **What** | |

1. Click the + button → "Create My Own" → "For a community"
2. Name: "JayaScans"
3. Create channels:
   - `#announcements` (post new chapter releases)
   - `#new-chapters` (auto-posts via Discord webhook — already built into your admin)
   - `#general` (community chat)
   - `#suggestions` (reader feedback)
   - `#bug-reports` (issues with the site)
4. Server Settings → Enable Community (gets you features like welcome screen)
5. Create a permanent invite link: Server Settings → Invites → Create (set to never expire)
6. Copy the invite link → paste into `site.config.js` → `social.discord`
7. Set up the webhook for auto-posts:
   - In `#new-chapters` channel → Edit Channel → Integrations → Webhooks → New Webhook
   - Copy the webhook URL
   - Go to your JayaScans admin panel → Settings → Integrations → Discord
   - Paste the webhook URL there, enable it

---

### Step 8: Create Twitter/X Account

| | |
|---|---|
| **Where** | https://x.com/signup |
| **What** | |

1. Create account with handle like `@JayaScans`
2. Set profile picture (your logo), header (can use the OG image)
3. Bio: "Read manhwa, manga & manhua online free. 📖 jayascans.online"
4. Copy your profile URL → paste into `site.config.js` → `social.twitter`

---

### Step 9: Rename GitHub Repo

| | |
|---|---|
| **Where** | https://github.com/Proprince11/voidscans/settings |
| **What** | |

1. Scroll to **"Repository name"**
2. Change `voidscans` → `jayascans`
3. Click Rename
4. GitHub auto-redirects old URLs — nothing will break
5. In your local repo: `git remote set-url origin https://github.com/Proprince11/jayascans.git`

---

### Step 10: Uptime Monitoring

| | |
|---|---|
| **Where** | https://uptimerobot.com (free tier) |
| **What** | |

1. Create free account
2. Add New Monitor:
   - Monitor Type: HTTP(s)
   - URL: `https://jayascans.online`
   - Monitoring Interval: 5 minutes
3. Add alert contact (your email)
4. Optionally add a second monitor for `https://jayascans.online/browse`

---

### Step 11: Test Everything

Open your site and manually check:

| Check | URL | Expected |
|-------|-----|----------|
| Home loads | `/` | Hero slider, latest updates, genres |
| Browse works | `/browse` | Grid of series, filters |
| Search works | `/search` | Type a series name, results appear |
| Series page | `/series/lookism` | Cover, description, chapters |
| Reader | `/read/lookism/1` | Pages load, navigation works |
| Library | `/library` | Shows bookmarks (empty state if none) |
| Privacy Policy | `/privacy` | Full policy renders |
| Terms | `/terms` | Full terms render |
| About | `/about` | About page with features grid |
| Contact | `/contact` | Contact cards render |
| DMCA | `/dmca` | DMCA policy renders |
| 404 | `/anything-random` | Styled 404 page |
| Mobile | (use phone) | Bottom nav, menu drawer work |
| Footer links | (scroll down) | All 5 info links work |
| Cookie banner | (clear localStorage) | Banner appears, dismiss works |

Browsers to test: Chrome, Firefox, Edge (desktop) + Chrome Android + Safari iOS

---

### Step 12: PageSpeed Check

| | |
|---|---|
| **Where** | https://pagespeed.web.dev |
| **What** | |

1. Enter `https://jayascans.online`
2. Run both Mobile and Desktop analysis
3. Target scores: 90+ Performance, 90+ SEO, 90+ Best Practices
4. Common issues to look for:
   - Large hero images (consider compressing or using WebP)
   - External image hosts (catbox.moe) may be slow
   - If LCP > 2.5s on mobile, the hero image is likely the bottleneck

---

## 🟢 Do When Ready (Optional)

### Step 13: Google Analytics (GA4)

Only if you want more detailed analytics than Cloudflare provides.

| | |
|---|---|
| **Where** | https://analytics.google.com |
| **What** | Create a GA4 property, get measurement ID (like `G-XXXXXXXXXX`) |

If you want this, tell me the measurement ID and I'll add the script to `index.html`.

---

## 💰 Monetization: Adding Ads (HilltopAds, Ezoic, Google AdSense)

Your site already has a complete ad infrastructure built in. The admin panel (Settings → Ad Slots) lets you paste any ad network's code snippet into 4 placement slots without touching code. Here's how to set up each network:

---

### Option A: HilltopAds (RECOMMENDED FIRST — easy approval, accepts manga sites)

**Why first:** Fast approval (1-2 days), no traffic minimum, accepts entertainment/manga niche. Best for starting out.

**Requirements:**
- A live website (you have this ✅)
- Valid content on the site ✅
- No minimum traffic required

**Step-by-step:**

| Step | What to Do | Where |
|------|-----------|-------|
| 1 | Go to HilltopAds publisher signup | https://hilltopads.com/signup |
| 2 | Choose "Publisher" role, fill your email + password | Signup page |
| 3 | Add your website URL: `jayascans.online` | Dashboard → Sites → Add Site |
| 4 | Wait for approval (usually 1-2 business days) | They'll email you |
| 5 | Once approved: go to "Ad Zones" → "Create Ad Zone" | Dashboard → Ad Zones |
| 6 | Create a **Banner 728×90** zone (for header slot) | Set zone name: "Header Banner" |
| 7 | Create a **Banner 300×250** zone (for mid-chapter slot) | Set zone name: "Mid-Chapter" |
| 8 | Create a **Banner 728×90** zone (for footer slot) | Set zone name: "Footer Banner" |
| 9 | (Optional) Create a **Popunder** zone — earns more but may annoy users | Only add this after you have steady traffic |
| 10 | Copy each zone's ad code (HTML/JS snippet they give you) | Click "Get Code" next to each zone |
| 11 | Go to your JayaScans admin panel → Settings | https://jayascans.online/admin → Settings |
| 12 | Scroll to "Ad slots" section | |
| 13 | Enable "Master toggle" checkbox | |
| 14 | Paste the **Header** zone code into "Header" textarea, enable its toggle | |
| 15 | Paste the **Mid-chapter** zone code into "Mid-chapter" textarea, enable its toggle | |
| 16 | Paste the **Footer** zone code into "Footer" textarea, enable its toggle | |
| 17 | Click "💾 Save All Settings" | |
| 18 | Open your live site in another tab — ads should appear within seconds | |

**Example HilltopAds banner code looks like:**
```html
<script src="//example.hilltopads.com/v3/your-zone-id.js" async></script>
```

**Earnings estimate:**
- ~1,000 views/day → $5–$20/month
- ~10,000 views/day → $80–$200/month
- ~100,000 views/day → $500–$1,500/month

**Tips:**
- Start with banners only (not popunders) — they don't annoy readers
- The mid-chapter slot (between pages 5 & 6 in the reader) gets the most views
- Don't add popunders until you have 5K+ daily visitors and can afford to lose some

---

### Option B: Google AdSense (HIGH CPM but may reject manga sites)

**⚠️ IMPORTANT WARNING:** AdSense explicitly prohibits content that infringes copyright. Scanlation/fan-translation sites are frequently rejected. A rejection can flag your Google account. Only apply if:
- You have mostly licensed/original content, OR
- You're willing to risk the rejection (you can reapply after 30 days)

**Requirements:**
- Must be 18+ years old
- Site must be live for at least 1-3 months
- At least 15-20 pages of content (you have this ✅)
- Privacy Policy page ✅ (you now have this)
- About page ✅
- Contact info ✅
- Original/unique content (this is where manga sites get rejected)
- Mobile-friendly ✅
- SSL/HTTPS ✅

**Step-by-step:**

| Step | What to Do | Where |
|------|-----------|-------|
| 1 | Go to AdSense | https://adsense.google.com |
| 2 | Sign in with your Google account | |
| 3 | Click "Get Started" → enter `jayascans.online` | |
| 4 | Choose your country, accept terms | |
| 5 | Google gives you a verification code snippet like: | |
| | `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXX" crossorigin="anonymous"></script>` | |
| 6 | Open `index.html` in your repo | Your code editor |
| 7 | Paste it in `<head>` (after the fonts, before `</head>`) | |
| 8 | Push to deploy | |
| 9 | Go back to AdSense → click "Verify" | |
| 10 | Wait for review (2-14 days, sometimes up to 4 weeks) | |
| 11 | If APPROVED: go to Ads → By ad unit → Create new ad unit | |
| 12 | Create a "Display ad" unit (responsive) → Copy the code | |
| 13 | Go to JayaScans admin panel → Settings → Ad slots | |
| 14 | Enable master toggle, paste code into each slot you want | |
| 15 | Click Save | |

**If REJECTED:** Don't worry. Use HilltopAds instead. You can reapply to AdSense after 30 days once you've addressed their feedback.

**Example AdSense ad unit code:**
```html
<ins class="adsbygoogle"
     style="display:block"
     data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
     data-ad-slot="1234567890"
     data-ad-format="auto"
     data-full-width-responsive="true"></ins>
<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
```

**Note about CSP:** Your `_headers` file already includes `pagead2.googlesyndication.com` and `googletagservices.com` in the Content-Security-Policy, so AdSense scripts will work without any header changes.

---

### Option C: Ezoic (PREMIUM — highest earnings, but strict requirements)

**⚠️ IMPORTANT:** Ezoic now requires **250,000+ monthly active users** to join their main program. They have an "Incubator" program for smaller sites, but it's competitive. Same copyright concerns as AdSense apply.

**Requirements:**
- 250,000+ monthly users (main program) OR promising growth metrics (Incubator)
- Must be approved by Google Ad Manager (Ezoic handles this)
- Original content, not infringing copyright
- Privacy Policy ✅, good navigation ✅, mobile-friendly ✅
- More than 15 articles of 500+ words

**Step-by-step (when you qualify):**

| Step | What to Do | Where |
|------|-----------|-------|
| 1 | Go to Ezoic | https://www.ezoic.com → Get Started |
| 2 | Enter your website URL: `jayascans.online` | |
| 3 | Create account, verify email | |
| 4 | Choose integration method: **Cloudflare** (easiest for you) | |
| 5 | Ezoic will ask you to add their Cloudflare Worker or DNS integration | Follow their wizard |
| 6 | Wait for site review (3-7 days) | |
| 7 | If approved: Ezoic's AI automatically places ads for optimal revenue | |
| 8 | You can configure ad density, exclude the reader page, etc. in their dashboard | |

**Ezoic via Cloudflare integration:**
- Since you're already on Cloudflare, Ezoic can integrate as a Cloudflare app or Worker
- They inject ads server-side (better performance than client-side scripts)
- Their AI tests thousands of ad combinations to maximize revenue

**Earnings estimate (if you qualify):**
- $15-$30 RPM (revenue per 1000 pageviews) — much higher than HilltopAds
- 100K pageviews/month → $1,500–$3,000/month

---

### Recommended Strategy (in order)

```
NOW (any traffic level):
  → Sign up for HilltopAds
  → Add banner ads to header + mid-chapter + footer
  → Expected: $5-50/month depending on traffic

AFTER 30 DAYS (if you want to try):
  → Apply to Google AdSense
  → If approved, replace HilltopAds slots (higher CPM)
  → If rejected, stick with HilltopAds

WHEN YOU HIT 250K MONTHLY USERS:
  → Apply to Ezoic
  → Their AI-driven optimization will 3-5x your revenue vs manual ads
  → Expected: $1,500-5,000+/month
```

---

### How Ad Slots Work in Your Admin Panel (already built)

Your site has 4 ad placement slots. Here's where each appears:

| Slot | Location on Site | Best Ad Size |
|------|------------------|-------------|
| **Header** | Top of every page, below navbar | 728×90 leaderboard (responsive) |
| **Footer** | Bottom of every page, above footer | 728×90 leaderboard (responsive) |
| **Mid-chapter** | Between pages 5 and 6 in the reader | 300×250 or responsive |
| **Sidebar** | Browse/series pages (desktop only) | 300×250 |

**To add/change ads:**
1. Go to `https://jayascans.online/admin`
2. Sign in → Settings tab
3. Scroll to "Ad slots" section
4. Enable the master toggle
5. Enable individual slot toggles
6. Paste ad code into each textarea
7. Click "Save All Settings"
8. Ads appear instantly on the live site (no deploy needed!)

**To disable all ads instantly:**
- Uncheck the "Master toggle" → Save → all ads disappear immediately

---

### Important Notes

- **Don't add ads before you have readers.** Ads with 0 impressions earn nothing and slow your site. Wait until you have at least ~500 daily visitors.
- **Never put ads inside the manga page flow** (between page images). Your mid-chapter slot is between pages 5 & 6 which is acceptable, but don't add more.
- **Avoid aggressive popunders on day 1.** They earn more per impression but drive readers away. Test them only after you have a loyal audience.
- **Keep Lighthouse performance green.** Your ad scripts load via the admin panel (client-side injection), which means they don't block initial page load. But heavy ad scripts can still hurt runtime performance — monitor PageSpeed after adding ads.
- **Ad blockers:** ~30-40% of manga readers use ad blockers. Don't use aggressive anti-adblock walls — they kill retention. Consider a polite "please whitelist us" banner instead (Phase 3 in your roadmap).

---

### Step 14: AdSense Application (summary)

**Requirements before applying:**
- ✅ Privacy Policy page (done)
- ✅ About page (done)
- ✅ Contact info (done)
- Site must be live for 1-3 months
- Need at least 15-20 pages of content
- Original content preferred

| | |
|---|---|
| **Where** | https://adsense.google.com |
| **When** | After 1-2 months of consistent content + traffic |
| **What** | Sign up, add your site, paste the verification script (see full guide above) |

Your admin panel already has ad slot infrastructure built in. Once approved, paste codes into admin Settings → Ad Slots.

---

### Step 15: HilltopAds (can do NOW)

| | |
|---|---|
| **Where** | https://hilltopads.com/signup |
| **When** | Immediately — no traffic minimum |
| **What** | Sign up as Publisher, add site, wait for approval, create ad zones, paste codes into your admin panel |

See the full step-by-step in the "Monetization" section above.

---

## Summary

| # | Task | Time | Platform |
|---|------|------|----------|
| 1 | CF Analytics token | 2 min | Cloudflare Dashboard |
| 2 | Google Search Console | 10 min | search.google.com |
| 3 | Bing Webmaster Tools | 5 min | bing.com/webmasters |
| 4 | OG share image | 15 min | Canva/Figma |
| 5 | Domain emails | 5 min | Cloudflare Email Routing |
| 6 | Social links in config | 2 min | Your code editor |
| 7 | Discord server | 15 min | Discord |
| 8 | Twitter/X account | 5 min | x.com |
| 9 | Rename GitHub repo | 1 min | GitHub Settings |
| 10 | Uptime monitoring | 3 min | UptimeRobot |
| 11 | Test everything | 20 min | Browser |
| 12 | PageSpeed check | 5 min | pagespeed.web.dev |
| 13 | GA4 (optional) | 5 min | analytics.google.com |
| 14 | AdSense (when ready) | 10 min | adsense.google.com |
| 15 | HilltopAds (NOW) | 10 min | hilltopads.com |

**Total estimated time: ~2 hours** (spread across a day or two is fine)
