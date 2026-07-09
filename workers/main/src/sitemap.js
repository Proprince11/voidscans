// =====================================================
// sitemap.js — Auto-generated sitemap.xml.
// Static pages + every series + canonical genres.
// =====================================================

import { listDocs, tsToDate } from './firestore.js';

const STATIC_URLS = [
  { loc: '/',         priority: 1.0, changefreq: 'daily' },
  { loc: '/browse',   priority: 0.9, changefreq: 'daily' },
  { loc: '/search',   priority: 0.5, changefreq: 'monthly' },
  { loc: '/about',    priority: 0.4, changefreq: 'monthly' },
  { loc: '/contact',  priority: 0.4, changefreq: 'monthly' },
  { loc: '/privacy',  priority: 0.3, changefreq: 'yearly' },
  { loc: '/terms',    priority: 0.3, changefreq: 'yearly' },
  { loc: '/dmca',     priority: 0.3, changefreq: 'yearly' }
];

const GENRES = [
  'action', 'adventure', 'comedy', 'drama', 'fantasy', 'romance',
  'martial-arts', 'school-life', 'sci-fi', 'horror', 'mystery',
  'slice-of-life', 'supernatural', 'isekai', 'tragedy', 'sports',
  'mecha', 'historical', 'psychological', 'thriller'
];

export async function handleSitemap(request, env) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const baseUrl = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/$/, '');

  let series = [];
  try { series = await listDocs(projectId, 'series', { pageSize: 500 }); }
  catch (e) { /* fall through with empty array */ }

  const seriesUrls = series
    .filter(s => s.published !== false)
    .map(s => ({
      loc: `/series/${s.slug || s._id}`,
      priority: 0.8,
      changefreq: 'weekly',
      lastmod: s.updatedAt || s.createdAt
    }));

  const genreUrls = GENRES.map(g => ({
    loc: `/genre/${g}`,
    priority: 0.6,
    changefreq: 'weekly'
  }));

  const all = [...STATIC_URLS, ...seriesUrls, ...genreUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map(u => {
  const lastmod = u.lastmod ? tsToDate(u.lastmod) : null;
  return `  <url>
    <loc>${baseUrl}${u.loc}</loc>${lastmod ? `
    <lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`;
}).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
