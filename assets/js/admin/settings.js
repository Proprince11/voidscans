// Admin: Settings (logout, profile, info)
import { signOut, getUser, isAdmin } from '../lib/auth.js';
import { esc, html } from '../lib/utils.js';
import { toast, confirmModal } from '../lib/ui.js';
import { cacheBust } from '../lib/api.js';

export async function settingsAdmin({ outlet }) {
  const user = getUser();

  outlet.innerHTML = html`
    <header class="admin-header"><h1>Settings</h1></header>

    <div class="admin-card" style="margin-bottom: var(--s-4);">
      <h3 style="margin-bottom: var(--s-3);">Account</h3>
      <div class="field"><label class="field-label">Email</label><div>${esc(user?.email || '—')}</div></div>
      <div class="field"><label class="field-label">UID</label><code style="font-size: var(--fs-xs); color: var(--text-muted);">${esc(user?.uid || '—')}</code></div>
      <div class="field"><label class="field-label">Admin Claim</label><div>${isAdmin() ? '<span class="badge badge-ongoing">verified</span>' : '<span class="badge">missing</span>'}</div></div>
      <button class="btn btn-outline" id="signOutBtn" style="margin-top: var(--s-3);">Sign Out</button>
    </div>

    <div class="admin-card" style="margin-bottom: var(--s-4);">
      <h3 style="margin-bottom: var(--s-3);">Cache</h3>
      <p class="text-muted" style="font-size: var(--fs-sm); margin-bottom: var(--s-3);">
        The site caches series/chapter data in memory for ~5 minutes. If you edited content and don't see changes,
        clear the cache to force a refresh.
      </p>
      <button class="btn btn-outline" id="clearCacheBtn">Clear Cache</button>
    </div>

    <div class="admin-card" style="margin-bottom: var(--s-4);">
      <h3 style="margin-bottom: var(--s-3);">Quick Links</h3>
      <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--s-2);">
        <li><a href="https://console.firebase.google.com/project/voidscans-6c66b" target="_blank" rel="noopener">→ Firebase Console</a></li>
        <li><a href="https://console.firebase.google.com/project/voidscans-6c66b/firestore" target="_blank" rel="noopener">→ Firestore Data</a></li>
        <li><a href="https://console.firebase.google.com/project/voidscans-6c66b/firestore/rules" target="_blank" rel="noopener">→ Firestore Security Rules</a></li>
        <li><a href="https://console.firebase.google.com/project/voidscans-6c66b/authentication/users" target="_blank" rel="noopener">→ Auth Users</a></li>
        <li><a href="https://dash.cloudflare.com" target="_blank" rel="noopener">→ Cloudflare Dashboard</a></li>
      </ul>
    </div>

    <div class="admin-card">
      <h3 style="margin-bottom: var(--s-3);">Setup Tasks</h3>
      <p class="text-muted" style="font-size: var(--fs-sm); margin-bottom: var(--s-3);">
        See <code>docs/09-user-tasks.md</code> for the full step-by-step guide on:
      </p>
      <ul style="font-size: var(--fs-sm); color: var(--text-soft); line-height: 1.8; padding-left: var(--s-5);">
        <li>Tightening Firestore security rules</li>
        <li>Granting yourself the admin claim</li>
        <li>Setting up Cloudflare R2 for image hosting</li>
        <li>Connecting a custom domain</li>
        <li>Setting up Cloudflare Turnstile (anti-spam)</li>
      </ul>
    </div>
  `;

  document.getElementById('signOutBtn').addEventListener('click', async () => {
    const ok = await confirmModal({ title: 'Sign out?', confirmLabel: 'Sign out' });
    if (!ok) return;
    await signOut();
  });

  document.getElementById('clearCacheBtn').addEventListener('click', () => {
    cacheBust('');
    toast('Cache cleared', 'success');
  });
}
