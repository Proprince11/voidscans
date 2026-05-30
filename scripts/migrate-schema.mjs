#!/usr/bin/env node
// =====================================================
// migrate-schema.mjs — Upgrade existing series docs to
// the v3 schema. Adds missing fields with sensible defaults.
//
// SAFE TO RE-RUN. Idempotent. Only writes if changed.
//
// Usage:
//   node migrate-schema.mjs            (dry-run, shows diff)
//   node migrate-schema.mjs --apply    (writes changes)
// =====================================================

import { db, FieldValue } from './_init.mjs';

const APPLY = process.argv.includes('--apply');

const DEFAULTS = {
  altTitles: [],
  genres:    [],
  tags:      [],
  author:    '',
  artist:    '',
  year:      null,
  rating:    { average: 0, total: 0 },
  views:     0,
  followers: 0,
  featured:  false,
  hot:       false,
  new:       false
};

(async () => {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);

  const snap = await db.collection('series').get();
  console.log(`Found ${snap.size} series.\n`);

  let changedCount = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const patch = {};

    for (const [k, v] of Object.entries(DEFAULTS)) {
      if (data[k] === undefined) patch[k] = v;
    }

    // Normalize type / status to lowercase
    if (data.type && data.type !== String(data.type).toLowerCase()) {
      patch.type = String(data.type).toLowerCase();
    }
    if (data.status && data.status !== String(data.status).toLowerCase()) {
      patch.status = String(data.status).toLowerCase();
    }

    // Add updatedAt if missing (use createdAt or now)
    if (!data.updatedAt) {
      patch.updatedAt = data.createdAt || FieldValue.serverTimestamp();
    }

    // Add latestChapterAt if missing but latestChapter > 0
    if (!data.latestChapterAt && data.latestChapter > 0) {
      patch.latestChapterAt = data.updatedAt || data.createdAt || FieldValue.serverTimestamp();
    }

    if (Object.keys(patch).length === 0) continue;

    changedCount++;
    console.log(`• ${data.slug || doc.id}`);
    Object.keys(patch).forEach(k => {
      console.log(`    + ${k}: ${JSON.stringify(patch[k])}`);
    });

    if (APPLY) {
      await doc.ref.update(patch);
    }
  }

  console.log(`\n${APPLY ? '✓ Updated' : 'Would update'} ${changedCount} of ${snap.size} series.`);

  if (!APPLY && changedCount > 0) {
    console.log('\nRe-run with --apply to actually write the changes.');
  }
})().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
