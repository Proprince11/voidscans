// =====================================================
// View: Article detail page — /articles/:slug
// Also exports renderBlocks() used by admin preview
// =====================================================

import { fetchArticleBySlug, fetchAllSeries, trackArticleView } from '../lib/api.js';
import { esc, setMeta, proxyImage } from '../lib/utils.js';
import { seriesCard } from './_components.js';
import { SITE } from '../lib/site.config.js';

/** Pure function — renders a blocks array to an HTML string.
 *  seriesCatalog is a Map<slug, seriesObject> for series/chapter block lookups.
 *  All user content is escaped. No DOM writes.
 */
export function renderBlocks(blocks, seriesCatalog = new Map()) {
  if (!Array.isArray(blocks) || !blocks.length) return '';
  return blocks.map(block => {
    switch (block.type) {
      case 'text':
        return `<p class="article-block-text">${esc(block.value || '')}</p>`;
      case 'image':
        return `
          <figure class="article-block-figure">
            <img src="${esc(block.url || '')}" alt="${esc(block.alt || '')}" loading="lazy" decoding="async">
            ${block.caption ? `<figcaption>${esc(block.caption)}</figcaption>` : ''}
          </figure>`;
      case 'hyperlink':
        return `
          <p class="article-block-link">
            <a href="${esc(block.url || '')}" rel="noopener"
               ${block.newTab ? 'target="_blank"' : ''}>${esc(block.label || block.url || '')}</a>
          </p>`;
      case 'series': {
        const s = seriesCatalog.get(block.slug);
        return s ? seriesCard(s) : '';
      }
      case 'chapter': {
        const s = seriesCatalog.get(block.seriesSlug);
        const labelText = block.label || `Read Chapter ${block.chapterNum || ''}`;
        const href = `/read/${encodeURIComponent(block.seriesSlug || '')}/${encodeURIComponent(block.chapterNum || '')}`;
        return `
          <div class="chapter-cta-block">
            ${s?.cover ? `<img src="${esc(proxyImage(s.cover))}" alt="${esc(s?.title || '')}" loading="lazy">` : ''}
            <div class="chapter-cta-meta">
              <span class="chapter-cta-series">${esc(s?.title || block.seriesSlug || '')}</span>
              <a href="${href}" class="btn btn-primary">${esc(labelText)}</a>
            </div>
          </div>`;
      }
      default: return '';
    }
  }).join('\n');
}

export async function article(params, ctx) {
  const slug = params.slug;
  if (!slug) {
    ctx.outlet.innerHTML = `<div class="container section"><div class="empty-state"><h3>Article not found</h3></div></div>`;
    return { title: 'Not Found' };
  }

  // Skeleton while loading
  ctx.outlet.innerHTML = `
    <div class="container section">
      <div class="skel" style="height:300px;border-radius:var(--r-lg);margin-bottom:var(--s-8);"></div>
      <div class="skel skel-line" style="width:120px;height:20px;margin-bottom:var(--s-4);"></div>
      <div class="skel skel-line long" style="height:32px;margin-bottom:var(--s-3);"></div>
      <div class="skel skel-line" style="width:80%;height:18px;margin-bottom:var(--s-8);"></div>
      ${[0,1,2].map(() => `<div class="skel skel-line long" style="height:14px;margin-bottom:var(--s-3);"></div>`).join('')}
    </div>
  `;

  let art;
  try {
    art = await fetchArticleBySlug(slug);
  } catch (e) {
    console.error('fetchArticleBySlug error:', e);
    art = null;
  }

  if (!art || !art.published) {
    const { notFound } = await import('./notFound.js');
    return notFound(params, ctx);
  }

  // Build series catalog map for block rendering (uses cached fetchAllSeries)
  let seriesCatalog = new Map();
  try {
    const allSeries = await fetchAllSeries();
    allSeries.forEach(s => seriesCatalog.set(s.slug, s));
  } catch (e) { /* ignore — series/chapter blocks will render without cover */ }

  const dateStr = art.publishedAt?.toDate
    ? art.publishedAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  const heroHtml = art.coverImage
    ? `<div class="article-hero">
        <img src="${esc(art.coverImage)}" alt="${esc(art.title)}" class="article-hero-img"
             onerror="this.closest('.article-hero').remove();">
       </div>`
    : '';

  ctx.outlet.innerHTML = `
    <div class="container section">
      ${heroHtml}
      <div class="article-meta">
        <span class="badge badge-accent">${esc(art.category || '')}</span>
        <span>${esc(art.author || '')}</span>
        ${dateStr ? `<time>${esc(dateStr)}</time>` : ''}
      </div>
      <h1 class="article-title">${esc(art.title)}</h1>
      ${art.excerpt ? `<p class="article-excerpt">${esc(art.excerpt)}</p>` : ''}
      <div class="article-body">
        ${renderBlocks(art.blocks, seriesCatalog)}
      </div>
    </div>
  `;

  // SEO — set meta after render
  setMeta({
    title: art.title,
    description: art.excerpt || art.title,
    url: `${SITE.baseUrl}/articles/${art.slug}`,
    image: art.coverImage || null,
    type: 'article'
  });

  // JSON-LD Article schema
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: art.title,
    datePublished: art.publishedAt?.toDate ? art.publishedAt.toDate().toISOString() : '',
    dateModified: art.updatedAt?.toDate ? art.updatedAt.toDate().toISOString() : '',
    image: art.coverImage || '',
    author: { '@type': 'Person', name: art.author || SITE.name },
    publisher: { '@type': 'Organization', name: SITE.name,
      logo: { '@type': 'ImageObject', url: `${SITE.baseUrl}/assets/images/logo.svg` } },
    description: art.excerpt || '',
    url: `${SITE.baseUrl}/articles/${art.slug}`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE.baseUrl}/articles/${art.slug}` }
  };
  const ldScript = document.createElement('script');
  ldScript.type = 'application/ld+json';
  ldScript.setAttribute('data-ld', 'article');
  ldScript.textContent = JSON.stringify(ld);
  document.head.appendChild(ldScript);

  // Non-blocking view tracking (after paint)
  requestAnimationFrame(() => { trackArticleView(slug).catch(() => {}); });

  return {
    title: art.title,
    cleanup: () => {
      document.querySelector('script[data-ld="article"]')?.remove();
    }
  };
}
