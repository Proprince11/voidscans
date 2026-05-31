# 12 — Build This App From Scratch (Zero-Coding Tutorial)

A complete, plain-English script for building JayaScans even if you've **never written code**. No jargon left unexplained. By the end you'll understand how every piece connects and be able to rebuild it yourself.

> Read it top to bottom once for the mental model, then again with your editor open to actually build.

---

## Part 1 — The mental model (what even IS a website?)

Imagine a restaurant:

- **The dining room** = what visitors see (the web pages). This is the **frontend**.
- **The kitchen** = where data is stored and prepared. This is the **backend / database**.
- **The waiter** = carries orders between dining room and kitchen. This is the **API**.
- **The building/address** = where it all lives so people can visit. This is **hosting + domain**.

Our app's specific choices:

| Restaurant part | Our tech | Why |
|---|---|---|
| Dining room (frontend) | HTML + CSS + JavaScript | The 3 languages every browser speaks natively |
| Kitchen (database) | Firebase Firestore | Free, no server to manage, stores our series/chapters/comments |
| Waiter (API) | A Cloudflare Worker | Free code that runs on the internet, fetches data + handles uploads |
| Building (hosting) | Cloudflare Workers/Pages | Free, fast, serves the site worldwide |
| Address (domain) | a `.workers.dev` URL (free) or bought domain | What people type to visit |

**The 3 frontend languages explained simply:**
- **HTML** = the *structure* (headings, buttons, images) — like the skeleton.
- **CSS** = the *style* (colors, spacing, fonts) — like skin and clothes.
- **JavaScript (JS)** = the *behavior* (what happens when you click) — like muscles.

---

## Part 2 — The tools you need (all free)

1. **A code editor** — [VS Code](https://code.visualstudio.com/). It's like Microsoft Word, but for code.
2. **A GitHub account** — [github.com](https://github.com). This is "Google Drive for code." It stores your project and connects to hosting.
3. **A Cloudflare account** — [cloudflare.com](https://cloudflare.com). Free hosting + the "waiter."
4. **A Firebase account** — [firebase.google.com](https://firebase.google.com). Free database.
5. **A web browser** — Chrome/Brave/Firefox. You already have one.

No paid software. No server to rent. Total cost: $0 (until you optionally buy a domain for ~$1–10/year).

---

## Part 3 — How the pieces talk to each other (the workflow)

Here's what happens when someone reads a chapter on your site:

```
1. Visitor types your address → Cloudflare sends them the HTML/CSS/JS (the dining room).
2. The JavaScript wakes up and asks the "waiter" (Worker/Firebase): "give me chapter 14 of Solo Raven."
3. Firebase (the kitchen) looks it up and hands back the data (image URLs, title).
4. The JavaScript places those images on the page.
5. The visitor scrolls and reads. Their progress is saved in their own browser.
```

And when YOU (admin) add a chapter:
```
1. You log into /admin (only you can — protected by a password + a special "admin" stamp).
2. You drag in the chapter's image files.
3. The Worker uploads them to an image host (Catbox) and gets back URLs.
4. You click Publish → the Worker saves the chapter into Firebase.
5. Instantly, visitors can read it.
```

That's the whole system. Everything else is detail.

---

## Part 4 — Build it, step by step

### Step 1 — The skeleton (HTML)

Create a file `index.html`. This is the front door. The simplest version:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My Manga Site</title>
  <link rel="stylesheet" href="style.css">  <!-- loads our styling -->
</head>
<body>
  <div id="app">Loading…</div>          <!-- JavaScript fills this in -->
  <script type="module" src="app.js"></script>  <!-- loads our behavior -->
</body>
</html>
```

**Plain English:** This says "I'm a web page, my title is 'My Manga Site', load my styles from style.css, show 'Loading…' in a box called `app`, and run the code in app.js." The `id="app"` box is where everything appears.

### Step 2 — Make it pretty (CSS)

Create `style.css`. CSS is a list of rules: "this thing → looks like this."

```css
body {
  background: #0a0a0c;     /* near-black background */
  color: #ececf3;          /* near-white text */
  font-family: sans-serif; /* clean modern font */
}
.btn {
  background: #f0b941;      /* gold button */
  color: #000;
  padding: 10px 20px;      /* breathing room inside */
  border-radius: 8px;      /* rounded corners */
  cursor: pointer;
}
```

**Plain English:** "The whole page has a black background and white text. Anything labelled `btn` is a gold, rounded button." You change one value here, and every button updates. That's the power of CSS — define once, apply everywhere. (In the real app we split this into `tokens.css` for colors/sizes and other files for components — same idea, just organized.)

### Step 3 — Set up the kitchen (Firebase)

1. Go to Firebase → create a project (name it anything).
2. Click **Firestore Database → Create database → test mode**.
3. Firestore stores data as **collections** (like folders) and **documents** (like files in those folders).

Our folders:
- `series` → one document per manga (title, cover, genres…)
- `chapters` → one document per chapter (which series, number, image URLs)
- `comments`, `ratings`, `reactions` → community stuff

4. Firebase gives you a **config** (a little block of keys). Copy it into a file `firebase.js`:

```js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "...",        // ← your keys from Firebase
  projectId: "my-project",
  // ...the rest
};

export const app = initializeApp(firebaseConfig);  // start Firebase
export const db = getFirestore(app);               // get the database
```

**Plain English:** "Connect to my Firebase kitchen and give me a handle called `db` I can use to read/write data." `export` means "let other files use this."

> These keys are safe to put in your code — Firebase is secured by **rules** (Part 5), not by hiding keys.

### Step 4 — The behavior (JavaScript)

Create `app.js`. Here's the core idea — fetch series from the database and show them:

```js
import { db } from './firebase.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

async function showSeries() {
  const box = document.getElementById('app');   // grab the "app" box
  const snapshot = await getDocs(collection(db, 'series')); // ask kitchen for all series
  let html = '';
  snapshot.forEach(doc => {                      // for each series…
    const s = doc.data();                        // get its data
    html += `<div class="card">
               <img src="${s.cover}">
               <h3>${s.title}</h3>
             </div>`;                            // build a card
  });
  box.innerHTML = html;                          // put all cards in the box
}

showSeries();   // run it
```

**Plain English, line by line:**
- `import` = "borrow the database handle and two helper tools."
- `async function` = "a task that might take a moment (talking to the kitchen takes time)."
- `getDocs(collection(db, 'series'))` = "kitchen, give me everything in the `series` folder."
- `await` = "wait for the kitchen to respond before continuing."
- `snapshot.forEach(...)` = "for each series I got back, do this."
- The backtick `` ` `` string = "build a little chunk of HTML using the series' cover and title." The `${...}` slots in real values.
- `box.innerHTML = html` = "put all those cards into the page."

That's the **entire pattern** the whole app uses, repeated: *ask the database → loop over results → build HTML → put it on the page.* Series list, chapter list, comments — all the same shape.

### Step 5 — Pages without page reloads (the router)

A modern app doesn't reload the whole page when you click — it swaps content instantly. The piece that does this is a **router**. Plain English: "watch the address bar; when it says `/series/solo-raven`, show the series view; when it says `/read/solo-raven/14`, show the reader." It's a traffic cop matching URLs to functions. (In our app that's `router.js` + the `views/` folder, one file per screen.)

### Step 6 — The waiter (Cloudflare Worker)

Some jobs can't be done from the browser (uploading images, fetching other websites — browsers block these for security). So we have a tiny program that runs *on Cloudflare's computers* — the **Worker**. Plain English: it's a function that receives a web request and returns a response. Example:

```js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') {
      return Response.json({ ok: true });   // a simple "I'm alive" reply
    }
    return env.ASSETS.fetch(request);       // otherwise, serve the website files
  }
};
```

**Plain English:** "When a request comes in: if it's asking `/api/health`, reply `{ok:true}`. Otherwise, hand them the normal website." We add more `if` branches for uploading, scraping, RSS, etc. Each is a small helper.

### Step 7 — Put it online (deploy)

1. Push your files to GitHub (VS Code has buttons for this: Commit → Push). "Commit" = save a snapshot. "Push" = upload it to GitHub.
2. In Cloudflare → Workers & Pages → connect your GitHub repo.
3. Every time you Push to GitHub, Cloudflare automatically rebuilds and your site updates in ~30 seconds. This is called **continuous deployment** — you never manually upload files.

---

## Part 5 — Security (so randoms can't wreck your site)

Firebase **Security Rules** are a guest list. Without them, anyone could delete your data. The key rule:

```
match /series/{id} {
  allow read: if true;                                  // anyone can READ series
  allow write: if request.auth.token.admin == true;     // only ADMINS can change them
}
```

**Plain English:** "Everyone may look at series. Only someone carrying the special 'admin' stamp may add/edit/delete." You give yourself that stamp once using a small script (`grant-admin`). Visitors never get it, so they can read but not vandalize.

---

## Part 6 — How the real app is organized (so the folders make sense)

Once you understand the basics above, the real project is just *more of the same, neatly filed*:

```
index.html        → the front door (Part 1)
admin/index.html  → the admin door (password-protected)
assets/css/       → styling, split into small files (colors, components, pages)
assets/js/
  lib/            → shared tools (firebase, database helper, router, login)
  views/          → one file per screen (home, series, reader, library…)
  admin/          → one file per admin tab (series, chapters, tools…)
workers/main/src/ → the "waiter" (uploads, scraping, RSS, sitemap)
docs/             → these guides
```

It looks like a lot of files, but each file is small and does ONE job. That's intentional — small files are easy to understand and fix. It's the same three languages (HTML/CSS/JS) from Part 1, just organized so you can find things.

---

## Part 7 — Your daily workflow once it's built

1. Translate/prepare a chapter's images.
2. Go to `/admin` → Chapters → New Chapter.
3. Drag the images in (they auto-upload), or paste a webpage URL to grab them.
4. Type the chapter number + name, click Publish.
5. Done — it's live for readers in seconds.

No code needed for day-to-day. You only touch code to change how the site *looks or works*, not to add content.

---

## Part 8 — If you get stuck

- **Something looks broken:** open the browser, press F12, click "Console" — error messages appear there in red. Copy them.
- **Search the exact error** + "javascript" — someone has hit it before.
- **Change one thing at a time**, then refresh. If it breaks, you know what caused it.
- **GitHub saves every version** — you can always go back to a working snapshot.

---

## The one-paragraph summary

A website is a **dining room** (HTML/CSS/JS the browser shows), a **kitchen** (Firebase storing your data), a **waiter** (a Cloudflare Worker fetching data + handling uploads), and a **building** (Cloudflare hosting it at an address). You write the dining room in three languages, store data in labelled folders in Firebase, protect it with a guest-list rule, and push your files to GitHub which auto-publishes them. To add manga you just log into the admin and drag images in. That's the whole thing — everything else is polish.
