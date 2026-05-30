#!/usr/bin/env node
// =====================================================
// grant-admin.mjs — Set or revoke the `admin` custom claim
// on a Firebase Auth user. Required to access /admin.
//
// Usage:
//   node grant-admin.mjs your-email@example.com
//   node grant-admin.mjs --revoke your-email@example.com
//
// After running, the user must SIGN OUT and SIGN BACK IN
// for the new claim to take effect (or use verifyAdmin
// in the app, which forces a token refresh).
// =====================================================

import { auth } from './_init.mjs';

const args = process.argv.slice(2);
const revoke = args.includes('--revoke');
const email = args.find(a => !a.startsWith('--'));

if (!email) {
  console.error('Usage: node grant-admin.mjs [--revoke] <email>');
  process.exit(2);
}

try {
  const user = await auth.getUserByEmail(email);
  console.log(`Found user: ${user.email} (uid: ${user.uid})`);
  console.log(`Current claims:`, user.customClaims || {});

  await auth.setCustomUserClaims(user.uid, revoke ? null : { admin: true });

  // Force a token refresh so the user must re-authenticate
  await auth.revokeRefreshTokens(user.uid);

  console.log(revoke
    ? `\n✓ Revoked admin claim for ${email}`
    : `\n✓ Granted admin claim to ${email}`);

  console.log('\nNext step: Sign out and sign back in at /admin');
} catch (err) {
  if (err.code === 'auth/user-not-found') {
    console.error(`\n✗ No Firebase Auth user with email: ${email}`);
    console.error(`  Sign up first at /admin (the login form lets you create an account from any Firebase signup),`);
    console.error(`  or create one in Firebase Console → Authentication → Users → Add user.\n`);
  } else {
    console.error('\n✗ Failed:', err.message);
  }
  process.exit(1);
}

process.exit(0);
