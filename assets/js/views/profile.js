// =====================================================
// View: Profile — user profile, library/history stats, settings.
// =====================================================

import { getUser, signOut, isAuthInitialized, onAuthChange } from '../lib/auth.js';
import { getProfile, updateProfileFields, onProfileChange } from '../lib/account.js';
import { getLibrary, getHistory } from '../lib/library.js';
import { esc, html, timeAgo, avatarLetter, compactNum } from '../lib/utils.js';
import { spinner, toast, confirmModal, openAuthModal } from '../lib/ui.js';
import { emptyState } from './_components.js';
import { pageTitle } from '../lib/site.config.js';

export async function profile(_params, ctx) {
  // Wait briefly for auth to initialize on first paint
  if (!isAuthInitialized()) {
    ctx.outlet.innerHTML = spinner();
    await new Promise(resolve => {
      const off = onAuthChange(() => { off(); resolve(); });
    });
  }

  const user = getUser();

  if (!user) {
    ctx.outlet.innerHTML = html`
      <div class="container section">
        <div class="empty-state" style="padding: var(--s-12) var(--s-4);">
          <div class="icon">👤</div>
          <h3>Sign in to your account</h3>
          <p>Sign in to sync your library, reading history, and preferences across devices.</p>
          <div class="row gap-3" style="justify-content: center; margin-top: var(--s-4);">
            <button class="btn btn-primary" id="profileSignIn">Sign In</button>
            <button class="btn btn-outline" id="profileSignUp">Create Account</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('profileSignIn')?.addEventListener('click', async () => {
      const result = await openAuthModal({ initialTab: 'signin' });
      if (result) {
        // Re-render with signed-in state
        return profile(_params, ctx);
      }
    });
    document.getElementById('profileSignUp')?.addEventListener('click', async () => {
      const result = await openAuthModal({ initialTab: 'signup' });
      if (result) return profile(_params, ctx);
    });
    return { title: pageTitle('Profile') };
  }

  // Render shell
  ctx.outlet.innerHTML = renderShell(user, getProfile());

  // Load stats (library + history) async
  Promise.all([
    getLibrary().catch(() => []),
    getHistory({ limit: 1000 }).catch(() => [])
  ]).then(([lib, hist]) => {
    paintStats(lib, hist);
  });

  // Wire up
  wireUp(ctx);

  // Re-paint when profile changes
  const off = onProfileChange((p) => {
    if (!p) return;
    document.getElementById('profileNameDisplay')?.replaceChildren(document.createTextNode(p.displayName || 'Reader'));
    document.getElementById('profileBioDisplay')?.replaceChildren(document.createTextNode(p.bio || ''));
  });

  return {
    title: pageTitle('My Profile'),
    cleanup: () => off?.()
  };
}

function renderShell(user, profileData) {
  const p = profileData || {};
  const initial = avatarLetter(p.displayName || user.email);
  const photoURL = p.photoURL || user.photoURL || null;

  return html`
    <div class="container section">
      <header style="display: flex; align-items: center; gap: var(--s-5); margin-bottom: var(--s-8); flex-wrap: wrap;">
        <div class="comment-avatar" style="width: 96px; height: 96px; font-size: var(--fs-2xl); flex-shrink: 0; ${photoURL ? `background-image: url('${esc(photoURL)}'); background-size: cover; color: transparent;` : ''}">
          ${photoURL ? '' : esc(initial)}
        </div>
        <div style="flex: 1; min-width: 220px;">
          <h1 id="profileNameDisplay" style="margin: 0;">${esc(p.displayName || 'Reader')}</h1>
          <div class="text-muted" style="margin-top: var(--s-1);">${esc(user.email || '')}</div>
          <p id="profileBioDisplay" class="text-muted" style="margin-top: var(--s-2); white-space: pre-wrap;">${esc(p.bio || '')}</p>
        </div>
        <button class="btn btn-outline" id="editProfileBtn">Edit Profile</button>
      </header>

      <!-- Stats -->
      <div class="admin-stats" id="profileStats">
        <div class="stat-card">
          <div class="stat-label">In Library</div>
          <div class="stat-value" id="statLibrary">—</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Reading</div>
          <div class="stat-value" id="statReading">—</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Completed</div>
          <div class="stat-value" id="statCompleted">—</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Chapters Read</div>
          <div class="stat-value" id="statChapters">—</div>
        </div>
      </div>

      <!-- Edit form (hidden by default) -->
      <div class="admin-card" id="editForm" hidden style="margin-bottom: var(--s-5);">
        <h3 style="margin-bottom: var(--s-3);">Edit Profile</h3>
        <div class="field">
          <label class="field-label" for="ed-name">Display Name</label>
          <input class="input" id="ed-name" maxlength="40" value="${esc(p.displayName || '')}">
        </div>
        <div class="field">
          <label class="field-label" for="ed-bio">Bio</label>
          <textarea class="textarea" id="ed-bio" rows="3" maxlength="280" placeholder="A short bio (max 280 chars)">${esc(p.bio || '')}</textarea>
        </div>
        <div class="field">
          <label class="field-label" for="ed-photo">Photo URL (optional)</label>
          <input class="input" id="ed-photo" type="url" value="${esc(p.photoURL || '')}" placeholder="https://...">
          <span class="field-hint">Use a Catbox / R2 image URL. Leave empty for default initial avatar.</span>
        </div>
        <div class="row gap-3" style="margin-top: var(--s-4);">
          <button class="btn btn-primary" id="ed-save">Save Changes</button>
          <button class="btn btn-ghost" id="ed-cancel">Cancel</button>
        </div>
      </div>

      <!-- Quick links -->
      <div class="admin-card" style="margin-bottom: var(--s-5);">
        <h3 style="margin-bottom: var(--s-3);">Quick Links</h3>
        <div class="row gap-3" style="flex-wrap: wrap;">
          <a href="/library" class="btn btn-outline">📚 My Library</a>
          <a href="/library?tab=history" class="btn btn-outline">🕘 Reading History</a>
          <a href="/browse" class="btn btn-outline">🔍 Browse Series</a>
        </div>
      </div>

      <!-- Account actions -->
      <div class="admin-card">
        <h3 style="margin-bottom: var(--s-3);">Account</h3>
        <div class="text-muted" style="font-size: var(--fs-sm); margin-bottom: var(--s-3);">
          Signed in as <strong>${esc(user.email || user.uid)}</strong>
        </div>
        <button class="btn btn-outline" id="signOutBtn">Sign Out</button>
      </div>
    </div>
  `;
}

function paintStats(lib, hist) {
  const reading = lib.filter(x => x.status === 'reading').length;
  const completed = lib.filter(x => x.status === 'completed').length;
  document.getElementById('statLibrary').textContent = compactNum(lib.length);
  document.getElementById('statReading').textContent = compactNum(reading);
  document.getElementById('statCompleted').textContent = compactNum(completed);
  document.getElementById('statChapters').textContent = compactNum(hist.length);
}

function wireUp(ctx) {
  const $ = (id) => document.getElementById(id);

  $('editProfileBtn')?.addEventListener('click', () => {
    $('editForm').hidden = false;
    $('editProfileBtn').hidden = true;
    $('ed-name')?.focus();
  });

  $('ed-cancel')?.addEventListener('click', () => {
    $('editForm').hidden = true;
    $('editProfileBtn').hidden = false;
  });

  $('ed-save')?.addEventListener('click', async () => {
    const name = $('ed-name').value.trim();
    const bio  = $('ed-bio').value.trim().slice(0, 280);
    const photo = $('ed-photo').value.trim();
    if (name.length < 1) { toast('Name required', 'error'); return; }
    const btn = $('ed-save');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      await updateProfileFields({ displayName: name, bio, photoURL: photo || null });
      toast('Profile updated', 'success');
      $('editForm').hidden = true;
      $('editProfileBtn').hidden = false;
    } catch (e) {
      toast('Save failed: ' + (e.message || 'Unknown'), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  });

  $('signOutBtn')?.addEventListener('click', async () => {
    const ok = await confirmModal({
      title: 'Sign out?',
      message: 'Your library is saved in the cloud. You can sign back in anytime.',
      confirmLabel: 'Sign out'
    });
    if (!ok) return;
    await signOut();
    toast('Signed out', 'info');
    location.assign('/');
  });
}
