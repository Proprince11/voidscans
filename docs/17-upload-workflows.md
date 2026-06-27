# 17 — Chapter Upload Workflows

All the ways to get chapters onto JayaScans. Pick whichever fits your situation.

---

## Method 1: Admin Panel (Browser)

**Best for:** Adding 1 chapter manually, or when you already have image URLs.

**Steps:**
1. Go to `/admin` → Chapters → Select Series → New Chapter
2. Set chapter number
3. Either:
   - **Paste URLs** directly (one per line) into the textarea
   - **Bulk Upload Files** — drag-drop local images
   - **Scrape from Webpage** — paste a source URL, it scans for images, re-hosts them
4. Preview, drag to reorder, remove junk → Publish

**Pros:** Visual preview, drag reorder, no terminal needed.
**Cons:** One chapter at a time, Worker timeout on large chapters (90+ images).

---

## Method 2: Grabber GUI (Visual, Local)

**Best for:** Daily workflow. See all images, deselect junk, upload with preview.

**Setup:**
```bash
cd scripts
npm install          # first time only
npm install sharp    # optional: enables WebP conversion
```

**Run:**
```bash
node grabber-gui.mjs
# Or with ImgBB alternating:
$env:IMGBB_API_KEY="your-key"; node grabber-gui.mjs
```

**Open:** http://localhost:3456

**Steps:**
1. Paste chapter URL → click Scan
2. See all images as thumbnails (click to deselect junk)
3. Click "Upload Selected to Catbox"
4. Copy the links → paste into Admin → Chapters → Page URLs → Publish

**Pros:** Visual selection, alternating Catbox/ImgBB, WebP conversion, no timeout.
**Cons:** Manual publish step (copy-paste links into admin).

---

## Method 3: Grab Chapter CLI (Command Line, Save to File)

**Best for:** Batch downloading links without publishing. Keep .txt files for later.

**Single chapter:**
```bash
node grab-chapter.mjs "https://hivetoons.org/series/lookism/chapter-5"
# → creates chapter-links-xxxxx.txt
```

**With custom filename:**
```bash
node grab-chapter.mjs "https://hivetoons.org/series/lookism/chapter-5" --save lookism-ch5.txt
```

**Batch (many chapters):**
```bash
node grab-chapter.mjs --batch "https://hivetoons.org/series/lookism/chapter-{N}" --start 1 --end 100
# → creates chapters-output/ch-001.txt through ch-100.txt
```

**Options:**
- `--delay 1000` — slower uploads (1 second gap, safer)
- `--out my-folder` — custom output folder for batch mode

**Pros:** Simple, batch capable, no token needed, reliable.
**Cons:** No visual preview. Must publish manually via admin.

---

## Method 4: Local Import (Fully Automated)

**Best for:** Bulk import 100+ chapters hands-off. Scrapes, uploads, AND publishes.

**Requires:** Firebase ID token (expires in 1 hour).

**Get token:** Open admin in Chrome → F12 → Console →
```javascript
const { auth } = await import('/assets/js/lib/firebase.js');
console.log(await auth.currentUser.getIdToken());
```

**Run:**
```bash
node local-import.mjs --series lookism \
  --pattern "https://hivetoons.org/series/lookism/chapter-{N}" \
  --start 1 --end 100 \
  --token YOUR_TOKEN
```

**Options:**
- `--dry-run` — just scrape, show image counts, don't upload
- `--export chapters.csv` — upload images but save URLs to CSV instead of publishing
- `--delay 700` — ms between each image upload (default 700)
- `--retry failed-log.json` — retry previously failed chapters

**Pros:** Fully automated, reliable (your PC, no Worker timeout), auto-retry.
**Cons:** Needs token (expires hourly), slower than Worker method.

---

## Method 5: Bulk Import via Worker

**Best for:** Fast bulk import if chapters have < 30 images each.

**Run:**
```bash
node bulk-import.mjs --series lookism \
  --pattern "https://hivetoons.org/series/lookism/chapter-{N}" \
  --start 1 --end 50 \
  --token YOUR_TOKEN
```

**Options:**
- `--dry-run` — test without uploading
- `--concurrency 1` — chapters processed at a time (keep at 1 for reliability)
- `--site https://jayascans.online` — your site URL

**Pros:** Faster per-chapter (Worker is closer to Catbox).
**Cons:** Worker has 30s timeout, Catbox rate-limits shared IPs, unreliable for big chapters (90+ images).

---

## Comparison Table

| Method | Speed | Reliability | Visual Preview | Auto Publish | Token Needed |
|--------|-------|-------------|----------------|--------------|-------------|
| Admin Panel | Slow | Medium | ✅ | ✅ | No (logged in) |
| Grabber GUI | Medium | High | ✅ | ❌ (copy-paste) | No |
| Grab Chapter CLI | Medium | High | ❌ | ❌ (manual) | No |
| Local Import | Medium | High | ❌ | ✅ | Yes |
| Bulk Import (Worker) | Fast | Low | ❌ | ✅ | Yes |

---

## Recommended Workflow

**For daily use (1-5 chapters):**
→ Grabber GUI (Method 2). Visual, reliable, no token.

**For initial bulk import (100+ chapters):**
→ Mega Grab + Mega Publish (Method 6). Runs overnight, publish next day.

**For quick single chapter:**
→ Admin Panel (Method 1) with "Scrape from Webpage" helper.

**Full automated daily workflow:**
```bash
node update-series.mjs        # Check for new chapters (5 seconds)
node mega-grab.mjs --delay 100  # Grab everything new (runs in background)
node publish-gui.mjs           # Open browser, paste token, publish all
```

---

## Method 6: Mega Grab + Mega Publish (Recommended for Bulk)

**Best for:** Initial import of 100-1000+ chapters across multiple series. Set up once, walk away.

**Setup (one time):**
```bash
cd scripts
node mega-grab.mjs    # Creates series.json template — edit it
```

Edit `series.json`:
```json
[
  {
    "slug": "lookism",
    "pattern": "https://hivetoons.org/series/lookism/chapter-{N}",
    "start": 1,
    "end": 613,
    "status": "ongoing"
  }
]
```

**Run the grabber (walk away):**
```bash
node mega-grab.mjs --delay 100 --concurrency 2
```

**Check for new chapters first:**
```bash
node update-series.mjs          # Auto-updates "end" in series.json
node mega-grab.mjs --delay 100  # Only grabs new chapters (skips existing)
```

**Publish (when ready):**
```bash
node publish-gui.mjs    # Open localhost:3457, paste token, click Publish All
# OR
node mega-publish.mjs --token YOUR_TOKEN   # CLI version
```

**Options:**
- `--delay 100` — ms between image uploads (100 is safe with alternating)
- `--concurrency 2` — chapters processed simultaneously (default 2)

**Output:** `mega-output/series-slug/ch-0001.json` per chapter (resumable).

---

## Method 7: Update Series (Auto-Detect New Chapters)

**Best for:** Checking if new chapters are available without manually visiting source sites.

```bash
node update-series.mjs
```

Output:
```
  lookism: 613 → 620 ✓ (+7 new)
  hero-x-demon-empress: skipped (completed)
  solo-farming: up to date (131)
```

Run before `mega-grab` to ensure you're grabbing all available content.

---

## Method 8: Publish GUI (Browser-Based)

**Best for:** Publishing without CLI/token fiddling. Visual progress.

```bash
node publish-gui.mjs    # Opens localhost:3457
```

1. Open http://localhost:3457
2. See all grabbed chapters listed by series
3. Paste your Firebase token
4. Click "Publish All"
5. Watch the progress bar fill up

Skips already-published chapters automatically.

---

## Storage Backends

Images alternate between:
- **Catbox** (primary) — free, lossless, DMCA-separate
- **ImgBB** (backup) — free, auto-failover if Catbox fails

Set `IMGBB_API_KEY` environment variable when running scripts for alternating uploads.

**WebP Conversion** (optional):
```bash
cd scripts && npm install sharp
```
When sharp is installed, JPG/PNG images auto-convert to WebP (~40% smaller) before upload. Already-WebP images skip conversion.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "All uploads failed" | Catbox rate-limited. Wait 5 min, increase `--delay` to 1500 |
| "Token expired" | Get a new token from admin console |
| "Page returned 520/403" | Source site blocking. Try a different source or wait |
| "No images found" | Page uses JavaScript rendering. Try a different source |
| Junk images in chapter | Use Grabber GUI to visually deselect, or edit in admin after |
