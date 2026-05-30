# 05 — Troubleshooting

Common issues and fixes.

---

## "I can't log in to admin"

### Symptom: "Not Authorized" screen after login

You're signed in but the `admin` custom claim isn't set on your user.

**Fix:**
```bash
cd scripts
node grant-admin.mjs your-email@example.com
```

Then sign out, sign back in.

If the script says "no user found":
- Did you create the user in Firebase Console → Auth → Users?
- Did you spell the email correctly?

### Symptom: "Wrong email or password" when you're sure they're right

- Are you on the right Firebase project? Check `assets/js/lib/firebase.js` `projectId: 'voidscans-6c66b'`.
- Was the password set correctly? Reset it via Firebase Console → Auth → user → "Reset password" or use the "Forgot password" link.

---

## "Series page is blank"

### Symptom: Page loads, navbar present, but no series content

Most likely the slug doesn't match any document.

**Check:**
1. Open DevTools console.
2. You should see a Firestore error or `Series not found` log.
3. Visit `/admin` → Series → confirm the slug exists exactly.

### Symptom: Series exists but page still blank

1. Check Network tab — is Firestore returning 403 (permission denied)?
   - **Fix:** Apply the security rules from [Task 1](./09-user-tasks.md). Public reads must be allowed.
2. Check the cover URL — broken image? Open the URL directly in a browser tab.

---

## "Chapter pages don't load images"

### Symptom: Reader opens but images are gray boxes

- Images URL must be **publicly accessible** (no auth required).
- Cloudflare R2: did you enable Public Access on the bucket?
- Catbox/ImgBB: did the host delete the file?
- Open the image URL directly in a new tab. Does it show?
- CSP issues: check DevTools console for "blocked by Content Security Policy" — if so, add the host to `_headers`.

### Symptom: "Loading…" forever, no images render

- Check `chapterNum` is a **number**, not a string in Firestore. Sometimes admin's older form stored as string.
- Run `npm run migrate` from `scripts/`.

---

## "Service worker won't update"

### Symptom: New deploy goes live but I see old version

Service workers cache aggressively. Solutions in order:

1. **Hard reload:** Cmd+Shift+R (Mac) / Ctrl+Shift+R (Win).
2. **Force update:** DevTools → Application → Service Workers → "Update" button.
3. **Clear all:** Application → Storage → "Clear site data" → reload.
4. **Bump cache version:** Edit `sw.js`, change `CACHE_VERSION = 'v3.0.0'` to `v3.0.1`. Push. Old caches will be wiped automatically on activate.

---

## "Firestore quota exceeded"

### Symptom: site loads but data fails after a few visitors

Firestore free tier: 50K reads/day, 20K writes/day.

**Quick fix (in 30 seconds):**
- Admin → Settings → Clear Cache. Wait 5 minutes. Cache TTL was probably the issue.

**Real fix:**
1. Deploy the cache Worker: see [Task 7](./09-user-tasks.md) and [docs/04-deploy.md](./04-deploy.md).
2. With the Worker, you'll go from ~6K daily PV ceiling to ~50K daily PV.

**Emergency fix:**
- Firebase Console → Firestore → Usage → upgrade to Blaze (pay-as-you-go) plan. Costs ~$0.01 per extra 10K reads. You'll spend pennies until it really takes off.

---

## "Admin form won't save"

### Symptom: Click Save → spinner → "Save failed: permission-denied"

- The security rules require the `admin` custom claim. See "I can't log in to admin" above.
- Did you sign out + sign back in after running `grant-admin`? Custom claims need a token refresh.

### Symptom: Save loops on "Saving…" forever

- Network blip. Check DevTools Console.
- Refresh page. Form data is unfortunately lost (Phase 2: add localStorage draft autosave).

---

## "Bookmarks/library disappeared"

The library is in IndexedDB. It's per-device, per-browser.

- Did you clear browser data? IndexedDB gets wiped with site data.
- Did you switch browsers? Each browser has its own IndexedDB.
- Phase 2 will add Firestore sync if signed in (cross-device).

---

## "Search returns nothing"

Search is purely client-side over the cached series list.

- First time loading the search page may take a moment (fetches all series).
- Wait 200ms after typing — search is debounced.
- If the page hasn't loaded series yet, you'll see "0 results". Wait a sec.
- Check `/admin#series` for actual series count.

---

## "PWA install prompt doesn't appear"

### Symptom: I want to install but the browser never asks

PWAs require:
- HTTPS (Cloudflare Pages handles this automatically).
- Valid manifest (`/manifest.webmanifest` should return 200 with `Content-Type: application/manifest+json`).
- Registered service worker.
- User has visited the site at least twice for ~30 seconds.

In Chrome: address bar → install icon (small computer/+ sign on the right). If missing, run Lighthouse → Application → PWA section to see what's missing.

---

## "Reader is laggy on mobile"

- Are images very large? Compress to WebP at quality 80.
- Try the Settings drawer → switch from Fit Width to Zoom 100% (less reflow on scroll).
- Check that you're not running the React DevTools extension (it slows everything down).
- Reduce reactor preferences `--glass-blur` complexity if needed (advanced — edit `tokens.css`).

---

## "Comments aren't appearing"

- Comments collection is at `/series/{slug}/comments` — make sure security rules allow public read.
- Check DevTools Network tab for the request — 403 = rules issue.
- Cache: comments TTL is 30 seconds. New comments may take that long to appear.

---

## "I deleted a series but its chapters still show on home"

Cache TTL. Wait 5 minutes, or:
- Admin → Settings → Clear Cache.

---

## When all else fails

1. Check Cloudflare Pages → Deployments → look for failed builds.
2. Check Firebase Console → Logs → Firestore activity.
3. Run `npm run backup` and tell Kiro what's broken — having the data dump speeds debugging massively.

---

## Useful URLs to bookmark

- [Firebase Console](https://console.firebase.google.com/project/voidscans-6c66b)
- [Firestore Data](https://console.firebase.google.com/project/voidscans-6c66b/firestore)
- [Firestore Rules](https://console.firebase.google.com/project/voidscans-6c66b/firestore/rules)
- [Auth Users](https://console.firebase.google.com/project/voidscans-6c66b/authentication/users)
- [Service Accounts](https://console.firebase.google.com/project/voidscans-6c66b/settings/serviceaccounts/adminsdk)
- [Cloudflare Dashboard](https://dash.cloudflare.com)
