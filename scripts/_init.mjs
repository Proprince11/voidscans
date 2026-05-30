// =====================================================
// _init.mjs — Shared Firebase Admin initialization.
// Used by all scripts.
// =====================================================

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Look for service-account.json in scripts/ then in repo root
const candidates = [
  resolve(__dirname, 'service-account.json'),
  resolve(__dirname, '..', 'service-account.json'),
  process.env.GOOGLE_APPLICATION_CREDENTIALS
].filter(Boolean);

const found = candidates.find(p => p && existsSync(p));

if (!found) {
  console.error(`
✗ No Firebase service account found.

To use these scripts you need a Firebase service account JSON file.

How to get one (90 seconds):
  1. Go to https://console.firebase.google.com/project/voidscans-6c66b/settings/serviceaccounts/adminsdk
  2. Click "Generate new private key"
  3. Save the downloaded JSON file as:  scripts/service-account.json
  4. NEVER commit this file (already in .gitignore as service-account.json)

Once placed, re-run the script.
`);
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(found, 'utf-8'));

initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id
});

export const db = getFirestore();
export const auth = getAuth();
export { FieldValue, Timestamp };
