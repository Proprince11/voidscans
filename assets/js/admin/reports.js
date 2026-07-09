// Admin: Reports — engagement & content analytics
import {
  fetchAllSeries, fetchChapters, fetchReactions, fetchRating, fetchComments, cacheBust
} from '../lib/api.js';
import { esc, html, timeAgo, compactNum } from '../lib/utils.js';
import { spinner, toast } from '../lib/ui.js';

export async function reports({ outlet, navigate }) {
  outlet.innerHTML = html`
    <header class="admin-header">
      <h1>Reports</h1>
      <span class="text-muted" style="font-size: var(--fs-sm);">Engagement & content analytics</span>
    </header>
    ${spinner()}
  `;

  // Load series first
  let allSeries = [];
  try { allSeries = await fetchAllSeries({ limitTo: 500, includeUnpublished: true }); }
  catch (e) {
    outlet.innerHTML = `<header class="admin-header"><h1>Reports</h1></header><div class="empty-state"><h3>Failed to load</h3><p>${esc(e.message)}</p></div>`;
    return;
  }

  if (allSeries.length === 0) {
    outlet.innerHTML = html`
      <header class="admin-header"><h1>Reports</h1></header>
      <div class="empty-state">
        <div class="icon">📊</div>
        <h3>No data yet</h3>
        <p>Add some series and chapters to see reports.</p>
        <a href="#series" class="btn btn-primary" style="margin-top: var(--s-3);">Create First Series</a>
      </div>
    `;
    return;
  }

  // Enrich each series with reactions, rating, comments, chapter list (parallel + cached)
  const enriched = await Promise.all(
    allSeries.map(async (s) => {
      const [reactions, rating, comments, chapters] = await Promise.all([
        fetchReactions(s.slug).catch(() => ({})),
        fetchRating(s.slug).catch(() => ({ average: 0, total: 0, distribution: [0,0,0,0,0] })),
        fetchComments(s.slug, 100).catch(() => []),
        fetchChapters(s.slug, { includeUnpublished: true }).catch(() => [])
      ]);
      const reactionTotal = Object.values(reactions || {}).reduce((a, b) => a + (Number(b) || 0), 0);
      return {
        ...s,
        chaptersCount: chapters.length,
        chapters,
        reactions: reactions || {},
        reactionTotal,
        commentCount: comments.length,
        comments,
        rating: rating || { average: 0, total: 0 }
      };
    })
  );

  // Aggregates
  const totalReactions = enriched.reduce((a, e) => a + e.reactionTotal, 0);
  const totalComments = enriched.reduce((a, e) => a + e.commentCount, 0);
  const totalRatings = enriched.reduce((a, e) => a + (e.rating.total || 0), 0);
  const totalChapters = enriched.reduce((a, e) => a + e.chaptersCount, 0);

  // Time-bucketed activity
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const allChapters = enriched.flatMap(e =>
    e.chapters.map(c => ({ ...c, seriesSlug: e.slug, seriesTitle: e.title }))
  );
  const allComments = enriched.flatMap(e =>
    e.comments.map(c => ({ ...c, seriesSlug: e.slug, seriesTitle: e.title }))
  );

  const ts = (t) => t?.toMillis ? t.toMillis() : (t?.seconds ? t.seconds * 1000 : 0);

  const chaptersThisWeek = allChapters.filter(c => ts(c.createdAt) > now - 7 * day).length;
  const commentsThisWeek = allComments.filter(c => ts(c.createdAt) > now - 7 * day).length;

  const recentChapters = [...allChapters]
    .sort((a, b) => ts(b.createdAt) - ts(a.createdAt))
    .slice(0, 10);

  const recentComments = [...allComments]
    .sort((a, b) => ts(b.createdAt) - ts(a.createdAt))
    .slice(0, 10);

  // Top performers
  const topByRating    = [...enriched].filter(e => (e.rating.total || 0) > 0)
    .sort((a, b) => (b.rating.average || 0) - (a.rating.average || 0)).slice(0, 5);
  const topByReactions = [...enriched].filter(e => e.reactionTotal > 0)
    .sort((a, b) => b.reactionTotal - a.reactionTotal).slice(0, 5);
  const topByComments  = [...enriched].filter(e => e.commentCount > 0)
    .sort((a, b) => b.commentCount - a.commentCount).slice(0, 5);
  const mostChapters   = [...enriched].filter(e => e.chaptersCount > 0)
    .sort((a, b) => b.chaptersCount - a.chaptersCount).slice(0, 5);

  // Status breakdown
  const statusOrder = ['ongoing', 'completed', 'hiatus', 'dropped'];
  const statusBreakdown = enriched.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});

  // Genre popularity
  const genreCount = {};
  enriched.forEach(e => (e.genres || []).forEach(g => {
    genreCount[g] = (genreCount[g] || 0) + 1;
  }));
  const topGenres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]).slice(0, 12);

  // Reaction breakdown (sum across series)
  const reactionBreakdown = enriched.reduce((acc, e) => {
    Object.entries(e.reactions).forEach(([k, v]) => {
      acc[k] = (acc[k] || 0) + (Number(v) || 0);
    });
    return acc;
  }, {});
  const reactionEmoji = { fire: '🔥', heart: '❤️', star: '⭐', mind: '🤯', sad: '😢' };

  outlet.innerHTML = html`
    <header class="admin-header">
      <h1>Reports</h1>
      <button class="btn btn-ghost" id="refreshReports">⟳ Refresh</button>
    </header>

    <!-- Summary stats -->
    <div class="admin-stats">
      <div class="stat-card">
        <div class="stat-label">Total Series</div>
        <div class="stat-value">${esc(compactNum(allSeries.length))}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Chapters</div>
        <div class="stat-value">${esc(compactNum(totalChapters))}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Reactions</div>
        <div class="stat-value">${esc(compactNum(totalReactions))}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Ratings</div>
        <div class="stat-value">${esc(compactNum(totalRatings))}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Comments</div>
        <div class="stat-value">${esc(compactNum(totalComments))}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Activity (7d)</div>
        <div class="stat-value">${esc(compactNum(chaptersThisWeek + commentsThisWeek))}</div>
        <div class="text-muted" style="font-size: var(--fs-xs); margin-top: 4px;">
          ${esc(chaptersThisWeek)} chapters · ${esc(commentsThisWeek)} comments
        </div>
      </div>
    </div>

    <!-- Top performers grid -->
    <div class="report-grid">
      ${reportSection('Top by Rating ★', topByRating, 'rating')}
      ${reportSection('Top by Reactions 🔥', topByReactions, 'reactions')}
      ${reportSection('Most Discussed 💬', topByComments, 'comments')}
      ${reportSection('Most Chapters 📖', mostChapters, 'chapters')}
    </div>

    <!-- Reaction breakdown -->
    ${totalReactions > 0 ? html`
      <div class="admin-card" style="margin-top: var(--s-5);">
        <h3 style="margin-bottom: var(--s-3);">Reaction Breakdown</h3>
        <div class="row gap-4" style="flex-wrap: wrap;">
          ${Object.entries(reactionEmoji).map(([k, emoji]) => `
            <div class="row gap-2" style="align-items: center;">
              <span style="font-size: 24px; line-height: 1;">${emoji}</span>
              <strong style="font-size: var(--fs-lg);">${esc(compactNum(reactionBreakdown[k] || 0))}</strong>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Status breakdown -->
    <div class="admin-card" style="margin-top: var(--s-5);">
      <h3 style="margin-bottom: var(--s-3);">Series by Status</h3>
      <div class="row gap-4" style="flex-wrap: wrap;">
        ${statusOrder.map(status => {
          const count = statusBreakdown[status] || 0;
          if (count === 0) return '';
          return `
            <div class="row gap-2" style="align-items: center;">
              <span class="badge badge-${esc(status)}">${esc(status)}</span>
              <strong style="font-size: var(--fs-base);">${esc(count)}</strong>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Top genres -->
    ${topGenres.length > 0 ? html`
      <div class="admin-card" style="margin-top: var(--s-5);">
        <h3 style="margin-bottom: var(--s-3);">Top Genres</h3>
        <div class="row gap-2" style="flex-wrap: wrap;">
          ${topGenres.map(([genre, count]) => `
            <span class="tag-pill">${esc(genre)} <strong style="color: var(--accent); margin-left: 4px;">${count}</strong></span>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Activity feed -->
    <div class="report-grid" style="margin-top: var(--s-5);">
      <div class="admin-card">
        <h3 style="margin-bottom: var(--s-3);">Recent Chapters Published</h3>
        ${recentChapters.length === 0 ? `<p class="text-muted">No chapters yet.</p>` : `
          <table class="admin-table">
            <thead><tr><th>Series</th><th>Ch</th><th>When</th></tr></thead>
            <tbody>
              ${recentChapters.map(c => `
                <tr>
                  <td><strong>${esc(c.seriesTitle)}</strong></td>
                  <td>Ch.${esc(c.number)}${c.title ? ` — ${esc(c.title.slice(0, 30))}${c.title.length > 30 ? '…' : ''}` : ''}</td>
                  <td class="text-muted" style="white-space: nowrap;">${esc(c.createdAt?.toDate ? timeAgo(c.createdAt.toDate()) : '—')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>

      <div class="admin-card">
        <h3 style="margin-bottom: var(--s-3);">Recent Comments</h3>
        ${recentComments.length === 0 ? `<p class="text-muted">No comments yet.</p>` : `
          <table class="admin-table">
            <thead><tr><th>Series</th><th>Comment</th><th>When</th></tr></thead>
            <tbody>
              ${recentComments.map(c => `
                <tr>
                  <td><strong>${esc(c.seriesTitle)}</strong></td>
                  <td><em>"${esc(c.text.slice(0, 60))}${c.text.length > 60 ? '…' : ''}"</em><br><small class="text-muted">— ${esc(c.authorName || 'Anonymous')}</small></td>
                  <td class="text-muted" style="white-space: nowrap;">${esc(c.createdAt?.toDate ? timeAgo(c.createdAt.toDate()) : '—')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    </div>

    <!-- Cloudflare Web Analytics CTA -->
    <div class="admin-card" style="margin-top: var(--s-5);">
      <h3 style="margin-bottom: var(--s-3);">Traffic Analytics</h3>
      <p class="text-muted" style="margin-bottom: var(--s-3); font-size: var(--fs-sm);">
        For page views, unique visitors, country breakdown, top pages, and bounce rates,
        use Cloudflare Web Analytics — free, no cookies, no privacy compliance hassle.
        Enable it once in your Cloudflare dashboard.
      </p>
      <div class="row gap-3" style="flex-wrap: wrap;">
        <a href="https://dash.cloudflare.com/?to=/:account/web-analytics"
           target="_blank" rel="noopener" class="btn btn-primary">
          Open Cloudflare Web Analytics →
        </a>
        <a href="https://developers.cloudflare.com/web-analytics/get-started/"
           target="_blank" rel="noopener" class="btn btn-ghost">
          Setup guide
        </a>
      </div>
    </div>

    <!-- Coming soon (Phase 2 metrics) -->
    <div class="admin-card" style="margin-top: var(--s-5); opacity: 0.7;">
      <h3 style="margin-bottom: var(--s-3);">Coming in Phase 2</h3>
      <ul class="text-muted" style="font-size: var(--fs-sm); line-height: 1.8; padding-left: var(--s-5);">
        <li>Per-chapter view counts (read-through rate)</li>
        <li>Daily / weekly trend charts</li>
        <li>User retention (when accounts are wired up)</li>
        <li>Bookmark / library size per series (followers)</li>
        <li>Dropped-off chapter detection (where readers stop)</li>
      </ul>
    </div>
  `;

  document.getElementById('refreshReports').addEventListener('click', () => {
    cacheBust('');
    toast('Cache cleared, reloading…', 'info');
    reports({ outlet, navigate });
  });
}

function reportSection(title, items, type) {
  if (!items.length) {
    return `
      <div class="admin-card">
        <h3 style="margin-bottom: var(--s-3);">${esc(title)}</h3>
        <p class="text-muted" style="font-size: var(--fs-sm);">No data yet.</p>
      </div>
    `;
  }
  return `
    <div class="admin-card">
      <h3 style="margin-bottom: var(--s-3);">${esc(title)}</h3>
      <ol style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--s-2);">
        ${items.map((s, i) => `
          <li style="display: flex; align-items: center; gap: var(--s-3); padding: var(--s-2); background: var(--surface-2); border-radius: var(--r-sm);">
            <span class="text-muted" style="min-width: 22px; font-weight: var(--fw-bold);">#${i + 1}</span>
            <a href="/series/${esc(s.slug)}" target="_blank" rel="noopener" style="flex: 1; color: var(--text); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${esc(s.title)}</a>
            <strong style="color: var(--accent); white-space: nowrap;">${esc(formatMetric(s, type))}</strong>
          </li>
        `).join('')}
      </ol>
    </div>
  `;
}

function formatMetric(s, type) {
  switch (type) {
    case 'rating':    return `★ ${(s.rating.average || 0).toFixed(1)} (${s.rating.total || 0})`;
    case 'reactions': return compactNum(s.reactionTotal);
    case 'comments': return compactNum(s.commentCount);
    case 'chapters':  return compactNum(s.chaptersCount);
    default: return '';
  }
}
