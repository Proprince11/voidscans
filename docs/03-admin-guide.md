# 03 — Admin Panel Guide

Tour of every screen in `/admin`.

## Login

URL: `/admin` (`https://voidscans.pages.dev/admin`)

- Sign in with the Firebase Auth user you created (see [Task 2](./09-user-tasks.md)).
- Forgot password? Click the reset link → email sent via Firebase.
- Wrong account? You'll see "Not Authorized" if you're missing the `admin` custom claim. Run `node scripts/grant-admin.mjs your-email` and re-login.

## Dashboard

The default landing page.

- **4 stat cards:** Total Series, Total Chapters, Ongoing, Completed.
- **Recently Updated** table: last 8 series with thumbs.
- **Quick Actions:** New Series, New Chapter, Moderate Comments, View Live Site.

## Series

### List view
- Search by title or slug (instant filter).
- Each row: thumbnail, title + slug, type badge, status badge, latest chapter, top 3 genres, actions.
- Action icons: 👁 view live · ✏ edit · 🗑 delete.
- Delete cascades all chapters of that series.

### Form view (New / Edit)
| Section | Notes |
|---|---|
| Title + Slug | Auto-slug from title until you manually edit slug. |
| Cover URL | Live preview thumb beneath. Hides if URL fails. |
| Type / Status | Lowercase enums. Status badges color-coded. |
| Author / Artist / Year / Alt Titles | All optional. Alt titles comma-separated. |
| Genres | Toggle pills. Multi-select. |
| Tags | Free-form, comma-separated. |
| Description | Multi-paragraph supported (line breaks preserved). |
| Featured / Hot / New | Three independent flags. New defaults true on create. |

Save button is disabled while the request is in flight to prevent double-submits.

## Chapters

### Per-series view
- Series dropdown at top (lists all series with their chapter counts).
- Table of chapters: number, title, page count, created.
- Action icons same pattern as Series.

### Form view (New / Edit)
- Chapter number auto-increments from latest.
- Page URLs textarea: one URL per line.
- **Live preview grid:** as you type, thumbs render below. Drag to reorder. Click × to remove.
- Reorder syncs back to the textarea automatically.

> If a page image fails to load, the preview shows a gray box. Verify the URL is publicly accessible.

## Comments

- Series dropdown at top.
- Lists all comments newest-first with author, timestamp, like count, full text.
- Delete button per comment with confirm modal.
- No edit (intentional — comments are append-only).

> Mass delete tip: For multi-comment cleanup, run a quick Node script using firebase-admin (Phase 2 will add a "delete all flagged" UI).

## Settings

- **Account:** email, UID, admin claim status badge.
- **Sign Out** button.
- **Clear Cache:** wipes the in-memory TTL cache so admin edits show on the public site immediately.
- **Quick Links:** direct deep links to Firebase Console, Firestore data, security rules, Auth users, Cloudflare Dashboard.

## Tabs reference

| Hash URL | Tab |
|---|---|
| `/admin#dashboard` | Dashboard |
| `/admin#series` | Series |
| `/admin#chapters` | Chapters |
| `/admin#comments` | Comments |
| `/admin#settings` | Settings |

Direct deep linking works: bookmark `/admin#chapters` to land there after login.

## Keyboard shortcuts (planned)

Not yet implemented in v3.0. Phase 2 will add:
- `g h` → Dashboard
- `g s` → Series
- `g c` → Chapters
- `n` → New (context-aware)
- `/` → Focus search

## Common admin tasks

### "I broke a series, how do I fix it?"
Series → search by slug → edit. The slug field shouldn't change (would break bookmarks).

### "I uploaded the wrong chapter image."
Chapters → select series → edit chapter → reorder/remove pages. Save.

### "I want to feature a series in the hero."
Series → edit → check **Featured** box → save. Up to 5 featured series rotate in the hero on home.

### "I want to remove an admin."
```bash
cd scripts
node grant-admin.mjs --revoke their-email@example.com
```
They'll be signed out and lose admin access on next login.
