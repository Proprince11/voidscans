# 06 — Roadmap

What's done, what's next, what's "maybe someday."

---

## ✅ Done — v3.0 (current)

### Architecture
- Single-page app, vanilla JS (no framework dependency)
- Path-based routing with View Transitions
- Schema-tolerant data layer (works with old + new Firestore shapes)
- TTL cache + inflight dedupe (in-memory)
- IndexedDB for library, history, reading progress
- ES module structure with code-split views

### Public site
- Premium home (hero slider, latest, popular, new arrivals, genre strip)
- Browse with filters (genre, type, status, sort)
- Search (debounced, ranked, URL-synced)
- Genre pages
- Series detail (rating, 5 emoji reactions, share, bookmark, comments, related, alt titles)
- Premium reader (zoom, fit modes, progress bar, keyboard, swipe, settings drawer, scroll memory, precaching)
- Library (bookmarks, history, status filters)
- 404 page

### Admin v2
- Auth gate via Firebase custom claim
- Dashboard stats
- Series CRUD with cover preview, genre toggles
- Chapter CRUD with drag-reorder pages, image previews
- Comments moderation
- Settings (account, cache clear, quick links)

### PWA / offline
- Service worker with 3-tier cache strategy
- Offline fallback page
- Chapter image precaching
- Installable manifest

### Tooling
- Cloudflare Worker for Firestore edge caching (deploy on demand)
- Maintenance scripts: grant-admin, revoke-admin, backup, migrate, seed
- Complete docs

### Bug fixes (from v2 audit)
- All 8 critical bugs from initial audit
- Security: admin claim required for writes
- `latestChapterAt` field added to preserve `createdAt`

---

## 🎯 Phase 2 — User accounts (next major milestone)

Estimated: 2 sessions. Trigger: when you start getting repeat readers.

- [ ] Sign-up / sign-in UI on public site
- [ ] Library / history sync across devices (Firestore-backed when signed in, IndexedDB-only when anonymous)
- [ ] User profiles (display name, avatar, public lists)
- [ ] Notification preferences per series
- [ ] Per-chapter comments
- [ ] Comment likes via authenticated counter
- [ ] Browser push notifications for new chapters (Firebase Cloud Messaging)

---

## 🎯 Phase 3 — Anti-spam & engagement (when scale demands)

- [ ] Cloudflare Turnstile on comment submit (invisible CAPTCHA)
- [ ] Rate limiting via Worker + IP hash (replaces fragile localStorage limits)
- [ ] Profanity filter wordlist (configurable in admin)
- [ ] Comment threading (parent/reply)
- [ ] Custom emoji reactions (asurascans-style)
- [ ] Public profile pages with bookmarks/lists/banner

---

## 🎯 Phase 4 — Discovery & SEO

- [ ] Auto-generated sitemap.xml on every deploy
- [ ] RSS feed per series + global feed
- [ ] JSON-LD structured data (Book, BlogPosting per chapter)
- [ ] OG image generator (chapter pages get a custom social preview)
- [ ] Sitelinks search box (Google site-specific search)

---

## 🎯 Phase 5 — Premium reading features

- [ ] Multiple reader modes:
  - [ ] Vertical strip (current)
  - [ ] Single page (paged manga style)
  - [ ] Double-page spread (desktop only)
- [ ] RTL reading direction toggle (manga)
- [ ] Page rotation (for landscape spreads on mobile)
- [ ] "Continue reading" strip on home (driven by IndexedDB history)
- [ ] Reading streak / history heatmap
- [ ] Page rotation lock toggle

---

## 🎯 Phase 6 — Admin power-ups

- [ ] In-admin R2 upload (drag-drop covers + chapter pages from the panel)
- [ ] Bulk chapter import (zip of pages → chapter)
- [ ] Series import from MangaDex/AniList by ID (auto-fill title, genres, etc.)
- [ ] Chapter scheduler (publish at future date)
- [ ] Scan-team byline per chapter (show on reader)
- [ ] Analytics dashboard (page views, popular series, reader retention)

---

## 🎯 Phase 7 — Monetization

- [ ] Adsterra / HilltopAds banner integration (lazy-loaded so they don't kill Lighthouse)
- [ ] Ad slots: home top banner, between hero and latest, in chapter list, top of reader
- [ ] Adblock detection with polite "consider whitelisting" message
- [ ] Affiliate links to legitimate manga merch
- [ ] Optional support page (Ko-fi / BuyMeACoffee)

---

## 🎯 Phase 8 — i18n / localization

- [ ] Site UI translations (English / Hindi / Indonesian / Vietnamese — major manga audiences)
- [ ] Per-series available languages flag
- [ ] User language preference persists

---

## 💡 "Maybe someday" ideas

- AI-driven recommendations ("you read X, try Y")
- Discord webhook on new chapter
- Public scanlation team profiles
- Hosted release calendar
- Auto-tagging via OCR + LLM
- Community moderator role (sub-admin claim)
- CLI for power admins (`vs add-chapter solo-raven 15 ./pages/`)

---

## ⛔ Explicitly NOT planned

- Native mobile apps (PWA covers this)
- React/Vue rewrite (vanilla JS is intentional)
- Server-side rendering (static + SPA serves SEO + performance well enough)
- Hosting your own image server (R2 + CF CDN is already this)
- Decentralized image hosting (IPFS, etc.) — too unreliable

---

## How to suggest changes

Open an issue on GitHub. For paid contributors, fork → PR.
