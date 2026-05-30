// Admin: Dashboard (stats overview)
import { fetchStats, fetchAllSeries } from '../lib/api.js';
import { esc, html, timeAgo, compactNum } from '../lib/utils.js';
import { spinner } from '../lib/ui.js';
import { getUser } from '../lib/auth.js';

export async function dashboard({ outlet }) {
  outlet.innerHTML = html`
    <header class="admin-header">
      <h1>Dashboard</h1>
      <span class="text-muted" style="font-size: var(--fs-sm);">Hi, ${esc(getUser()?.email || 'Admin')}</span>
    </header>
    ${spinner()}
  `;

  const [stats, all] = await Promise.all([
    fetchStats().catch(() => ({})),
    fetchAllSeries({ limitTo: 50 }).catch(() => [])
  ]);

  const recent = [...all].sort((a, b) => toMs(b.updatedAt || b.createdAt) - toMs(a.updatedAt || a.createdAt)).slice(0, 8);

  outlet.innerHTML = html`
    <header class="admin-header">
      <h1>Dashboard</h1>
      <a href="#series" class="btn btn-primary">+ New Series</a>
    </header>

    <div class="admin-stats">
      <div class="stat-card">
        <div class="stat-label">Total Series</div>
        <div class="stat-value">${esc(compactNum(stats.seriesCount || 0))}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Chapters</div>
        <div class="stat-value">${esc(compactNum(stats.chapterCount || 0))}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Ongoing</div>
        <div class="stat-value">${esc(compactNum(stats.ongoing || 0))}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Completed</div>
        <div class="stat-value">${esc(compactNum(stats.completed || 0))}</div>
      </div>
    </div>

    <div class="admin-card" style="margin-bottom: var(--s-5);">
      <div class="row gap-3" style="margin-bottom: var(--s-4);">
        <h3 style="margin:0;">Recently Updated</h3>
        <span class="nav-spacer"></span>
        <a href="#series" class="section-link">All series →</a>
      </div>
      ${recent.length === 0 ? `<p class="text-muted">No series yet. Create your first one!</p>` : `
        <table class="admin-table">
          <thead><tr><th></th><th>Title</th><th>Type</th><th>Status</th><th>Latest</th><th>Updated</th></tr></thead>
          <tbody>
            ${recent.map(s => `
              <tr>
                <td><img class="admin-row-thumb" src="${esc(s.cover)}" alt=""></td>
                <td><strong>${esc(s.title)}</strong> <br><small class="text-muted">/${esc(s.slug)}</small></td>
                <td>${esc(s.type)}</td>
                <td><span class="badge badge-${esc(s.status)}">${esc(s.status)}</span></td>
                <td>${s.latestChapter > 0 ? 'Ch.' + esc(s.latestChapter) : '—'}</td>
                <td class="text-muted">${esc(s.updatedAt?.toDate ? timeAgo(s.updatedAt.toDate()) : (s.updatedAt ? timeAgo(s.updatedAt) : '—'))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>

    <div class="admin-card">
      <h3 style="margin-bottom: var(--s-3);">Quick Actions</h3>
      <div class="row gap-3" style="flex-wrap: wrap;">
        <a href="#series" class="btn btn-primary">+ New Series</a>
        <a href="#chapters" class="btn btn-outline">+ New Chapter</a>
        <a href="#comments" class="btn btn-outline">Moderate Comments</a>
        <a href="/" class="btn btn-ghost" target="_blank" rel="noopener">View Live Site →</a>
      </div>
    </div>
  `;
}

function toMs(t) {
  if (!t) return 0;
  if (t.toMillis) return t.toMillis();
  if (t.seconds) return t.seconds * 1000;
  return new Date(t).getTime() || 0;
}
