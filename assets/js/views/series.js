// =====================================================
// View: Series Detail — premium page with rating, reactions,
// share, bookmark, comments, related, and chapter list.
// =====================================================

import {
  fetchSeriesBySlug, fetchChapters, fetchAllSeries,
  fetchReactions, addReaction,
  fetchRating, submitRating,
  fetchComments, postComment, likeComment
} from '../lib/api.js';
import {
  isInLibrary, addToLibrary, removeFromLibrary,
  hasReacted, markReacted, hasRated, markRated,
  hasLikedComment, markCommentLiked, getReadChapters
} from '../lib/library.js';
import { esc, html, timeAgo, avatarLetter, compactNum } from '../lib/utils.js';
import { spinner, toast, share, confirmModal } from '../lib/ui.js';
import { seriesCard, statusBadge, emptyState } from './_components.js';

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
    return { title: 'Error · VoidScans' };
  }
  if (!s) {
    ctx.outlet.innerHTML = `<div class="container section">${emptyState({ icon: '∅', title: 'Series not found', cta: '<a href="/browse" class="btn btn-primary">Browse all</a>' })}</div>`;
    return { title: 'Not found · VoidScans' };
  }

  // Render shell first (instant), then enrich progressively
  ctx.outlet.innerHTML = renderShell(s);

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
    title: `${s.title} · VoidScans`,
    cleanup
  };
}

// =====================================================
// SHELL
// =====================================================
function renderShell(s) {
  const cover = esc(s.cover);
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
              <button class="btn btn-outline icon-btn" id="bookmarkBtn" aria-label="Add to library" title="Bookmark"></button>
              <button class="btn btn-outline icon-btn" id="shareBtn" aria-label="Share" title="Share">
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
          <div class="row gap-3" style="margin-top: var(--s-2); align-items: center;">
            <span class="field-hint" id="cCounter">0 / 1000</span>
            <span class="nav-spacer"></span>
            <button class="btn btn-primary" id="cSubmit">Post Comment</button>
          </div>
        </div>
        <div class="comments-list" id="commentList" style="margin-top: var(--s-5);">${spinner('sm')}</div>
      </section>

      <section style="margin-bottom: var(--s-8);" id="relatedSection" hidden>
        <div class="section-header">
          <h2 class="section-title">You might also like</h2>
        </div>
        <div class="card-grid" id="relatedGrid"></div>
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
    if (s.latestChapter > 0) location.assign(`/read/${encodeURIComponent(s.slug)}/${s.latestChapter}`);
  });
  document.getElementById('readFirstBtn')?.addEventListener('click', () => {
    location.assign(`/read/${encodeURIComponent(s.slug)}/1`);
  });

  // Share
  document.getElementById('shareBtn')?.addEventListener('click', async () => {
    await share({
      title: s.title,
      text: `Read ${s.title} on VoidScans`,
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
      toast('Removed from library', 'info');
    } else {
      await addToLibrary(s);
      toast('Added to library ⭐', 'success');
    }
    paintBookmark();
  });

  // Comment counter
  const cText = document.getElementById('cText');
  const counter = document.getElementById('cCounter');
  cText?.addEventListener('input', () => { counter.textContent = `${cText.value.length} / 1000`; });

  // Comment submit
  document.getElementById('cSubmit')?.addEventListener('click', async () => {
    const name = document.getElementById('cName').value.trim() || 'Anonymous';
    const text = cText.value.trim();
    const last = Number(localStorage.getItem('vs:lastComment') || 0);
    if (Date.now() - last < 60_000) { toast('Please wait a minute before commenting again', 'error'); return; }
    if (text.length < 2) { toast('Comment too short', 'error'); return; }
    try {
      await postComment(s.slug, { authorName: name, text });
      localStorage.setItem('vs:lastComment', String(Date.now()));
      cText.value = ''; counter.textContent = '0 / 1000';
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
          <div class="comment-text">${esc(c.text)}</div>
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
// RELATED
// =====================================================
function renderRelated(s, allSeries) {
  if (!allSeries.length) return;
  const myGenres = new Set((s.genres || []).map(g => g.toLowerCase()));
  const candidates = allSeries
    .filter(x => x.slug !== s.slug)
    .map(x => {
      const overlap = (x.genres || []).filter(g => myGenres.has(g.toLowerCase())).length;
      return { x, overlap };
    })
    .filter(r => r.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 6)
    .map(r => r.x);

  if (candidates.length === 0) return;
  const grid = document.getElementById('relatedGrid');
  document.getElementById('relatedSection').hidden = false;
  grid.innerHTML = candidates.map(s2 => seriesCard(s2)).join('');
}
