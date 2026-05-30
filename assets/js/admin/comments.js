// Admin: Comments moderation
import { fetchAllSeries, fetchComments, deleteComment } from '../lib/api.js';
import { esc, html, timeAgo, avatarLetter } from '../lib/utils.js';
import { toast, confirmModal, spinner } from '../lib/ui.js';

export async function commentsAdmin({ outlet }) {
  outlet.innerHTML = html`
    <header class="admin-header"><h1>Comments</h1></header>
    ${spinner()}
  `;

  let allSeries = [];
  try { allSeries = await fetchAllSeries({ limitTo: 500 }); }
  catch (e) { outlet.innerHTML = `<p>${esc(e.message)}</p>`; return; }

  if (allSeries.length === 0) {
    outlet.innerHTML = html`
      <header class="admin-header"><h1>Comments</h1></header>
      <div class="admin-card"><p class="text-muted">No series yet.</p></div>
    `;
    return;
  }

  let selectedSlug = allSeries[0].slug;

  async function render() {
    outlet.innerHTML = html`
      <header class="admin-header"><h1>Comments</h1></header>
      <div class="admin-card" style="margin-bottom: var(--s-4);">
        <label class="field-label">Select Series</label>
        <select class="select" id="seriesSelect" style="margin-top: var(--s-2);">
          ${allSeries.map(s => `<option value="${esc(s.slug)}" ${s.slug === selectedSlug ? 'selected' : ''}>${esc(s.title)}</option>`).join('')}
        </select>
      </div>
      <div class="admin-card" id="commentsArea">${spinner('sm')}</div>
    `;

    document.getElementById('seriesSelect').addEventListener('change', async (e) => {
      selectedSlug = e.target.value;
      await loadComments();
    });

    await loadComments();
  }

  async function loadComments() {
    const area = document.getElementById('commentsArea');
    let comments = [];
    try { comments = await fetchComments(selectedSlug, 100); }
    catch (e) { area.innerHTML = `<p>${esc(e.message)}</p>`; return; }

    if (comments.length === 0) {
      area.innerHTML = `<p class="text-muted">No comments yet on this series.</p>`;
      return;
    }

    area.innerHTML = `
      <div class="comments-list">
        ${comments.map(c => {
          const ts = c.createdAt?.toDate ? timeAgo(c.createdAt.toDate()) : '';
          return `
            <article class="comment">
              <div class="comment-avatar">${esc(avatarLetter(c.authorName))}</div>
              <div class="comment-body">
                <div class="comment-head">
                  <span class="comment-name">${esc(c.authorName || 'Anonymous')}</span>
                  <span class="comment-time">${esc(ts)} · ${esc(c.likes || 0)} likes</span>
                </div>
                <div class="comment-text">${esc(c.text)}</div>
                <div class="comment-actions">
                  <button class="comment-action" data-del="${esc(c.id)}" style="color: var(--danger);">
                    Delete
                  </button>
                </div>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;

    area.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      const ok = await confirmModal({ title: 'Delete comment?', message: 'Permanent. Cannot be undone.', confirmLabel: 'Delete', danger: true });
      if (!ok) return;
      try {
        await deleteComment(selectedSlug, b.dataset.del);
        toast('Comment removed', 'success');
        await loadComments();
      } catch (e) {
        toast('Delete failed: ' + e.message, 'error');
      }
    }));
  }

  await render();
}
