# 11 — Monetization Roadmap

How to make money from this platform, in realistic stages. Honest about what works for a scanlation site (most premium ad networks reject unlicensed-content sites — plan around that).

---

## Reality check first

- **Google AdSense / Ezoic / Mediavine / AdThrive** → will **reject** unlicensed manga/scanlation sites. Don't waste time applying early; a rejection can also flag your AdSense account.
- **Manga-friendly networks** (accept this niche, lower CPM) → Adsterra, HilltopAds, PropellerAds, PopAds, Galaksion, Monetag.
- **The real money at scale** → direct deals (VPNs, gaming, anime merch) + your own community/Patreon.

Don't add ANY ads until you have **~1,000 page views/day** for a couple of weeks — early ads tank your Lighthouse score and earn pennies. Build audience first.

---

## Stage 0 — Now (0 traffic): set up the plumbing, run nothing

Reserve ad slots in the layout with stable class names so adding ads later is config, not surgery. Recommended slots (don't fill yet):

| Slot id | Location | Format |
|---|---|---|
| `ad-home-top` | Home, below navbar | 728×90 / responsive |
| `ad-series-mid` | Series page, between description and chapters | 300×250 |
| `ad-reader-top` | Reader, above first page | responsive |
| `ad-reader-bottom` | Reader, above next-chapter button | responsive |

Build a single `<div class="ad-slot" data-slot="...">` component that renders nothing until an `ADS_ENABLED` flag is on. Ping Kiro to scaffold this (~30 min) when you're ready.

---

## Stage 1 — ~1K daily PV: first ads (Adsterra / HilltopAds)

1. Apply to **Adsterra** and **HilltopAds** (both accept manga, approve fast).
2. Start with **banner + native** ads only. **Avoid popunders** at first — they wreck mobile UX and bounce rate (you can test them later in the reader only).
3. Lazy-load ad scripts (only when the slot scrolls near view) so Core Web Vitals stay green.
4. Expected: **$5–20 / month** at 1K PV/day. It's seed money, not income yet.

**Implementation:** put the network's script behind the `ADS_ENABLED` flag + an IntersectionObserver that injects the ad `<script>` when the slot is ~600px from viewport.

---

## Stage 2 — ~10–50K daily PV: optimize

- Add a second network and **A/B by placement** (Adsterra vs HilltopAds vs PropellerAds) — keep whichever pays more per slot.
- Add **interstitial between chapters** (1 ad when clicking "Next Chapter") — high value, tolerable frequency. Cap at 1 per N chapters via localStorage.
- Turn on **anti-adblock-friendly** native ads (don't use aggressive anti-adblock walls — they kill retention).
- Expected: **$80–400 / month**.

---

## Stage 3 — 100K+ daily PV: direct + diversify

- **Direct sponsorships:** VPN companies pay the highest CPM in piracy-adjacent niches; also anime merch, gacha games, other aggregators. Reach out directly — a flat monthly banner deal beats network CPM.
- **Patreon / Ko-fi:** "support us / early chapters / no-ads tier." Your community is your most loyal revenue.
- **Affiliate:** legit manga merch, figures, official volume links (ironically, linking official releases can earn affiliate $ and looks good for DMCA posture).
- Expected: **$800–2,000+ / month** at 1M PV/month.

---

## Tech: how ads plug into this codebase

When you say go, the implementation is:

1. **Config flag:** add `ADS_ENABLED` + `AD_NETWORK` to `site.config.js`.
2. **`<AdSlot>` component** (`assets/js/views/_components.js`): renders the network snippet, lazy-loaded via IntersectionObserver, only if enabled.
3. **Placements:** drop `adSlot('ad-reader-top')` etc. into home/series/reader views.
4. **Frequency caps** for interstitials via localStorage.
5. **Performance guard:** ad scripts are `async`, lazy, and never block the reader.

All of this is ~2–3 hours of work, reversible via the flag. Nothing to do until you have traffic.

---

## What NOT to do

- ❌ Don't apply to AdSense now (rejection risk).
- ❌ Don't add popunders/redirects on day 1 (kills the audience you're trying to build).
- ❌ Don't add anti-adblock walls (manga readers leave instantly).
- ❌ Don't put ads inside the page-image flow (looks like malware, destroys trust).

---

## Summary

```
Now      → reserve slots, ship NO ads, grow audience + community
~1K/day  → Adsterra + HilltopAds, banners only, lazy-loaded
~10K/day → add interstitial-between-chapters, A/B networks
100K/day → direct VPN/merch deals + Patreon + affiliate
```

Build the audience. The money follows traffic, and traffic follows consistent releases + a community.
