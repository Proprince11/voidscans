// =====================================================
// admin/import.js — Series metadata import from MangaDex / AniList
//
// Both APIs are public + CORS-enabled, so this works fully client-side
// from the admin panel — no Worker proxy needed.
//
// Usage:
//   import { importFromMangaDex, importFromAniList } from './import.js';
//   const data = await importFromMangaDex('https://mangadex.org/title/abc-123-...');
//   // data is normalized to match the series form fields
// =====================================================

const MANGADEX_API_BASE = 'https://api.mangadex.org';
const MANGADEX_COVER_BASE = 'https://uploads.mangadex.org/covers';
const ANILIST_API = 'https://graphql.anilist.co';

// Genre canonical list — keep in sync with assets/js/views/_components.js GENRES
const KNOWN_GENRES = new Set([
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Romance',
  'Martial Arts', 'School Life', 'Sci-Fi', 'Horror', 'Mystery',
  'Slice of Life', 'Supernatural', 'Isekai', 'Tragedy', 'Sports',
  'Mecha', 'Historical', 'Psychological', 'Thriller'
]);

// =====================================================
// MANGADEX
// =====================================================

/** Extract a MangaDex manga UUID from a URL or raw input. */
function parseMangaDexId(input) {
  const s = String(input || '').trim();
  const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const m = s.match(uuidRe);
  return m ? m[0].toLowerCase() : null;
}

/** Fetch + normalize MangaDex manga metadata. Returns series form fields.
 *  Routes through our same-origin Worker proxy because MangaDex doesn't
 *  enable CORS for browser requests. */
export async function importFromMangaDex(input) {
  const id = parseMangaDexId(input);
  if (!id) throw new Error('Could not find a MangaDex ID. Paste the title URL or its UUID.');

  // Use Worker proxy at /api/mangadex/manga/:uuid (same origin = no CORS issue)
  const url = `/api/mangadex/manga/${id}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`MangaDex returned ${res.status}. The ID may be invalid.`);
  const json = await res.json();
  if (json.result !== 'ok' || !json.data) throw new Error('MangaDex returned an unexpected response.');

  const data = json.data;
  const attrs = data.attributes || {};
  const rels = data.relationships || [];

  // Title — prefer English; fall back to first available
  const titleMap = attrs.title || {};
  const altTitleArr = attrs.altTitles || [];
  const title = titleMap.en
    || altTitleArr.find(t => t.en)?.en
    || titleMap[Object.keys(titleMap)[0]]
    || 'Untitled';

  const altCandidates = [
    ...Object.values(titleMap),
    ...altTitleArr.flatMap(o => Object.values(o))
  ].filter(Boolean);
  const altTitles = uniqueStrings(altCandidates).filter(t => t !== title).slice(0, 8);

  // Description — prefer English
  const descMap = attrs.description || {};
  const description = (descMap.en || descMap[Object.keys(descMap)[0]] || '').trim();

  // Cover image (relationship)
  const coverRel = rels.find(r => r.type === 'cover_art');
  const coverFile = coverRel?.attributes?.fileName;
  const cover = coverFile ? `${MANGADEX_COVER_BASE}/${id}/${coverFile}.512.jpg` : '';

  // Author / artist from relationships
  const author = rels.find(r => r.type === 'author')?.attributes?.name || '';
  const artist = rels.find(r => r.type === 'artist')?.attributes?.name || author;

  // Status
  const statusMap = { ongoing: 'ongoing', completed: 'completed', hiatus: 'hiatus', cancelled: 'dropped' };
  const status = statusMap[attrs.status] || 'ongoing';

  // Year
  const year = Number(attrs.year) || null;

  // Type — MangaDex stores `originalLanguage` (ko/zh/zh-hk/ja)
  const lang = String(attrs.originalLanguage || '').toLowerCase();
  let type = 'manga';
  if (lang === 'ko') type = 'manhwa';
  else if (lang.startsWith('zh')) type = 'manhua';

  // Tags → split into known-genres vs other-tags
  const tagNames = (attrs.tags || [])
    .map(t => t.attributes?.name?.en)
    .filter(Boolean);
  const genres = tagNames.filter(t => KNOWN_GENRES.has(t));
  const tags = tagNames
    .filter(t => !KNOWN_GENRES.has(t))
    .map(t => t.toLowerCase().replace(/\s+/g, '-'))
    .slice(0, 12);

  return {
    title,
    altTitles,
    description,
    cover,
    author,
    artist,
    type,
    status,
    year,
    genres,
    tags,
    source: 'mangadex',
    sourceUrl: `https://mangadex.org/title/${id}`
  };
}

// =====================================================
// ANILIST
// =====================================================

/** Extract an AniList manga ID from URL or raw input. */
function parseAniListId(input) {
  const s = String(input || '').trim();
  // Match anilist.co/manga/12345 or anilist.co/manga/12345/something OR raw number
  const urlMatch = s.match(/anilist\.co\/(?:manga|media)\/(\d+)/i);
  if (urlMatch) return Number(urlMatch[1]);
  if (/^\d+$/.test(s)) return Number(s);
  return null;
}

const ANILIST_QUERY = `
query ($id: Int) {
  Media(id: $id, type: MANGA) {
    id
    title { romaji english native }
    synonyms
    description(asHtml: false)
    coverImage { extraLarge large }
    startDate { year }
    status
    countryOfOrigin
    format
    genres
    tags { name rank isAdult }
    staff(perPage: 8) {
      edges { role node { name { full } } }
    }
  }
}`;

/** Fetch + normalize AniList manga metadata. Returns series form fields. */
export async function importFromAniList(input) {
  const id = parseAniListId(input);
  if (!id) throw new Error('Could not find an AniList ID. Paste the URL (anilist.co/manga/123) or numeric ID.');

  const res = await fetch(ANILIST_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query: ANILIST_QUERY, variables: { id } })
  });
  if (!res.ok) throw new Error(`AniList returned ${res.status}.`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(`AniList: ${json.errors[0].message}`);
  const m = json.data?.Media;
  if (!m) throw new Error('AniList found no manga with that ID.');

  // Title — English preferred
  const title = m.title.english || m.title.romaji || m.title.native || 'Untitled';
  const altTitles = uniqueStrings([
    m.title.romaji, m.title.english, m.title.native,
    ...(m.synonyms || [])
  ]).filter(t => t !== title).slice(0, 8);

  // Description — strip HTML
  const description = (m.description || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const cover = m.coverImage?.extraLarge || m.coverImage?.large || '';

  // Status
  const statusMap = {
    RELEASING: 'ongoing',
    FINISHED: 'completed',
    HIATUS: 'hiatus',
    CANCELLED: 'dropped',
    NOT_YET_RELEASED: 'ongoing'
  };
  const status = statusMap[m.status] || 'ongoing';

  const year = m.startDate?.year || null;

  // Type from country of origin
  let type = 'manga';
  if (m.countryOfOrigin === 'KR') type = 'manhwa';
  else if (m.countryOfOrigin === 'CN' || m.countryOfOrigin === 'TW') type = 'manhua';

  // Genres + tags
  const genres = (m.genres || []).filter(g => KNOWN_GENRES.has(g));
  const tags = (m.tags || [])
    .filter(t => !t.isAdult && t.rank >= 60)
    .map(t => t.name.toLowerCase().replace(/\s+/g, '-'))
    .slice(0, 12);

  // Staff → author + artist
  const staff = m.staff?.edges || [];
  const findRole = (re) => staff.find(e => re.test(e.role || ''))?.node?.name?.full || '';
  const author = findRole(/story|original|writer|author/i) || staff[0]?.node?.name?.full || '';
  const artist = findRole(/art|illustrator/i) || author;

  return {
    title,
    altTitles,
    description,
    cover,
    author,
    artist,
    type,
    status,
    year,
    genres,
    tags,
    source: 'anilist',
    sourceUrl: `https://anilist.co/manga/${id}`
  };
}

// =====================================================
// HELPERS
// =====================================================
function uniqueStrings(arr) {
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    if (typeof v !== 'string') continue;
    const trimmed = v.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}
