// =====================================================
// View: Series Detail — premium page with rating, reactions,
// share, bookmark, comments, related, and chapter list.
// =====================================================

import {
  fetchSeriesBySlug, fetchChapters, fetchAllSeries,
  fetchReactions, addReaction,
  fetchRating, submitRating,
  fetchComments, postComment, likeComment,
  trackSeriesView, adjustFollowers
} from '../lib/api.js';
import {
  isInLibrary, addToLibrary, removeFromLibrary,
  hasReacted, markReacted, hasRated, markRated,
  hasLikedComment, markCommentLiked, getReadChapters
} from '../lib/library.js';
import { getProfile } from '../lib/account.js';
import { esc, html, timeAgo, avatarLetter, compactNum, proxyImage, setMeta, truncate } from '../lib/utils.js';
import { spinner, toast, share, confirmModal } from '../lib/ui.js';
import { seriesCard, statusBadge, emptyState } from './_components.js';
import { SITE, pageTitle } from '../lib/site.config.js';
import { navigate } from '../lib/router.js';

const REACTIONS = [
  { key: 'fire',  emoji: '🔥', label: 'Fire' },
  { key: 'heart', emoji: '❤️', label: 'Love' },
  { key: 'star',  emoji: '⭐', label: 'Star' },
  { key: 'mind',  emoji: '🤯', label: 'Mind blown' },
  { key: 'sad',   emoji: '😢', label: 'Sad' }
];

export async function series(params, ctx) {
  const slug = params.slug;
  ctx.outlet.innerHTML = spinner();

  let s;
  try {
    s = await fetchSeriesBySlug(slug);
  } catch (e) {
    ctx.outlet.innerHTML = `<div class="container section">${emptyState({ icon: '⚠', title: 'Could not load series' })}</div>`;
    return { title: pageTitle('Error') };
  }
  if (!s) {
    ctx.outlet.innerHTML = `<div class="container section">${emptyState({ icon: '∅', title: 'Series not found', cta: '<a href="/browse" class="btn btn-primary">Browse all</a>' })}</div>`;
    return { title: pageTitle('Not found') };
  }

  // Render shell first (instant), then enrich progressively
  ctx.outlet.innerHTML = renderShell(s);

  // Inject JSON-LD structured data for SEO
  injectJsonLd(s);

  // Update per-route SEO meta (description, OG, Twitter, canonical)
  const seriesType = s.type ? s.type.charAt(0).toUpperCase() + s.type.slice(1) : 'Manhwa';
  const seriesDesc = truncate(
    `Read ${s.title} (${seriesType}) in English on ${SITE.name}. ` +
    ((s.genres || []).length ? `Genres: ${s.genres.slice(0, 4).join(', ')}. ` : '') +
    (s.description || ''),
    180
  );
  setMeta({
    title: `${s.title} - Read ${seriesType} English Free | ${SITE.name}`,
    description: seriesDesc,
    image: proxyImage(s.cover),
    url: location.href,
    type: 'book'
  });

  // Track view (sessioned, fail-silent if rules reject)
  trackSeriesView(slug).catch(() => {});

  // Wire up shell actions
  const cleanup = wireUpShell(s);

  // Async: chapters + reactions + rating + comments + related + read history
  Promise.all([
    fetchChapters(slug).catch(() => []),
    fetchReactions(slug).catch(() => null),
    fetchRating(slug).catch(() => null),
    fetchComments(slug, 30).catch(() => []),
    fetchAllSeries({ limitTo: 200 }).catch(() => []),
    getReadChapters(slug)
  ]).then(([chapters, reactions, rating, comments, allSeries, readSet]) => {
    renderChapters(s, chapters, readSet);
    renderReactions(s, reactions);
    renderRating(s, rating);
    renderComments(s, comments);
    renderRelated(s, allSeries);
  });

  return {
    title: `${s.title} - Read ${s.type ? s.type.charAt(0).toUpperCase() + s.type.slice(1) : 'Manhwa'} English Free | ${SITE.name}`,
    cleanup
  };
}

// =====================================================
// SHELL
// =====================================================
function renderShell(s) {
  const cover = esc(proxyImage(s.cover));
  const altTitles = (s.altTitles || []).filter(Boolean).join(', ');
  return html`
    <div class="series-hero">
      <div class="series-hero-bg" style="background-image: url('${cover}');"></div>
      <div class="series-hero-overlay"></div>
      <div class="container">
        <div class="series-grid">
          <div class="series-cover">
            <img src="${cover}" alt="${esc(s.title)}" loading="eager"
                 onerror="this.style.background='var(--surface-3)';this.removeAttribute('src');">
          </div>
          <div class="series-meta">
            <div class="row gap-2" style="flex-wrap: wrap;">
              ${statusBadge(s.status)}
              <span class="badge">${esc(s.type.toUpperCase())}</span>
              ${s.hot ? `<span class="badge badge-hot">HOT</span>` : ''}
              ${s.new ? `<span class="badge badge-new">NEW</span>` : ''}
            </div>
            <h1 class="series-title">${esc(s.title)}</h1>
            ${altTitles ? `<div class="series-alt">${esc(altTitles)}</div>` : ''}
            <div class="series-stats">
              ${s.author ? `<div class="stat"><span class="stat-label">Author</span><span class="stat-value">${esc(s.author)}</span></div>` : ''}
              ${s.year ? `<div class="stat"><span class="stat-label">Year</span><span class="stat-value">${esc(s.year)}</span></div>` : ''}
              ${s.latestChapter > 0 ? `<div class="stat"><span class="stat-label">Latest</span><span class="stat-value">Ch. ${esc(s.latestChapter)}</span></div>` : ''}
              <div class="stat" id="ratingDisplay" style="min-width:80px;">
                <span class="stat-label">Rating</span>
                <span class="stat-value">—</span>
              </div>
              <div class="stat" id="viewsDisplay" style="min-width:80px;">
                <span class="stat-label">Views</span>
                <span class="stat-value">${esc(compactNum(s.views || 0))}</span>
              </div>
              <div class="stat" id="followersDisplay" style="min-width:80px;">
                <span class="stat-label">Followers</span>
                <span class="stat-value">${esc(compactNum(s.followers || 0))}</span>
              </div>
            </div>
            ${(s.genres || []).length > 0 ? `
              <div class="tag-row">
                ${s.genres.map(g => `<a href="/genre/${esc(g.toLowerCase().replace(/\s+/g, '-'))}" class="tag-pill">${esc(g)}</a>`).join('')}
              </div>
            ` : ''}
            <div class="series-actions">
              <button class="btn btn-primary" id="readLatestBtn" ${s.latestChapter > 0 ? '' : 'disabled'}>
                ${s.latestChapter > 0 ? `Read Latest · Ch.${s.latestChapter}` : 'No chapters yet'}
              </button>
              <button class="btn btn-outline" id="readFirstBtn">Start from Ch.1</button>
              <button class="btn btn-outline btn-icon" id="bookmarkBtn" aria-label="Add to library" title="Bookmark">
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
</button>
<button class="btn btn-outline btn-icon" id="shareBtn" aria-label="Share" title="Share">

                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="container section">
      ${s.description ? `
        <section style="margin-bottom: var(--s-8);">
          <div class="series-desc" id="seriesDesc">${esc(s.description)}</div>
          <button class="desc-toggle" id="descToggle">Show more ↓</button>
        </section>
      ` : ''}

      <section style="margin-bottom: var(--s-8);">
        <div class="section-header" style="margin-bottom: var(--s-4);">
          <h2 class="section-title">Reactions</h2>
        </div>
        <div class="reaction-row" id="reactionRow">
          ${REACTIONS.map(r => `
            <button class="reaction-btn" data-key="${r.key}" aria-label="${r.label}">
              <span class="emoji">${r.emoji}</span>
              <span class="count">0</span>
            </button>
          `).join('')}
        </div>
      </section>

      <section style="margin-bottom: var(--s-8);">
        <div class="section-header" style="margin-bottom: var(--s-4);">
          <h2 class="section-title">Rate this series</h2>
        </div>
        <div class="row gap-4" style="align-items: center; flex-wrap: wrap;">
          <div class="rating-stars" id="rateInput" data-hover="">
            ${[1,2,3,4,5].map(n => `
              <button data-n="${n}" aria-label="${n} stars">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>
              </button>
            `).join('')}
          </div>
          <div class="rating-display">
            <span class="num" id="ratingNum">—</span>
            <span class="total" id="ratingTotal">No ratings yet</span>
          </div>
        </div>
      </section>

      <section style="margin-bottom: var(--s-8);">
        <div class="section-header">
          <h2 class="section-title">Chapters</h2>
          <div class="row gap-2">
            <button class="btn btn-ghost btn-sm" id="sortChaps" data-order="desc">Newest first ↓</button>
          </div>
        </div>
        <div class="chapter-list" id="chapterList">
          ${spinner('sm')}
        </div>
      </section>

      <section style="margin-bottom: var(--s-8);">
        <div class="section-header" style="margin-bottom: var(--s-4);">
          <h2 class="section-title">Comments</h2>
          <span class="results-count" id="commentCount"></span>
        </div>
        <div id="commentForm">
          <div class="field-row">
            <input type="text" class="input" id="cName" placeholder="Your name (optional)" maxlength="40">
            <div></div>
          </div>
          <textarea class="textarea" id="cText" placeholder="Share your thoughts… (2–1000 chars)" maxlength="1000"></textarea>
          <div id="cGifPreview" style="display:none; margin-top: var(--s-2);">
            <div style="position:relative; display:inline-block;">
              <img id="cGifImg" src="" alt="GIF" style="max-width:200px; border-radius: var(--r-sm); border: 1px solid var(--border);">
              <button type="button" id="cGifRemove" style="position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.8); color:var(--danger); border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:12px;">✕</button>
            </div>
          </div>
          <div class="row gap-3" style="margin-top: var(--s-2); align-items: center;">
            <button type="button" class="btn btn-secondary btn-sm" id="cGifBtn" title="Add GIF" style="font-size: var(--fs-sm);">🎬 GIF</button>
            <span class="field-hint" id="cCounter">0 / 1000</span>
            <span class="nav-spacer"></span>
            <button class="btn btn-primary" id="cSubmit">Post Comment</button>
          </div>
          <div id="cGifPicker" hidden style="margin-top: var(--s-3); padding: var(--s-3); background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-md);">
            <input type="text" class="input" id="cGifSearch" placeholder="Search GIFs..." style="margin-bottom: var(--s-3);">
            <div id="cGifGrid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: var(--s-2); max-height: 250px; overflow-y: auto;"></div>
            <p style="font-size: 10px; color: var(--text-faint); margin-top: var(--s-2); text-align:right;">Powered by Tenor</p>
          </div>
        </div>
        <div class="comments-list" id="commentList" style="margin-top: var(--s-5);">${spinner('sm')}</div>
      </section>

      <!-- Recommendations / discovery footer — always renders something -->
      <section class="cv-deferred" style="margin-bottom: var(--s-6);" id="relatedSection" hidden>
        <div class="section-header">
          <h2 class="section-title" id="relatedTitle">You might also like</h2>
          <span class="section-link" id="relatedSubtitle"></span>
        </div>
        <div class="card-grid" id="relatedGrid"></div>
      </section>

      <section class="cv-deferred" style="margin-bottom: var(--s-8);" id="latestSection" hidden>
        <div class="section-header">
          <h2 class="section-title">Latest Updates</h2>
          <a href="/browse?sort=updated" class="section-link">View all →</a>
        </div>
        <div class="update-list" id="latestList"></div>
      </section>
    </div>
  `;
}

// =====================================================
// SHELL WIRE-UP (interactivity that doesn't need data)
// =====================================================
function wireUpShell(s) {
  // Description toggle
  const desc = document.getElementById('seriesDesc');
  const toggle = document.getElementById('descToggle');
  if (desc && toggle) {
    // Show toggle only if content overflows
    requestAnimationFrame(() => {
      if (desc.scrollHeight <= desc.clientHeight + 4) toggle.style.display = 'none';
    });
    toggle.addEventListener('click', () => {
      const expanded = desc.classList.toggle('expanded');
      toggle.textContent = expanded ? 'Show less ↑' : 'Show more ↓';
    });
  }

  // Read buttons
  document.getElementById('readLatestBtn')?.addEventListener('click', () => {
    if (s.latestChapter > 0) navigate(`/read/${encodeURIComponent(s.slug)}/${s.latestChapter}`);
  });
  document.getElementById('readFirstBtn')?.addEventListener('click', () => {
    navigate(`/read/${encodeURIComponent(s.slug)}/1`);
  });

  // Share
  document.getElementById('shareBtn')?.addEventListener('click', async () => {
    await share({
      title: s.title,
      text: `Read ${s.title} on ${SITE.name}`,
      url: location.href
    });
  });

  // Bookmark
  const bmBtn = document.getElementById('bookmarkBtn');
  async function paintBookmark() {
    const inLib = await isInLibrary(s.slug);
    bmBtn.classList.toggle('active', inLib);
    bmBtn.innerHTML = inLib
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
    bmBtn.style.color = inLib ? 'var(--accent)' : '';
  }
  paintBookmark();
  bmBtn?.addEventListener('click', async () => {
    const inLib = await isInLibrary(s.slug);
    if (inLib) {
      await removeFromLibrary(s.slug);
      adjustFollowers(s.slug, -1).catch(() => {});
      const fd = document.getElementById('followersDisplay');
      if (fd) {
        const sv = fd.querySelector('.stat-value');
        sv.textContent = compactNum(Math.max(0, (s.followers || 0) - 1));
        s.followers = Math.max(0, (s.followers || 0) - 1);
      }
      toast('Removed from library', 'info');
    } else {
      await addToLibrary(s);
      adjustFollowers(s.slug, +1).catch(() => {});
      const fd = document.getElementById('followersDisplay');
      if (fd) {
        const sv = fd.querySelector('.stat-value');
        sv.textContent = compactNum((s.followers || 0) + 1);
        s.followers = (s.followers || 0) + 1;
      }
      toast('Added to library ⭐', 'success');
    }
    paintBookmark();
  });

  // Comment counter
  const cText = document.getElementById('cText');
  const counter = document.getElementById('cCounter');
  cText?.addEventListener('input', () => { counter.textContent = `${cText.value.length} / 1000`; });

  // Pre-fill comment name from signed-in profile if available
  const profile = getProfile();
  if (profile?.displayName) {
    const nameInput = document.getElementById('cName');
    if (nameInput && !nameInput.value) nameInput.value = profile.displayName;
  }

  // GIF Picker
  let selectedGif = '';
  const gifBtn = document.getElementById('cGifBtn');
  const gifPicker = document.getElementById('cGifPicker');
  const gifSearch = document.getElementById('cGifSearch');
  const gifGrid = document.getElementById('cGifGrid');
  const gifPreview = document.getElementById('cGifPreview');
  const gifImg = document.getElementById('cGifImg');
  const gifRemove = document.getElementById('cGifRemove');

  // Tenor API (free tier, key is public/rate-limited)
  const TENOR_KEY = 'AIzaSyA3gT_cGL5fgFgYdWMYUjblrHhZyPEaFpU'; // Google's public Tenor key
  const TENOR_API = 'https://tenor.googleapis.com/v2';

  gifBtn?.addEventListener('click', () => {
    gifPicker.hidden = !gifPicker.hidden;
    if (!gifPicker.hidden) { gifSearch.focus(); loadTrendingGifs(); }
  });

  gifRemove?.addEventListener('click', () => {
    selectedGif = '';
    gifPreview.style.display = 'none';
    gifImg.src = '';
  });

  async function loadTrendingGifs() {
    try {
      const res = await fetch(`${TENOR_API}/featured?key=${TENOR_KEY}&limit=20&media_filter=tinygif`);
      const data = await res.json();
      renderGifResults(data.results || []);
    } catch {}
  }

  let gifSearchTimeout;
  gifSearch?.addEventListener('input', () => {
    clearTimeout(gifSearchTimeout);
    gifSearchTimeout = setTimeout(async () => {
      const q = gifSearch.value.trim();
      if (!q) { loadTrendingGifs(); return; }
      try {
        const res = await fetch(`${TENOR_API}/search?key=${TENOR_KEY}&q=${encodeURIComponent(q)}&limit=20&media_filter=tinygif`);
        const data = await res.json();
        renderGifResults(data.results || []);
      } catch {}
    }, 400);
  });

  function renderGifResults(results) {
    gifGrid.innerHTML = results.map(r => {
      const url = r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || '';
      if (!url) return '';
      return `<img src="${esc(url)}" alt="GIF" loading="lazy" style="width:100%; border-radius:4px; cursor:pointer; aspect-ratio:1; object-fit:cover;" data-gif="${esc(url)}">`;
    }).join('');
    gifGrid.querySelectorAll('[data-gif]').forEach(img => {
      img.addEventListener('click', () => {
        selectedGif = img.dataset.gif;
        gifImg.src = selectedGif;
        gifPreview.style.display = 'block';
        gifPicker.hidden = true;
        gifSearch.value = '';
      });
    });
  }

  // Comment submit
  document.getElementById('cSubmit')?.addEventListener('click', async () => {
    const name = document.getElementById('cName').value.trim() || 'Anonymous';
    let text = cText.value.trim();
    // Append GIF URL to comment text if selected
    if (selectedGif) text = (text ? text + '\n' : '') + `[gif:${selectedGif}]`;
    const last = Number(localStorage.getItem('vs:lastComment') || 0);
    if (Date.now() - last < 60_000) { toast('Please wait a minute before commenting again', 'error'); return; }
    if (text.length < 2 && !selectedGif) { toast('Comment too short', 'error'); return; }
    try {
      await postComment(s.slug, { authorName: name, text });
      localStorage.setItem('vs:lastComment', String(Date.now()));
      cText.value = ''; counter.textContent = '0 / 1000';
      selectedGif = ''; gifPreview.style.display = 'none'; gifImg.src = '';
      toast('Posted!', 'success');
      const list = await fetchComments(s.slug, 30);
      renderComments(s, list);
    } catch (e) {
      console.error(e);
      toast(e.message || 'Could not post', 'error');
    }
  });

  return () => {};
}

// =====================================================
// CHAPTERS
// =====================================================
function renderChapters(s, chapters, readSet) {
  const list = document.getElementById('chapterList');
  if (!list) return;
  if (chapters.length === 0) {
    list.innerHTML = emptyState({ icon: '📖', title: 'No chapters yet', subtitle: 'Check back soon.' });
    return;
  }
  let order = 'desc';
  function paint() {
    const chs = [...chapters].sort((a, b) => order === 'desc' ? b.number - a.number : a.number - b.number);
    list.innerHTML = chs.map(c => {
      const read = readSet?.has(Number(c.number));
      const date = c.createdAt?.toDate ? timeAgo(c.createdAt.toDate()) : '';
      return `
        <a href="/read/${encodeURIComponent(s.slug)}/${c.number}" class="chapter-row ${read ? 'read' : ''}">
          <div class="chapter-num">Ch. ${esc(c.number)}</div>
          <div class="chapter-title-text">${esc(c.title || '')}</div>
          <div class="chapter-date">${esc(date)}</div>
          ${!read && c.number === Math.max(...chapters.map(x => x.number)) ? `<span class="chapter-new-dot" title="New"></span>` : ''}
        </a>
      `;
    }).join('');
  }
  paint();
  document.getElementById('sortChaps')?.addEventListener('click', () => {
    order = order === 'desc' ? 'asc' : 'desc';
    document.getElementById('sortChaps').textContent = order === 'desc' ? 'Newest first ↓' : 'Oldest first ↑';
    paint();
  });
}

// =====================================================
// REACTIONS
// =====================================================
function renderReactions(s, reactions) {
  if (!reactions) return;
  const row = document.getElementById('reactionRow');
  const userReacted = hasReacted(s.slug);
  REACTIONS.forEach(r => {
    const btn = row.querySelector(`[data-key="${r.key}"]`);
    if (!btn) return;
    btn.querySelector('.count').textContent = compactNum(reactions[r.key] || 0);
    if (userReacted === r.key) btn.classList.add('active');
    btn.addEventListener('click', async () => {
      if (hasReacted(s.slug)) { toast('You already reacted', 'info'); return; }
      try {
        await addReaction(s.slug, r.key);
        markReacted(s.slug, r.key);
        const span = btn.querySelector('.count');
        const cur = parseInt(span.textContent.replace(/[^0-9]/g, '') || '0', 10);
        span.textContent = compactNum(cur + 1);
        btn.classList.add('active');
        toast(`Thanks for the ${r.label.toLowerCase()}!`, 'success');
      } catch {
        toast('Could not save reaction', 'error');
      }
    });
  });
}

// =====================================================
// RATING
// =====================================================
function renderRating(s, rating) {
  if (!rating) return;
  const userRating = hasRated(s.slug);
  const num = document.getElementById('ratingNum');
  const total = document.getElementById('ratingTotal');
  const display = document.getElementById('ratingDisplay');

  function paintTotals() {
    num.textContent = (rating.average || 0).toFixed(1);
    total.textContent = rating.total > 0 ? `${rating.total} rating${rating.total === 1 ? '' : 's'}` : 'No ratings yet';
    if (display) display.querySelector('.stat-value').textContent = `★ ${rating.average ? rating.average.toFixed(1) : '–'}`;
  }
  paintTotals();

  const stars = document.querySelectorAll('#rateInput button');
  function paintStars(n) {
    stars.forEach((b, i) => b.classList.toggle('filled', i < n));
  }
  if (userRating) paintStars(userRating);

  stars.forEach((b, i) => {
    b.addEventListener('mouseenter', () => paintStars(i + 1));
    b.addEventListener('mouseleave', () => paintStars(userRating || Math.round(rating.average)));
    b.addEventListener('click', async () => {
      if (hasRated(s.slug)) { toast('You already rated this', 'info'); return; }
      try {
        await submitRating(s.slug, i + 1);
        markRated(s.slug, i + 1);
        rating.total = (rating.total || 0) + 1;
        rating.average = ((rating.average * (rating.total - 1)) + (i + 1)) / rating.total;
        paintTotals();
        paintStars(i + 1);
        toast(`Rated ${i + 1} stars`, 'success');
      } catch {
        toast('Could not save rating', 'error');
      }
    });
  });
}

// =====================================================
// COMMENTS
// =====================================================

/** Format comment text: escape HTML but render [gif:URL] as inline images */
function formatCommentText(text) {
  if (!text) return '';
  // Extract GIF URLs
  const gifRegex = /\[gif:(https?:\/\/[^\]]+)\]/g;
  const parts = text.split(gifRegex);
  let result = '';
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      // Normal text — escape it
      result += esc(parts[i]);
    } else {
      // GIF URL — render as image
      result += `<img src="${esc(parts[i])}" alt="GIF" class="comment-gif" loading="lazy" referrerpolicy="no-referrer">`;
    }
  }
  return result;
}

function renderComments(s, list) {
  const container = document.getElementById('commentList');
  document.getElementById('commentCount').innerHTML = `<strong>${list.length}</strong> comment${list.length === 1 ? '' : 's'}`;
  if (!list.length) {
    container.innerHTML = emptyState({ icon: '💬', title: 'Be the first to comment!' });
    return;
  }
  container.innerHTML = list.map(c => {
    const ts = c.createdAt?.toDate ? timeAgo(c.createdAt.toDate()) : '';
    const liked = hasLikedComment(c.id);
    return `
      <article class="comment">
        <div class="comment-avatar" aria-hidden="true">${esc(avatarLetter(c.authorName))}</div>
        <div class="comment-body">
          <div class="comment-head">
            <span class="comment-name">${esc(c.authorName || 'Anonymous')}</span>
            <span class="comment-time">${esc(ts)}</span>
          </div>
          <div class="comment-text">${formatCommentText(c.text)}</div>
          <div class="comment-actions">
            <button class="comment-action ${liked ? 'active' : ''}" data-like="${esc(c.id)}">
              👍 <span>${esc(c.likes || 0)}</span>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  container.querySelectorAll('[data-like]').forEach(b => {
    b.addEventListener('click', async () => {
      const id = b.dataset.like;
      if (hasLikedComment(id)) { toast('Already liked', 'info'); return; }
      try {
        await likeComment(s.slug, id);
        markCommentLiked(id);
        const span = b.querySelector('span');
        span.textContent = String(Number(span.textContent) + 1);
        b.classList.add('active');
      } catch {
        toast('Could not like', 'error');
      }
    });
  });
}

// =====================================================
// JSON-LD STRUCTURED DATA (SEO)
// Adds a Schema.org Book entity so search engines understand the page.
// =====================================================
function injectJsonLd(s) {
  // Remove any previous JSON-LD from older route
  document.querySelectorAll('script[data-vs-jsonld]').forEach(el => el.remove());
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: s.title,
    alternateName: s.altTitles && s.altTitles.length ? s.altTitles : undefined,
    image: s.cover,
    description: s.description,
    bookFormat: 'GraphicNovel',
    author: s.author ? { '@type': 'Person', name: s.author } : undefined,
    illustrator: s.artist ? { '@type': 'Person', name: s.artist } : undefined,
    datePublished: s.year ? String(s.year) : undefined,
    genre: s.genres && s.genres.length ? s.genres : undefined,
    inLanguage: 'en',
    aggregateRating: (s.rating?.total > 0) ? {
      '@type': 'AggregateRating',
      ratingValue: Number((s.rating.average || 0).toFixed(2)),
      ratingCount: s.rating.total,
      bestRating: 5,
      worstRating: 1
    } : undefined,
    url: location.href
  };
  // Strip undefined keys
  Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.dataset.vsJsonld = '1';
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

// =====================================================
// RELATED + LATEST UPDATES (discovery strip at bottom of series page)
// =====================================================
function renderRelated(s, allSeries) {
  if (!allSeries.length) return;
  const myGenres = new Set((s.genres || []).map(g => g.toLowerCase()));
  const others = allSeries.filter(x => x.slug !== s.slug);

  // 1) Best matches: shared genres, ranked by overlap (then by views/followers)
  let candidates = others
    .map(x => ({
      x,
      overlap: (x.genres || []).filter(g => myGenres.has(g.toLowerCase())).length
    }))
    .filter(r => r.overlap > 0)
    .sort((a, b) => {
      if (b.overlap !== a.overlap) return b.overlap - a.overlap;
      return (b.x.views || 0) - (a.x.views || 0);
    })
    .map(r => r.x);

  let titleText = 'You might also like';
  let subtitle = '';

  // 2) Same type fallback: when no genre overlap, recommend by type (manhwa/manga/manhua)
  if (candidates.length === 0 && s.type) {
    candidates = others
      .filter(x => x.type === s.type)
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 12);
    titleText = `More ${s.type.charAt(0).toUpperCase() + s.type.slice(1)}`;
  }

  // 3) Last-resort fallback: top series by views/popular
  if (candidates.length === 0) {
    candidates = others
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 12);
    titleText = 'Popular Series';
  }

  // Cap at 6 cards (matches a typical row on desktop)
  candidates = candidates.slice(0, 6);
  if (candidates.length === 0) return;

  const sec = document.getElementById('relatedSection');
  const titleEl = document.getElementById('relatedTitle');
  const subEl = document.getElementById('relatedSubtitle');
  const grid = document.getElementById('relatedGrid');
  if (!sec || !grid) return;

  if (titleEl) titleEl.textContent = titleText;
  if (subEl) subEl.textContent = subtitle;
  grid.innerHTML = candidates.map(s2 => seriesCard(s2)).join('');
  sec.hidden = false;

  // Also render a "Latest Updates" strip below — global discovery, helpful
  // for fresh sites with few series and a great way to keep readers in the
  // catalog after they finish a chapter.
  renderLatestUpdates(s, allSeries);
}

function renderLatestUpdates(currentSeries, allSeries) {
  const sec = document.getElementById('latestSection');
  const list = document.getElementById('latestList');
  if (!sec || !list) return;

  // Most-recently-updated series, excluding the current one. Cap at 6.
  const items = allSeries
    .filter(x => x.slug !== currentSeries.slug && x.latestChapter > 0)
    .sort((a, b) => {
      const at = toMs(a.latestChapterAt);
      const bt = toMs(b.latestChapterAt);
      return bt - at;
    })
    .slice(0, 6);

  if (items.length === 0) return;

  list.innerHTML = items.map(s2 => updateRowFor(s2)).join('');
  sec.hidden = false;
}

function toMs(t) {
  if (!t) return 0;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (typeof t === 'string' || typeof t === 'number') return new Date(t).getTime() || 0;
  return 0;
}

// Compact "update row" — series with its latest chapter prominently shown
function updateRowFor(s2) {
  return `
    <a href="/read/${esc(s2.slug)}/${esc(s2.latestChapter)}" class="update-row" aria-label="${esc(s2.title)} chapter ${esc(s2.latestChapter)}">
      <div class="update-cover">
        <img src="${esc(proxyImage(s2.cover) || '')}" alt="${esc(s2.title)}" loading="lazy" decoding="async"
             onerror="this.style.background='var(--surface-3)';this.removeAttribute('src');">
      </div>
      <div class="update-meta">
        <div class="update-title">${esc(s2.title)}</div>
        <div class="update-chapter">Ch. ${esc(s2.latestChapter)}</div>
      </div>
      <div class="update-time">${esc(timeAgo(toMs(s2.latestChapterAt)))}</div>
    </a>
  `;
}
