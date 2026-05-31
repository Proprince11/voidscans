# 15 — Admin Settings, Monetization & Integrations

This doc covers the new **admin Settings tab** that ships in v3.5.0 and explains all the toggles + how to wire them up.

---

## Overview

A single Firestore document at **`/site/settings`** holds all admin-editable site config. The public site reads it on boot, caches in `localStorage` for instant cold loads, and listens for real-time updates so admin saves apply across all open tabs without a reload.

Admin Settings tab fields map 1:1 to sub-objects in this doc:

```
site/settings/
├── branding/         # Logo, site name, tagline
├── monetization/
│   ├── kofi/         # Support widget on chapter pages
│   ├── ads/          # Header / footer / mid-chapter / sidebar slots
│   └── payment/      # Stripe / PayPal public keys
├── integrations/
│   └── discord/      # Webhook to ping a channel on chapter publish
├── theme/            # Default theme + user-override toggle
└── features/         # Master toggles (kofi, ads, reports, comments, ratings, theme switcher)
```

Defaults live in `assets/js/lib/settings.js` → `DEFAULT_SETTINGS`. Anything missing from Firestore falls back to a default, so the public site never breaks even if the doc is empty.

---

## Required Firestore Security Rules

Add these to **Firestore → Rules** before launching:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ===== SITE SETTINGS =====
    // Anyone can read (so the public site can load theme/logo/ads).
    // Only admins can write.
    match /site/settings {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }

    // ===== USER REPORTS =====
    // Anyone can submit a report (rate-limited per IP via Cloudflare).
    // Required fields validated server-side via field check.
    // Only admins can read / update / delete.
    match /reports/{reportId} {
      allow create: if
        request.resource.data.keys().hasAll(['seriesSlug', 'reason', 'status', 'createdAt']) &&
        request.resource.data.reason in ['broken_image', 'wrong_chapter', 'bad_translation', 'spam_comment', 'other'] &&
        request.resource.data.status == 'open' &&
        request.resource.data.details is string &&
        request.resource.data.details.size() <= 1000 &&
        request.resource.data.seriesSlug is string &&
        request.resource.data.seriesSlug.size() <= 200;
      allow read, update, delete: if request.auth != null && request.auth.token.admin == true;
    }

    // ===== Existing rules below — keep your current ones for series, chapters, etc. =====
    // (Don't paste this block in isolation — merge with your existing rules.)
  }
}
```

> Without the `/site/settings` rule, the public site will fall back to defaults forever (no logo, no Ko-fi, no ads). Without the `/reports` rule, the report button will fail with a permission error.

---

## What each section does

### 🎨 Branding

| Field | What happens |
|---|---|
| **Custom logo** | Uploaded via the existing `/api/upload` chain (Catbox/ImgBB/R2). When set, the navbar shows the uploaded image instead of the inline `JAYA·SCANS` SVG. Empty = use built-in. |
| **Site name** | Overrides `SITE.name` in titles, share text, JSON-LD, footer. Empty = use code default. |
| **Tagline** | Same, overrides `SITE.tagline`. |

Logo upload uses `adminFetch()` so the Worker's auth guard accepts it (Bearer token attached automatically).

### 💝 Ko-fi / Support widget

A glassy support card at the bottom of every chapter reader page. Three fields:
- **Toggle** — show/hide
- **Donation URL** — anywhere clickable (Ko-fi, BuyMeACoffee, Patreon, Kofi.com, custom)
- **Custom message** — what the card says above the button

Hidden whenever the toggle is off OR the master `features.kofiEnabled` is off.

### 📺 Ad slots

Four placement slots, each with a toggle + a script textarea:

| Slot | Where it renders |
|---|---|
| **Header** | Above the navbar, top of every page |
| **Footer** | Below the route outlet, bottom of every page |
| **Mid-chapter** | Between page 5 and 6 in the reader |
| **Sidebar** | Browse / series pages (when sidebar layout active) |

Paste any ad network's snippet:
- **AdSense** — `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXX" crossorigin="anonymous"></script>` plus a matching `<ins class="adsbygoogle">…</ins>`.
- **PopAds / Adsterra / Propeller** — paste the snippet they give you.
- **Custom HTML** — any markup works.

The CSP in `_headers` allows scripts from common ad networks (Google, googlesyndication, googletagservices, googletagmanager). For other networks, you may need to expand `script-src` in `_headers`.

> ⚠️ **Master ads toggle** in `features.adsEnabled` controls all four slots. When off, all slots clear regardless of individual toggles. Useful for quickly disabling ads during incidents.

### 💳 Payment gateway

Public-key fields for the upcoming premium tier. **Only paste publishable keys here:**
- Stripe: `pk_live_…` / `pk_test_…` (publishable, safe to expose)
- PayPal: client ID (public)

**Never paste secret keys** (`sk_live_…`, `secret_…`). Those go in Cloudflare Worker env vars.

These fields are non-functional today (no checkout flow yet) — they're stored so the next paywall PR can wire them up.

### 🔗 Discord webhook

Toggle + webhook URL. When a chapter is published from `/admin#chapters`, the admin browser POSTs an embed to the webhook URL announcing the new chapter, with cover thumbnail, series link, and chapter link.

How to get a webhook URL:
1. Discord channel → **Edit channel** → **Integrations** → **Webhooks** → **New Webhook**
2. Pick a name + avatar → **Copy Webhook URL** → paste into admin Settings

Optional **Mention role** field — any text gets prepended to the message body. To ping a role, use `<@&ROLE_ID>` (right-click role → Copy Role ID with Developer Mode on).

> The webhook URL is "public-ish" — anyone with it can post to that channel. Treat it like a low-stakes secret. If leaked, regenerate from Discord channel settings.

### 🌗 Theme

| Field | Effect |
|---|---|
| **Default theme** | What new visitors see (dark / light / sepia) |
| **Show theme switcher in nav** | Adds a sun-icon button in the top nav for users to cycle |
| **Allow user override** | If false, `data-theme` is forced to `defaultTheme` on every page (ignores localStorage) |

Theme palettes live in `assets/css/tokens.css` under `[data-theme="light"]` and `[data-theme="sepia"]`. Tweak palette tokens there to refine.

### 🚦 Feature toggles (master switches)

Quick on/off controls without losing your configured fields:
- **Reports** — show "Report a problem" button on chapter pages
- **Comments** — render the comments section on chapters/series
- **Ratings** — render the rating widget on series pages
- **Ko-fi** / **Ads** / **Theme switcher** / **Discord** — master switches for those features

---

## How the public site picks up changes

1. On every page load, `app.js` calls `loadSettings()` which:
   - Hits Firestore `/site/settings`
   - Falls back to localStorage cache if the read fails (e.g. offline)
   - Falls back to `DEFAULT_SETTINGS` if neither succeeds
2. `applyBranding()` swaps the navbar logo + injects ad scripts into `[data-ad-slot]` divs
3. Theme is applied **synchronously** from localStorage during boot (no flash)
4. `watchSettings()` opens a Firestore real-time listener so admin saves push to all open tabs without a reload

Saves from the admin form trigger:
- Firestore write (admin claim required)
- localStorage cache update
- Live re-application via `onSettingsChange()` subscribers

---

## Adding a new admin-editable field

Want to add (say) a Twitter URL to the settings? Three steps:

1. **Add the default** in `assets/js/lib/settings.js` → `DEFAULT_SETTINGS.social.twitter = ''`
2. **Add a form field** in `assets/js/admin/settings.js` (mirror the Ko-fi block — input + read in `getSettings()` + include in `patch` on save)
3. **Read it where you need it** in any view: `import { getSettings } from '../lib/settings.js'; const url = getSettings().social.twitter`

That's it. No schema migration; missing fields auto-fall-back to defaults.

---

## Test checklist after deploy

```
✓ /admin#settings — form loads, all fields show current values
✓ Upload a 200×60px PNG logo → save → public site shows it in navbar
✓ Toggle Ko-fi → set URL → save → reader page shows support card at bottom
✓ Paste a "<script>console.log('ad')</script>" in header slot, enable ads → public site console shows the log
✓ Cycle theme button → page palette changes → reload → preference sticks
✓ Click "Report a problem" on a chapter → submit → /admin#reports shows new entry
✓ Publish a chapter with Discord enabled → channel gets the embed
✓ /site/settings doc visible in Firestore Console with all fields
```
