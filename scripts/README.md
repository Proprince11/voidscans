# VoidScans Scripts

Node.js maintenance scripts. All require a Firebase service account JSON.

## Setup (do this once)

```bash
cd scripts
npm install
```

Then download a service account key:

1. Open https://console.firebase.google.com/project/voidscans-6c66b/settings/serviceaccounts/adminsdk
2. Click **Generate new private key**
3. Save the downloaded file as `scripts/service-account.json`
4. **Never commit this file.** It's already in `.gitignore`.

## Available scripts

| Command | What it does |
|---|---|
| `npm run grant-admin -- you@example.com` | Grant the `admin` Firebase custom claim to a user. Required for `/admin` access. |
| `npm run revoke-admin -- you@example.com` | Remove the admin claim. |
| `npm run backup` | Dump all Firestore data to `./backups/firestore-YYYY-MM-DD-HHmm.json`. Run weekly. |
| `npm run migrate` | Show changes that would migrate old series docs to v3 schema (dry-run). |
| `npm run migrate -- --apply` | Actually write the migration. |
| `npm run seed` | Insert 3 placeholder series so a fresh site has data. Skips existing slugs. |

## Examples

```bash
# Make yourself admin (most important — do this once after deploy)
npm run grant-admin -- prince@example.com

# Sign out, then sign back in at /admin

# Weekly backup
npm run backup

# Migrate legacy data
npm run migrate          # preview
npm run migrate -- --apply
```

## Security

- The service account file gives **full read/write access** to your entire Firebase project. Treat it like a password.
- Don't share screenshots of it. Don't commit it. Don't paste it in Discord.
- If it's ever leaked: Firebase Console → Service Accounts → delete the key and generate a new one.
