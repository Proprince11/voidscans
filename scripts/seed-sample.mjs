#!/usr/bin/env node
// =====================================================
// seed-sample.mjs — Insert a few placeholder series so
// the new UI has data to render. Use only on a fresh
// project. Will refuse to overwrite existing series.
//
// Usage:
//   node seed-sample.mjs
// =====================================================

import { db, FieldValue } from './_init.mjs';

const SAMPLES = [
  {
    slug: 'sample-solo-raven',
    title: 'Solo Raven',
    altTitles: ['솔로 레이븐', 'Lone Raven'],
    cover: 'https://placehold.co/400x600/0a0a0c/f0b941.png?text=Solo+Raven',
    type: 'manhwa',
    status: 'ongoing',
    year: 2024,
    author: 'Unknown',
    artist: 'Unknown',
    genres: ['Action', 'Fantasy', 'Adventure'],
    tags: ['op-mc', 'magic', 'academy'],
    description: 'A boy born with no mana awakens the rarest void ability and rises through the academy ranks to confront the empire that wronged his family.\n\nA classic regression action with sharp art and explosive pacing.',
    rating: { average: 0, total: 0 },
    latestChapter: 14,
    featured: true,
    hot: true,
    new: false
  },
  {
    slug: 'sample-dark-king',
    title: 'Dark King Awakens',
    altTitles: [],
    cover: 'https://placehold.co/400x600/15151a/e84545.png?text=Dark+King',
    type: 'manhwa',
    status: 'ongoing',
    year: 2025,
    author: 'Unknown',
    artist: 'Unknown',
    genres: ['Action', 'Romance', 'Drama'],
    tags: ['revenge', 'kingdom', 'op-mc'],
    description: 'The fallen king rises from darkness, gathering allies and reclaiming what was stolen — but at what cost to his soul?',
    rating: { average: 0, total: 0 },
    latestChapter: 8,
    featured: false,
    hot: false,
    new: true
  },
  {
    slug: 'sample-void-hunter',
    title: 'Void Hunter',
    altTitles: ['공허사냥꾼'],
    cover: 'https://placehold.co/400x600/0a0a0c/4ade80.png?text=Void+Hunter',
    type: 'manhwa',
    status: 'ongoing',
    year: 2024,
    author: 'Unknown',
    artist: 'Unknown',
    genres: ['Sci-Fi', 'Action', 'Horror'],
    tags: ['post-apocalyptic', 'monsters'],
    description: 'In a world where reality cracks open into the void, a single hunter must descend into the rifts to keep humanity from falling in.',
    rating: { average: 0, total: 0 },
    latestChapter: 22,
    featured: true,
    hot: false,
    new: false
  }
];

(async () => {
  console.log('Seeding sample series…\n');
  let created = 0, skipped = 0;

  for (const s of SAMPLES) {
    const existing = await db.collection('series').where('slug', '==', s.slug).limit(1).get();
    if (!existing.empty) {
      console.log(`• ${s.slug} — already exists, skipped`);
      skipped++;
      continue;
    }

    await db.collection('series').doc(s.slug).set({
      ...s,
      views: 0,
      followers: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      latestChapterAt: FieldValue.serverTimestamp()
    });
    console.log(`• ${s.slug} — created`);
    created++;
  }

  console.log(`\n✓ Seeded ${created} series · skipped ${skipped} existing`);
  console.log('\nVisit / to see the new home page populated.');
})().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
