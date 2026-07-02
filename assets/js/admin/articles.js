// =====================================================
// Admin: Articles tab — list, create, edit, delete
// No-code block builder: Text, Image, Link, Series, Chapter
// =====================================================

import { fetchAllArticles, createArticle, updateArticle, deleteArticle, fetchAllSeries } from '../lib/api.js';
import { esc } from '../lib/utils.js';
import { toast } from '../lib/ui.js';
import { renderBlocks } from '../views/article.js';

const CATEGORIES = ['recommendations', 'news', 'editorial', 'announcements'];

function slugify(str) {
  return String(str || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function articlesAdmin({ outlet }) {
  outlet.innerHTML = `<div class="center" style="padding:var(--s-12);"><div class="spinner"></div></div>`;

  let allArticles = [];
  let seriesCatalog = new Map();
  try {
    [allArticles] = await Promise.all([
      fetchAllArticles(),
      fetchAllSeries().then(s => s.forEach(x => seriesCatalog.set(x.slug, x)))
    ]);
  } catch (e) {
    outlet.innerHTML = `<div class="empty-state"><h3>Failed to load articles</h3><p>${esc(e.message)}</p></div>`;
    return;
  }

  renderList(outlet, allArticles, seriesCatalog);
}

function renderList(outlet, articles, seriesCatalog) {
  outlet.innerHTML = `
    <div style="padding:var(--s-6);">
      <div class="between" style="margin-bottom:var(--s-6);">
        <h2 style="margin:0;">Articles</h2>
        <button class="btn btn-primary" id="new-article-btn">+ New Article</button>
      </div>
      ${articles.length === 0
        ? `<div class="empty-state"><div class="icon">📰</div><h3>No articles yet</h3><p>Create your first article using the button above.</p></div>`
        : `<div class="stack gap-2">
            ${articles.map(a => `
              <div class="between" style="padding:var(--s-3);background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-md);">
                <div class="stack gap-1" style="min-width:0;">
                  <div style="font-weight:var(--fw-semibold);font-size:var(--fs-sm);">${esc(a.title)}</div>
                  <div style="font-size:var(--fs-xs);color:var(--text-muted);">
                    <span class="badge badge-accent" style="text-transform:capitalize;">${esc(a.category)}</span>
                    ${a.published ? `<span style="color:var(--success);margin-left:var(--s-2);">● Live</span>` : `<span style="color:var(--text-muted);margin-left:var(--s-2);">Draft</span>`}
                  </div>
                </div>
                <div class="row gap-2" style="flex-shrink:0;">
                  <a href="/articles/${encodeURIComponent(a.slug)}" target="_blank" class="btn btn-sm btn-ghost">View</a>
                  <button class="btn btn-sm btn-outline" data-edit="${esc(a.slug)}">Edit</button>
                  <button class="btn btn-sm btn-danger" data-delete="${esc(a.slug)}">Delete</button>
                </div>
              </div>`).join('')}
          </div>`}
    </div>
  `;

  outlet.querySelector('#new-article-btn')?.addEventListener('click', () => {
    renderEditor(outlet, null, seriesCatalog);
  });
  outlet.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const slug = btn.dataset.edit;
      const art = articles.find(a => a.slug === slug);
      if (art) renderEditor(outlet, art, seriesCatalog);
    });
  });
  outlet.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const slug = btn.dataset.delete;
      if (!confirm(`Delete article "${slug}"? This cannot be undone.`)) return;
      try {
        await deleteArticle(slug);
        toast('Article deleted', 'success');
        const updated = articles.filter(a => a.slug !== slug);
        renderList(outlet, updated, seriesCatalog);
      } catch (e) {
        toast(`Delete failed: ${e.message}`, 'error');
      }
    });
  });
}

function renderEditor(outlet, article, seriesCatalog) {
  const isNew = !article;
  let blocks = article ? [...(article.blocks || [])] : [];

  // Build datalist for series autocomplete
  const seriesOptions = [...seriesCatalog.values()].map(s =>
    `<option value="${esc(s.slug)}" label="${esc(s.title)}">`
  ).join('');

  outlet.innerHTML = `
    <div style="padding:var(--s-6);max-width:1100px;">
      <div class="between" style="margin-bottom:var(--s-6);">
        <h2 style="margin:0;">${isNew ? 'New Article' : 'Edit Article'}</h2>
        <button class="btn btn-ghost" id="back-btn">← Back to list</button>
      </div>
      <datalist id="series-options">${seriesOptions}</datalist>

      <!-- Metadata form -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-4);margin-bottom:var(--s-6);">
        <div class="field">
          <label class="field-label">Title *</label>
          <input id="f-title" class="input" type="text" value="${esc(article?.title || '')}" placeholder="Article title">
          <span class="field-error" id="err-title" style="display:none;"></span>
        </div>
        <div class="field">
          <label class="field-label">Slug *</label>
          <input id="f-slug" class="input" type="text" value="${esc(article?.slug || '')}" placeholder="auto-derived-from-title">
          <span class="field-error" id="err-slug" style="display:none;"></span>
        </div>
        <div class="field" style="grid-column:1/-1;">
          <label class="field-label">Excerpt * <small style="color:var(--text-muted);">(max 160 chars — used as meta description)</small></label>
          <textarea id="f-excerpt" class="textarea" maxlength="160" rows="2" placeholder="Brief summary for search engines">${esc(article?.excerpt || '')}</textarea>
          <span class="field-error" id="err-excerpt" style="display:none;"></span>
        </div>
        <div class="field">
          <label class="field-label">Cover Image URL</label>
          <input id="f-cover" class="input" type="url" value="${esc(article?.coverImage || '')}" placeholder="https://files.catbox.moe/...">
        </div>
        <div class="field">
          <label class="field-label">Category *</label>
          <select id="f-category" class="select">
            ${CATEGORIES.map(c => `<option value="${c}" ${article?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
          <span class="field-error" id="err-category" style="display:none;"></span>
        </div>
        <div class="field">
          <label class="field-label">Tags <small style="color:var(--text-muted);">(comma-separated)</small></label>
          <input id="f-tags" class="input" type="text" value="${esc((article?.tags || []).join(', '))}" placeholder="manhwa, action, top10">
        </div>
        <div class="field">
          <label class="field-label">Author *</label>
          <input id="f-author" class="input" type="text" value="${esc(article?.author || '')}" placeholder="Your name">
          <span class="field-error" id="err-author" style="display:none;"></span>
        </div>
        <div class="row gap-4" style="align-items:center;">
          <label style="display:flex;align-items:center;gap:var(--s-2);cursor:pointer;">
            <input id="f-published" type="checkbox" ${article?.published ? 'checked' : ''}>
            <span class="field-label" style="margin:0;">Published</span>
          </label>
          <label style="display:flex;align-items:center;gap:var(--s-2);cursor:pointer;">
            <input id="f-featured" type="checkbox" ${article?.featured ? 'checked' : ''}>
            <span class="field-label" style="margin:0;">Featured</span>
          </label>
        </div>
      </div>

      <!-- Block builder -->
      <div class="between" style="margin-bottom:var(--s-3);">
        <h3 style="margin:0;font-size:var(--fs-base);">Content Blocks</h3>
        <div class="row gap-2">
          <button class="btn btn-sm btn-outline" data-add="text">+ Text</button>
          <button class="btn btn-sm btn-outline" data-add="image">+ Image</button>
          <button class="btn btn-sm btn-outline" data-add="hyperlink">+ Link</button>
          <button class="btn btn-sm btn-outline" data-add="series">+ Series</button>
          <button class="btn btn-sm btn-outline" data-add="chapter">+ Chapter</button>
        </div>
      </div>
      <div id="block-list" class="stack gap-3" style="margin-bottom:var(--s-6);"></div>
      <span class="field-error" id="err-blocks" style="display:none;"></span>

      <!-- Live preview -->
      <details style="margin-bottom:var(--s-6);">
        <summary style="cursor:pointer;font-weight:var(--fw-semibold);margin-bottom:var(--s-3);">Live Preview</summary>
        <div id="preview-panel" class="article-body" style="padding:var(--s-4);background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-md);"></div>
      </details>

      <div class="row gap-3">
        <button class="btn btn-primary" id="save-btn">Save Article</button>
        <button class="btn btn-ghost" id="cancel-btn">Cancel</button>
      </div>
    </div>
  `;

  // Auto-derive slug from title
  const titleEl = outlet.querySelector('#f-title');
  const slugEl  = outlet.querySelector('#f-slug');
  titleEl.addEventListener('input', () => {
    if (isNew) slugEl.value = slugify(titleEl.value);
  });

  // Block builder rendering
  function renderBlockList() {
    const listEl = outlet.querySelector('#block-list');
    if (!listEl) return;
    if (!blocks.length) {
      listEl.innerHTML = `<p style="color:var(--text-muted);font-size:var(--fs-sm);">No blocks yet. Use the buttons above to add content.</p>`;
    } else {
      listEl.innerHTML = blocks.map((b, i) => renderBlockRow(b, i, blocks.length)).join('');
      attachBlockEvents(listEl, i => {
        blocks.splice(i, 1);
        renderBlockList();
        updatePreview();
      }, i => {
        if (i > 0) { [blocks[i], blocks[i-1]] = [blocks[i-1], blocks[i]]; renderBlockList(); updatePreview(); }
      }, i => {
        if (i < blocks.length - 1) { [blocks[i], blocks[i+1]] = [blocks[i+1], blocks[i]]; renderBlockList(); updatePreview(); }
      }, (i, field, val) => {
        blocks[i][field] = val;
        updatePreview();
      });
    }
    updatePreview();
  }

  function updatePreview() {
    const panel = outlet.querySelector('#preview-panel');
    if (panel) panel.innerHTML = renderBlocks(blocks, seriesCatalog) || '<em style="color:var(--text-muted);">Nothing to preview yet.</em>';
  }

  // Add block buttons
  outlet.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.add;
      blocks.push(defaultBlock(type));
      renderBlockList();
    });
  });

  // Back / Cancel
  outlet.querySelector('#back-btn')?.addEventListener('click', async () => {
    const arts = await fetchAllArticles().catch(() => []);
    renderList(outlet, arts, seriesCatalog);
  });
  outlet.querySelector('#cancel-btn')?.addEventListener('click', async () => {
    const arts = await fetchAllArticles().catch(() => []);
    renderList(outlet, arts, seriesCatalog);
  });

  // Save
  outlet.querySelector('#save-btn')?.addEventListener('click', async () => {
    const data = {
      title:     outlet.querySelector('#f-title').value.trim(),
      slug:      outlet.querySelector('#f-slug').value.trim(),
      excerpt:   outlet.querySelector('#f-excerpt').value.trim(),
      coverImage:outlet.querySelector('#f-cover').value.trim(),
      category:  outlet.querySelector('#f-category').value,
      tags:      outlet.querySelector('#f-tags').value.split(',').map(t => t.trim()).filter(Boolean),
      author:    outlet.querySelector('#f-author').value.trim(),
      published: outlet.querySelector('#f-published').checked,
      featured:  outlet.querySelector('#f-featured').checked,
      blocks,
    };
    // Validate
    const errs = { title: !data.title, slug: !data.slug, excerpt: !data.excerpt, author: !data.author, blocks: !blocks.length };
    let valid = true;
    Object.entries(errs).forEach(([k, bad]) => {
      const el = outlet.querySelector(`#err-${k}`);
      if (el) { el.style.display = bad ? '' : 'none'; el.textContent = bad ? 'Required' : ''; }
      if (bad) valid = false;
    });
    if (!valid) { toast('Please fill in required fields', 'error'); return; }

    const saveBtn = outlet.querySelector('#save-btn');
    saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
    try {
      if (isNew) {
        await createArticle(data);
        toast('Article created!', 'success');
      } else {
        await updateArticle(article.slug, data);
        toast('Article saved!', 'success');
      }
      const arts = await fetchAllArticles();
      renderList(outlet, arts, seriesCatalog);
    } catch (e) {
      toast(`Save failed: ${e.message}`, 'error');
      saveBtn.disabled = false; saveBtn.textContent = 'Save Article';
    }
  });

  renderBlockList();
}

function defaultBlock(type) {
  switch (type) {
    case 'text':      return { type: 'text', value: '' };
    case 'image':     return { type: 'image', url: '', alt: '', caption: '' };
    case 'hyperlink': return { type: 'hyperlink', label: '', url: '', newTab: true };
    case 'series':    return { type: 'series', slug: '' };
    case 'chapter':   return { type: 'chapter', seriesSlug: '', chapterNum: '', label: '' };
    default:          return { type: 'text', value: '' };
  }
}

function renderBlockRow(block, idx, total) {
  const isFirst = idx === 0;
  const isLast  = idx === total - 1;
  let inputs = '';
  if (block.type === 'text') {
    inputs = `<textarea class="textarea" rows="3" data-field="value" placeholder="Paragraph text...">${esc(block.value || '')}</textarea>`;
  } else if (block.type === 'image') {
    inputs = `
      <input class="input" type="url" data-field="url" value="${esc(block.url || '')}" placeholder="Image URL (catbox.moe, imgbb, etc.)">
      <input class="input" type="text" data-field="alt" value="${esc(block.alt || '')}" placeholder="Alt text (optional)" style="margin-top:var(--s-2);">
      <input class="input" type="text" data-field="caption" value="${esc(block.caption || '')}" placeholder="Caption (optional)" style="margin-top:var(--s-2);">
      ${block.url ? `<img src="${esc(block.url)}" style="max-width:200px;max-height:120px;margin-top:var(--s-2);border-radius:var(--r-sm);" onerror="this.style.display='none';">` : ''}`;
  } else if (block.type === 'hyperlink') {
    inputs = `
      <input class="input" type="text" data-field="label" value="${esc(block.label || '')}" placeholder="Link text">
      <input class="input" type="url" data-field="url" value="${esc(block.url || '')}" placeholder="https://..." style="margin-top:var(--s-2);">
      <label style="display:flex;align-items:center;gap:var(--s-2);margin-top:var(--s-2);font-size:var(--fs-xs);">
        <input type="checkbox" data-field="newTab" ${block.newTab ? 'checked' : ''}> Open in new tab
      </label>`;
  } else if (block.type === 'series') {
    inputs = `<input class="input" type="text" data-field="slug" list="series-options" value="${esc(block.slug || '')}" placeholder="Series slug (start typing to search)">`;
  } else if (block.type === 'chapter') {
    inputs = `
      <input class="input" type="text" data-field="seriesSlug" list="series-options" value="${esc(block.seriesSlug || '')}" placeholder="Series slug">
      <input class="input" type="number" data-field="chapterNum" value="${esc(String(block.chapterNum || ''))}" placeholder="Chapter number" style="margin-top:var(--s-2);">
      <input class="input" type="text" data-field="label" value="${esc(block.label || '')}" placeholder="Override label (optional)" style="margin-top:var(--s-2);">`;
  }
  return `
    <div class="block-row" data-idx="${idx}" style="display:grid;grid-template-columns:auto 1fr auto;gap:var(--s-3);padding:var(--s-3);background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-md);align-items:start;">
      <div class="stack gap-1" style="padding-top:4px;">
        <button class="btn btn-sm btn-ghost" data-action="up" ${isFirst ? 'disabled' : ''} title="Move up">▲</button>
        <button class="btn btn-sm btn-ghost" data-action="down" ${isLast ? 'disabled' : ''} title="Move down">▼</button>
      </div>
      <div>
        <div style="font-size:var(--fs-xs);font-weight:var(--fw-bold);text-transform:uppercase;color:var(--accent);margin-bottom:var(--s-2);">${block.type}</div>
        ${inputs}
      </div>
      <button class="btn btn-sm btn-danger" data-action="delete" title="Remove block">✕</button>
    </div>`;
}

function attachBlockEvents(listEl, onDelete, onUp, onDown, onInput) {
  listEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => onDelete(Number(btn.closest('[data-idx]').dataset.idx)));
  });
  listEl.querySelectorAll('[data-action="up"]').forEach(btn => {
    btn.addEventListener('click', () => onUp(Number(btn.closest('[data-idx]').dataset.idx)));
  });
  listEl.querySelectorAll('[data-action="down"]').forEach(btn => {
    btn.addEventListener('click', () => onDown(Number(btn.closest('[data-idx]').dataset.idx)));
  });
  listEl.querySelectorAll('[data-field]').forEach(inp => {
    const idx = Number(inp.closest('[data-idx]').dataset.idx);
    const field = inp.dataset.field;
    const ev = inp.type === 'checkbox' ? 'change' : 'input';
    inp.addEventListener(ev, () => {
      const val = inp.type === 'checkbox' ? inp.checked : inp.value;
      onInput(idx, field, val);
    });
  });
}
