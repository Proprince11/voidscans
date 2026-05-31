// =====================================================
// rss.js — RSS 2.0 feed generator.
//   GET /rss              → latest 30 chapters across all series
//   GET /rss/series/:slug → latest 50 chapters of one series
// =====================================================

import { listDocs, queryDocs, tsToDate } from './firestore.js';

function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rssDate(t) {
  const d = tsToDate(t) || new Date();
  return d.toUTCString();
}

function rssWrap({ title, link, description, selfHref, items, image }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <description>${escapeXml(description)}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(selfHref)}" rel="self" type="application/rss+xml"/>
    ${image ? `<image><url>${escapeXml(image)}</url><title>${escapeXml(title)}</title><link>${escapeXml(link)}</link></image>` : ''}
${items.map(i => `    <item>
      <title>${escapeXml(i.title)}</title>
      <link>${escapeXml(i.link)}</link>
      <guid isPermaLink="false">${escapeXml(i.guid)}</guid>
      <pubDate>${rssDate(i.date)}</pubDate>
      <description>${escapeXml(i.description || '')}</description>
      ${i.image ? `<enclosure url="${escapeXml(i.image)}" type="image/jpeg"/>` : ''}
    </item>`).join('\n')}
  </channel>
</rss>`;
}

export async function handleGlobalRss(request, env) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const baseUrl = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/$/, '');

  const [chapters, series] = await Promise.all([
    queryDocs(projectId, 'chapters', [],
      { field: 'createdAt', direction: 'DESCENDING' }, 30),
    listDocs(projectId, 'series', { pageSize: 500 })
  ]);

  const seriesBySlug = new Map();
  for (const s of series) seriesBySlug.set(s.slug || s._id, s);

  const items = chapters.map(c => {
    const meta = seriesBySlug.get(c.seriesSlug);
    if (!meta) return null;
    return {
      title: `${meta.title} — Chapter ${c.chapterNum}${c.title ? `: ${c.title}` : ''}`,
      link: `${baseUrl}/read/${c.seriesSlug}/${c.chapterNum}`,
      guid: `${c.seriesSlug}-${c.chapterNum}`,
      date: c.createdAt,
      description: `New chapter of ${meta.title}: Chapter ${c.chapterNum}.`,
      image: meta.cover
    };
  }).filter(Boolean);

  const xml = rssWrap({
    title: 'JayaScans — Latest Chapters',
    link: baseUrl,
    description: 'Latest manhwa, manga, and manhua updates from JayaScans.',
    selfHref: `${baseUrl}/rss`,
    items
  });

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300'
    }
  });
}

export async function handleSeriesRss(request, env, slug) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const baseUrl = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/$/, '');

  const seriesArr = await queryDocs(
    projectId, 'series',
    [{ field: 'slug', op: 'EQUAL', value: { stringValue: slug } }],
    null, 1
  );
  if (!seriesArr.length) return new Response('Series not found', { status: 404 });
  const s = seriesArr[0];

  const chapters = await queryDocs(
    projectId, 'chapters',
    [{ field: 'seriesSlug', op: 'EQUAL', value: { stringValue: slug } }],
    { field: 'chapterNum', direction: 'DESCENDING' },
    50
  );

  const items = chapters.map(c => ({
    title: `Chapter ${c.chapterNum}${c.title ? `: ${c.title}` : ''}`,
    link: `${baseUrl}/read/${slug}/${c.chapterNum}`,
    guid: `${slug}-${c.chapterNum}`,
    date: c.createdAt,
    description: c.title || `Chapter ${c.chapterNum} of ${s.title}`,
    image: s.cover
  }));

  const xml = rssWrap({
    title: `${s.title} — JayaScans`,
    link: `${baseUrl}/series/${slug}`,
    description: s.description || `Latest chapters of ${s.title}.`,
    selfHref: `${baseUrl}/rss/series/${slug}`,
    items,
    image: s.cover
  });

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300'
    }
  });
}
