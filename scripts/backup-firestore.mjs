#!/usr/bin/env node
// =====================================================
// backup-firestore.mjs — Export all Firestore data to a
// local JSON file you can commit/store offline.
//
// Usage:
//   node backup-firestore.mjs
//
// Output:
//   ./backups/firestore-YYYYMMDD-HHmm.json
// =====================================================

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { db } from './_init.mjs';

async function dumpCollection(name) {
  const snap = await db.collection(name).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function dumpSubcollections(parentColl, parentDocId, subColl) {
  try {
    const snap = await db.collection(parentColl).doc(parentDocId).collection(subColl).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

(async () => {
  console.log('Backing up Firestore…');
  const out = {
    exportedAt: new Date().toISOString(),
    series: [],
    chapters: [],
    reactions: [],
    ratings: [],
    comments: {}
  };

  // Top-level collections (legacy + new)
  out.series   = await dumpCollection('series');
  out.chapters = await dumpCollection('chapters');
  try { out.reactions = await dumpCollection('reactions'); } catch {}
  try { out.ratings   = await dumpCollection('ratings'); }   catch {}

  // Comments live as subcollections under series/{slug}/comments
  for (const s of out.series) {
    const c = await dumpSubcollections('series', s.id, 'comments');
    if (c.length) out.comments[s.id] = c;
  }

  // Make backups dir
  await mkdir(resolve('./backups'), { recursive: true });
  const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const file = resolve(`./backups/firestore-${ts}.json`);
  await writeFile(file, JSON.stringify(out, null, 2));

  console.log(`✓ Backed up:`);
  console.log(`  series:    ${out.series.length}`);
  console.log(`  chapters:  ${out.chapters.length}`);
  console.log(`  reactions: ${out.reactions.length}`);
  console.log(`  ratings:   ${out.ratings.length}`);
  console.log(`  comments:  ${Object.values(out.comments).reduce((n, a) => n + a.length, 0)} (across ${Object.keys(out.comments).length} series)`);
  console.log(`\n  Saved → ${file}`);
})().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
