# 07 — Data Schema

Every Firestore field, what it means, what type it is.

---

## Collections overview

```
firestore/
├── series/{slug}            ← Each series. Doc ID = slug.
├── chapters/{auto-id}       ← All chapters across all series (legacy flat).
├── reactions/{slug}         ← Emoji reaction counts per series.
├── ratings/{slug}           ← Star rating aggregate per series.
└── series/{slug}/comments/{auto-id}  ← Comments are a subcollection.
```

**Why is `chapters` flat instead of nested?** Legacy schema. The new code reads via `seriesSlug` field. Migration to nested would require dual-write logic; we kept it flat for compatibility. Both shapes work in `api.js`.

---

## series/{slug}

Document ID = slug (e.g. `solo-raven`).

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `slug` | string | yes | — | URL-safe identifier. Same as doc ID for new docs; legacy docs may differ. |
| `title` | string | yes | — | Display title. |
| `altTitles` | string[] | no | `[]` | Alternative titles (Korean, Chinese, original-language, English variants). |
| `cover` | string (URL) | yes | — | Public URL to cover image. R2/Catbox/ImgBB all OK. |
| `coverBlur` | string (data URI) | no | `null` | Tiny base64 blur placeholder. Phase 2. |
| `type` | string | yes | `'manhwa'` | `manhwa` / `manga` / `manhua`. Lowercase. |
| `status` | string | yes | `'ongoing'` | `ongoing` / `completed` / `hiatus` / `dropped`. Lowercase. |
| `year` | number | no | `null` | Original release year (e.g. 2024). |
| `author` | string | no | `''` | Original story author. |
| `artist` | string | no | `''` | Original artist (often same as author for manhwa). |
| `genres` | string[] | no | `[]` | E.g. `['Action', 'Fantasy', 'Adventure']`. |
| `tags` | string[] | no | `[]` | Free-form tags like `'op-mc', 'regression'`. |
| `description` | string | no | `''` | Multi-paragraph synopsis. `\n` preserved. |
| `rating` | object | no | `{average:0,total:0}` | Aggregate read from this collection (not authoritative). Authoritative = `ratings/{slug}`. |
| `views` | number | no | `0` | Hit counter. Not implemented in v3.0. |
| `followers` | number | no | `0` | Bookmark counter. Phase 2. |
| `latestChapter` | number | yes | `0` | Highest chapter number published. Auto-updated on chapter create. |
| `latestChapterAt` | timestamp | no | `null` | When the latest chapter was published. **Don't overwrite createdAt** — that's why this exists. |
| `featured` | bool | no | `false` | Show in hero slider. |
| `hot` | bool | no | `false` | Show HOT badge. |
| `new` | bool | no | `false` | Show NEW badge. |
| `createdAt` | timestamp | yes | `serverTimestamp()` | When the series was first created. **Never overwritten.** |
| `updatedAt` | timestamp | yes | `serverTimestamp()` | When the series doc was last edited. |

---

## chapters/{auto-id}

Flat collection — all chapters across all series, joined via `seriesSlug`.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `seriesSlug` | string | yes | — | Foreign key → `series/{slug}`. |
| `chapterNum` | number | yes | — | Chapter number. Can be 0 (prologue), can be 14.5 (extra). Note: number not string. |
| `title` | string | no | `''` | Chapter title. Optional. |
| `images` | string[] | yes | — | Ordered list of page URLs. |
| `views` | number | no | `0` | Hit counter. Not implemented yet. |
| `createdAt` | timestamp | yes | `serverTimestamp()` | When the chapter was published. |

> **Schema migration:** v3 normalizer also reads `number` and `pages` field names if present (for forward-compat with potential v4 schema).

---

## reactions/{slug}

Document ID = series slug. Each field is a reaction key with a count.

| Field | Type | Description |
|---|---|---|
| `fire` | number | 🔥 count |
| `heart` | number | ❤️ count |
| `star` | number | ⭐ count |
| `mind` | number | 🤯 count |
| `sad` | number | 😢 count |

Increments via `FieldValue.increment(1)`. Anyone can write (rate-limited by frontend localStorage).

---

## ratings/{slug}

Document ID = series slug.

| Field | Type | Description |
|---|---|---|
| `average` | number | Running average. Computed on each new rating: `(avg * (total-1) + new) / total`. |
| `total` | number | Total ratings submitted. |
| `distribution` | number[] | Length-5 array. `[1-star count, 2-star, 3, 4, 5]`. |

Anyone can write (rate-limited by frontend localStorage).

---

## series/{slug}/comments/{auto-id}

Subcollection under each series.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `authorName` | string | no | `'Anonymous'` | Display name. Max 40 chars. |
| `authorId` | string\|null | no | `null` | UID if signed in. Phase 2. |
| `text` | string | yes | — | The comment. 2–1000 chars (enforced by rules). |
| `chapter` | number\|null | no | `null` | If the comment is per-chapter. Phase 2. |
| `likes` | number | no | `0` | Like counter. Anyone can increment. |
| `flagged` | bool | no | `false` | For moderation queue. Phase 2. |
| `createdAt` | timestamp | yes | `serverTimestamp()` | Posted at. |

---

## (Phase 2) users/{uid}

Stub for when sign-up flow is wired up.

| Field | Type | Description |
|---|---|---|
| `displayName` | string | User's chosen handle |
| `avatar` | string | URL to avatar (R2-hosted upload or default) |
| `bio` | string | Optional |
| `createdAt` | timestamp | Account creation |
| `lastSeen` | timestamp | Updated on app open |

---

## (Phase 2) users/{uid}/library/{seriesId}

Per-user bookmarks (Firestore mirror of IndexedDB).

| Field | Type |
|---|---|
| `seriesId` | string |
| `status` | string (`reading` / `completed` / `planned` / `dropped`) |
| `currentChapter` | number |
| `lastReadAt` | timestamp |
| `follow` | bool (notify on update?) |

---

## (Phase 2) users/{uid}/history/{auto-id}

Per-user reading history.

| Field | Type |
|---|---|
| `seriesId` | string |
| `chapter` | number |
| `page` | number |
| `total` | number |
| `readAt` | timestamp |

---

## Indexes

Firestore auto-prompts you to create composite indexes the first time a query needs one. The known queries that need indexes:

```
chapters where seriesSlug == X order by chapterNum desc
chapters where seriesSlug == X and chapterNum == Y
series order by createdAt desc
```

Firestore Console will surface these as 1-click index creation links the first time the query runs.

---

## Migration history

| Version | Change |
|---|---|
| v1 | Original: `title`, `slug`, `cover`, `description`, `type`, `status`, `latestChapter`, `createdAt` |
| v2 | Same shape, just added `admin.html` writes |
| v3 | Adds: `altTitles`, `coverBlur`, `year`, `author`, `artist`, `genres`, `tags`, `rating{}`, `views`, `followers`, `latestChapterAt`, `featured`, `hot`, `new`, `updatedAt`. Old fields preserved; reader is tolerant. |

Run `node scripts/migrate-schema.mjs --apply` to upgrade legacy docs idempotently.
