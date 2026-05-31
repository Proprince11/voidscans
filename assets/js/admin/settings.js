// =====================================================
// Admin: Settings — Branding, Monetization, Integrations, Theme, Features.
//
// Single Firestore doc at /site/settings holds all admin-configurable
// site config. Each panel below maps to a sub-object in that doc.
//
// Logo upload uses the existing /api/upload chain (Catbox/ImgBB/R2)
// via adminFetch (auth-protected by the Worker requireAdmin middleware).
// =====================================================

import { signOut, getUser, isAdmin, adminFetch } from '../lib/auth.js';
import { esc, html } from '../lib/utils.js';
import { toast, confirmModal } from '../lib/ui.js';
import { cacheBust } from '../lib/api.js';
import { getSettings, loadSettings, saveSettings, DEFAULT_SETTINGS } from '../lib/settings.js';

export async function settingsAdmin({ outlet }) {
  const user = getUser();
  // Make sure we have the latest settings before rendering the form
  await loadSettings();
  const s = getSettings();

  outlet.innerHTML = html`
    <header class="admin-header">
      <h1>Settings</h1>
      <p class="text-muted" style="font-size: var(--fs-sm);">All changes here save to <code>/site/settings</code> in Firestore. Public site reads them on boot — refresh to see changes.</p>
    </header>

    <!-- ===== Account ===== -->
    <div class="admin-card" style="margin-bottom: var(--s-4);">
      <h3 style="margin-bottom: var(--s-3);">Account</h3>
      <div class="field"><label class="field-label">Email</label><div>${esc(user?.email || '—')}</div></div>
      <div class="field"><label class="field-label">UID</label><code style="font-size: var(--fs-xs); color: var(--text-muted);">${esc(user?.uid || '—')}</code></div>
      <div class="field"><label class="field-label">Admin Claim</label><div>${isAdmin() ? '<span class="badge badge-ongoing">verified</span>' : '<span class="badge">missing</span>'}</div></div>
      <button class="btn btn-outline" id="signOutBtn" style="margin-top: var(--s-3);">Sign Out</button>
    </div>

    <!-- ===== Branding ===== -->
    <div class="admin-card" style="margin-bottom: var(--s-4);">
      <h3 style="margin-bottom: var(--s-3);">Branding</h3>
      <div class="field">
        <label class="field-label">Custom logo (PNG/SVG, recommended height ≤ 64px)</label>
        <div style="display: flex; gap: var(--s-3); align-items: center; flex-wrap: wrap;">
          <input type="text" id="logoUrl" class="field-input" placeholder="https://files.catbox.moe/abc.png  (paste URL or upload below)" value="${esc(s.branding?.logoUrl || '')}" style="flex: 1; min-width: 280px;">
          <input type="file" id="logoFile" accept="image/png,image/svg+xml,image/webp,image/jpeg" style="display: none;">
          <button class="btn btn-outline" id="logoUploadBtn">📤 Upload</button>
          <button class="btn btn-ghost" id="logoClearBtn" type="button">Clear</button>
        </div>
        <div id="logoPreview" style="margin-top: var(--s-3); padding: var(--s-3); background: var(--bg-deep); border-radius: var(--r-sm); border: 1px dashed var(--border); display: ${s.branding?.logoUrl ? 'block' : 'none'};">
          ${s.branding?.logoUrl ? `<img src="${esc(s.branding.logoUrl)}" alt="logo preview" style="height: 40px; max-width: 240px; object-fit: contain;">` : ''}
        </div>
        <p class="text-muted" style="font-size: var(--fs-xs); margin-top: var(--s-2);">Empty = use the built-in JAYASCANS logo. Uploads go through your existing storage chain.</p>
      </div>
      <div class="field">
        <label class="field-label">Site name (overrides default in titles/footer)</label>
        <input type="text" id="siteName" class="field-input" value="${esc(s.branding?.siteName || '')}" placeholder="JayaScans">
      </div>
      <div class="field">
        <label class="field-label">Tagline</label>
        <input type="text" id="tagline" class="field-input" value="${esc(s.branding?.tagline || '')}" placeholder="Premium reading experience…">
      </div>
    </div>

    <!-- ===== Monetization: Ko-fi ===== -->
    <div class="admin-card" style="margin-bottom: var(--s-4);">
      <h3 style="margin-bottom: var(--s-3);">Support / Ko-fi widget</h3>
      <div class="field">
        ${toggleField('kofiEnabled', 'Show support widget on chapter pages', s.monetization?.kofi?.enabled)}
      </div>
      <div class="field">
        <label class="field-label">Donation / support URL</label>
        <input type="url" id="kofiUrl" class="field-input" value="${esc(s.monetization?.kofi?.url || '')}" placeholder="https://ko-fi.com/jayascans">
      </div>
      <div class="field">
        <label class="field-label">Custom message</label>
        <textarea id="kofiText" class="field-input" rows="2" placeholder="Enjoying our scans? Show some love…">${esc(s.monetization?.kofi?.text || '')}</textarea>
      </div>
    </div>

    <!-- ===== Monetization: Ads ===== -->
    <div class="admin-card" style="margin-bottom: var(--s-4);">
      <h3 style="margin-bottom: var(--s-3);">Ad slots</h3>
      <p class="text-muted" style="font-size: var(--fs-xs); margin-bottom: var(--s-4);">Paste any ad network's snippet (AdSense, PopAds, Adsterra, etc). Each slot is a placeholder div on the live site that gets the script injected when its toggle is on.</p>

      <div class="field">${toggleField('adsMaster', 'Master toggle — enable any ad slot', s.features?.adsEnabled)}</div>

      <fieldset style="border: 1px solid var(--border); border-radius: var(--r-sm); padding: var(--s-4); margin-bottom: var(--s-3);">
        <legend style="padding: 0 var(--s-2); font-weight: 600;">Header (top of every page)</legend>
        <div class="field">${toggleField('adsHeaderEnabled', 'Enable header slot', s.monetization?.ads?.headerEnabled)}</div>
        <textarea id="adsHeaderScript" class="field-input" rows="3" placeholder="<script>...</script> or <ins ... />">${esc(s.monetization?.ads?.headerScript || '')}</textarea>
      </fieldset>

      <fieldset style="border: 1px solid var(--border); border-radius: var(--r-sm); padding: var(--s-4); margin-bottom: var(--s-3);">
        <legend style="padding: 0 var(--s-2); font-weight: 600;">Footer (bottom of every page)</legend>
        <div class="field">${toggleField('adsFooterEnabled', 'Enable footer slot', s.monetization?.ads?.footerEnabled)}</div>
        <textarea id="adsFooterScript" class="field-input" rows="3">${esc(s.monetization?.ads?.footerScript || '')}</textarea>
      </fieldset>

      <fieldset style="border: 1px solid var(--border); border-radius: var(--r-sm); padding: var(--s-4); margin-bottom: var(--s-3);">
        <legend style="padding: 0 var(--s-2); font-weight: 600;">Mid-chapter (between pages 5 & 6 in the reader)</legend>
        <div class="field">${toggleField('adsMidChapterEnabled', 'Enable mid-chapter slot', s.monetization?.ads?.midChapterEnabled)}</div>
        <textarea id="adsMidChapterScript" class="field-input" rows="3">${esc(s.monetization?.ads?.midChapterScript || '')}</textarea>
      </fieldset>

      <fieldset style="border: 1px solid var(--border); border-radius: var(--r-sm); padding: var(--s-4);">
        <legend style="padding: 0 var(--s-2); font-weight: 600;">Sidebar (browse / series pages)</legend>
        <div class="field">${toggleField('adsSidebarEnabled', 'Enable sidebar slot', s.monetization?.ads?.sidebarEnabled)}</div>
        <textarea id="adsSidebarScript" class="field-input" rows="3">${esc(s.monetization?.ads?.sidebarScript || '')}</textarea>
      </fieldset>
    </div>

    <!-- ===== Monetization: Payment ===== -->
    <div class="admin-card" style="margin-bottom: var(--s-4);">
      <h3 style="margin-bottom: var(--s-3);">Payment gateway (public keys)</h3>
      <p class="text-muted" style="font-size: var(--fs-xs); margin-bottom: var(--s-4);">⚠️ Only paste <strong>public/publishable keys</strong> here (e.g. <code>pk_live_...</code>). Never paste a secret key — secret keys must live in Worker env vars. Used for the upcoming premium tier.</p>
      <div class="field">
        <label class="field-label">Stripe publishable key</label>
        <input type="text" id="stripeKey" class="field-input" value="${esc(s.monetization?.payment?.stripePublicKey || '')}" placeholder="pk_live_xxxxxxxxxxxxxxxxx">
      </div>
      <div class="field">
        <label class="field-label">PayPal client ID</label>
        <input type="text" id="paypalId" class="field-input" value="${esc(s.monetization?.payment?.paypalClientId || '')}" placeholder="AXxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">
      </div>
    </div>

    <!-- ===== Integrations: Discord ===== -->
    <div class="admin-card" style="margin-bottom: var(--s-4);">
      <h3 style="margin-bottom: var(--s-3);">Discord webhook (announce new chapters)</h3>
      <div class="field">${toggleField('discordEnabled', 'Fire webhook on chapter publish', s.integrations?.discord?.enabled)}</div>
      <div class="field">
        <label class="field-label">Webhook URL <span class="text-muted">(Discord channel → Edit → Integrations → Webhooks)</span></label>
        <input type="url" id="discordUrl" class="field-input" value="${esc(s.integrations?.discord?.webhookUrl || '')}" placeholder="https://discord.com/api/webhooks/...">
      </div>
      <div class="field">
        <label class="field-label">Mention role (optional)</label>
        <input type="text" id="discordRole" class="field-input" value="${esc(s.integrations?.discord?.mentionRole || '')}" placeholder="<@&123456789012345678>">
      </div>
    </div>

    <!-- ===== Theme defaults ===== -->
    <div class="admin-card" style="margin-bottom: var(--s-4);">
      <h3 style="margin-bottom: var(--s-3);">Theme</h3>
      <div class="field">
        <label class="field-label">Default theme</label>
        <select id="defaultTheme" class="field-input">
          <option value="dark"  ${s.theme?.defaultTheme === 'dark'  ? 'selected' : ''}>Dark (default)</option>
          <option value="light" ${s.theme?.defaultTheme === 'light' ? 'selected' : ''}>Light</option>
          <option value="sepia" ${s.theme?.defaultTheme === 'sepia' ? 'selected' : ''}>Sepia</option>
        </select>
      </div>
      <div class="field">${toggleField('themeToggleEnabled', 'Show theme switcher in nav', s.features?.themeToggleEnabled)}</div>
      <div class="field">${toggleField('themeOverride', 'Allow users to override your default', s.theme?.allowUserOverride)}</div>
    </div>

    <!-- ===== Feature toggles ===== -->
    <div class="admin-card" style="margin-bottom: var(--s-4);">
      <h3 style="margin-bottom: var(--s-3);">Feature toggles</h3>
      <div class="field">${toggleField('reportsEnabled', 'Enable user "Report" button on chapters', s.features?.reportsEnabled)}</div>
      <div class="field">${toggleField('commentsEnabled', 'Show comments section under chapters', s.features?.commentsEnabled !== false)}</div>
      <div class="field">${toggleField('ratingsEnabled', 'Show rating widget on series pages', s.features?.ratingsEnabled !== false)}</div>
    </div>

    <!-- ===== Save / Cache ===== -->
    <div class="admin-card" style="margin-bottom: var(--s-4); position: sticky; bottom: 0; z-index: 10; box-shadow: 0 -8px 24px rgba(0,0,0,0.4);">
      <div style="display: flex; gap: var(--s-3); align-items: center; flex-wrap: wrap;">
        <button class="btn btn-primary" id="saveSettingsBtn" style="min-width: 180px;">💾 Save All Settings</button>
        <button class="btn btn-outline" id="clearCacheBtn">Clear API Cache</button>
        <span id="saveHint" class="text-muted" style="font-size: var(--fs-xs);"></span>
      </div>
    </div>

    <!-- ===== Quick Links ===== -->
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
  `;

  // ===== Wire up =====
  const $ = (id) => document.getElementById(id);

  $('signOutBtn').addEventListener('click', async () => {
    if (await confirmModal({ title: 'Sign out?', confirmLabel: 'Sign out' })) await signOut();
  });

  $('clearCacheBtn').addEventListener('click', () => {
    cacheBust('');
    toast('Cache cleared', 'success');
  });

  // Logo upload
  $('logoUploadBtn').addEventListener('click', () => $('logoFile').click());
  $('logoFile').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('series', 'site-branding');
    $('logoUploadBtn').disabled = true;
    $('logoUploadBtn').textContent = 'Uploading…';
    try {
      const res = await adminFetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!json.ok || !json.url) throw new Error(json.error || 'upload failed');
      $('logoUrl').value = json.url;
      $('logoPreview').style.display = 'block';
      $('logoPreview').innerHTML = `<img src="${esc(json.url)}" alt="logo preview" style="height: 40px; max-width: 240px; object-fit: contain;">`;
      toast('Logo uploaded — click Save All Settings to apply', 'success');
    } catch (err) {
      toast(`Upload failed: ${err.message}`, 'error');
    } finally {
      $('logoUploadBtn').disabled = false;
      $('logoUploadBtn').textContent = '📤 Upload';
      e.target.value = '';
    }
  });

  $('logoClearBtn').addEventListener('click', () => {
    $('logoUrl').value = '';
    $('logoPreview').style.display = 'none';
    $('logoPreview').innerHTML = '';
  });

  // Live preview when URL is typed
  $('logoUrl').addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url) {
      $('logoPreview').style.display = 'block';
      $('logoPreview').innerHTML = `<img src="${esc(url)}" alt="logo preview" style="height: 40px; max-width: 240px; object-fit: contain;" onerror="this.style.opacity=0.3;">`;
    } else {
      $('logoPreview').style.display = 'none';
    }
  });

  // Save all settings
  $('saveSettingsBtn').addEventListener('click', async () => {
    $('saveSettingsBtn').disabled = true;
    $('saveSettingsBtn').textContent = 'Saving…';
    $('saveHint').textContent = '';
    try {
      const patch = {
        branding: {
          logoUrl:  $('logoUrl').value.trim(),
          siteName: $('siteName').value.trim(),
          tagline:  $('tagline').value.trim()
        },
        monetization: {
          kofi: {
            enabled: getToggle('kofiEnabled'),
            url:     $('kofiUrl').value.trim(),
            text:    $('kofiText').value.trim()
          },
          ads: {
            headerEnabled:     getToggle('adsHeaderEnabled'),
            headerScript:      $('adsHeaderScript').value,
            footerEnabled:     getToggle('adsFooterEnabled'),
            footerScript:      $('adsFooterScript').value,
            midChapterEnabled: getToggle('adsMidChapterEnabled'),
            midChapterScript:  $('adsMidChapterScript').value,
            sidebarEnabled:    getToggle('adsSidebarEnabled'),
            sidebarScript:     $('adsSidebarScript').value
          },
          payment: {
            stripePublicKey: $('stripeKey').value.trim(),
            paypalClientId:  $('paypalId').value.trim()
          }
        },
        integrations: {
          discord: {
            enabled:     getToggle('discordEnabled'),
            webhookUrl:  $('discordUrl').value.trim(),
            mentionRole: $('discordRole').value.trim()
          }
        },
        theme: {
          defaultTheme:        $('defaultTheme').value,
          allowUserOverride:   getToggle('themeOverride')
        },
        features: {
          adsEnabled:           getToggle('adsMaster'),
          kofiEnabled:          getToggle('kofiEnabled'),
          discordWebhookEnabled: getToggle('discordEnabled'),
          themeToggleEnabled:   getToggle('themeToggleEnabled'),
          reportsEnabled:       getToggle('reportsEnabled'),
          commentsEnabled:      getToggle('commentsEnabled'),
          ratingsEnabled:       getToggle('ratingsEnabled')
        }
      };
      await saveSettings(patch);
      toast('Settings saved!', 'success');
      $('saveHint').textContent = `Saved ${new Date().toLocaleTimeString()} — open public site in another tab to see changes.`;
    } catch (e) {
      console.error(e);
      toast(`Save failed: ${e.message}`, 'error');
      $('saveHint').textContent = `Error: ${e.message}`;
    } finally {
      $('saveSettingsBtn').disabled = false;
      $('saveSettingsBtn').textContent = '💾 Save All Settings';
    }
  });
}

// =====================================================
// Helpers
// =====================================================
function toggleField(id, label, checked) {
  return `
    <label style="display: flex; align-items: center; gap: var(--s-3); cursor: pointer; user-select: none;">
      <input type="checkbox" id="tog-${id}" ${checked ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--accent);">
      <span>${label}</span>
    </label>
  `;
}
function getToggle(id) {
  return !!document.getElementById(`tog-${id}`)?.checked;
}
