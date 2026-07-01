// =====================================================
// app.js — Boot the SPA: register routes, mount chrome,
// activate router. The chrome (nav, bottom nav, footer)
// lives outside the outlet so it doesn't repaint per route.
// =====================================================

import * as router from './lib/router.js';
import { mountBackToTop, openAuthModal } from './lib/ui.js';
import { onAuthChange, signOut, getUser } from './lib/auth.js';
import { onProfileChange, getProfile } from './lib/account.js';
import { avatarLetter, esc } from './lib/utils.js';
import { SITE } from './lib/site.config.js';
import { loadSettings, watchSettings, getSettings } from './lib/settings.js';
import { applyBranding, watchBrandingChanges } from './lib/branding.js';
import { applyInitialTheme, cycleTheme, getTheme } from './lib/theme.js';

// Lazy-import views via dynamic import — actual code-splitting.
// Each view loads on-demand so the initial boot only fetches the
// shell + router + whichever view matches the current URL.
const lazy = (loader) => async (params, ctx) => {
  const mod = await loader();
  const viewFn = mod.default || Object.values(mod)[0];
  return viewFn(params, ctx);
};

const home    = lazy(() => import('./views/home.js'));
const browse  = lazy(() => import('./views/browse.js'));
const search  = lazy(() => import('./views/search.js'));
const genre   = lazy(() => import('./views/genre.js'));
const series  = lazy(() => import('./views/series.js'));
const reader  = lazy(() => import('./views/reader.js'));
const library = lazy(() => import('./views/library.js'));
const profile = lazy(() => import('./views/profile.js'));
const privacy = lazy(() => import('./views/privacy.js'));
const terms   = lazy(() => import('./views/terms.js'));
const about   = lazy(() => import('./views/about.js'));
const contact = lazy(() => import('./views/contact.js'));
const dmca    = lazy(() => import('./views/dmca.js'));
const notFound = lazy(() => import('./views/notFound.js'));

// =====================================================
// SITE SETTINGS — load once at boot, then apply branding + ads.
// Theme is applied synchronously from localStorage so there's no
// flash of dark when the user prefers light/sepia.
// =====================================================
applyInitialTheme();  // synchronous, uses saved user pref or 'dark'
loadSettings().then(() => {
  // Re-apply theme using the admin-configured site default if user hasn't picked one
  const s = getSettings();
  if (!getTheme() && s.theme?.defaultTheme) {
    document.documentElement.setAttribute('data-theme', s.theme.defaultTheme);
  }
  applyBranding();
  watchBrandingChanges();
});
watchSettings();  // real-time updates for cross-tab admin saves

// =====================================================
// Mount route outlet
// =====================================================
const outlet = document.getElementById('app');
router.setOutlet(outlet);

// =====================================================
// Register routes
// =====================================================
router.register('/',                       home);
router.register('/browse',                 browse);
router.register('/search',                 search);
router.register('/genre/:slug',            genre);
router.register('/series/:slug',           series);
router.register('/read/:slug/:chapter',    reader);
router.register('/library',                library);
router.register('/profile',                profile);
router.register('/privacy',                privacy);
router.register('/terms',                  terms);
router.register('/about',                  about);
router.register('/contact',                contact);
router.register('/dmca',                   dmca);
router.register('*',                       notFound);

// =====================================================
// Active state for navbar + bottom nav
// =====================================================
function updateActiveNav(path) {
  const top = document.querySelectorAll('#navLinks .nav-link');
  const bot = document.querySelectorAll('#bottomnav .bottom-nav-item');
  const all = [...top, ...bot];
  for (const a of all) {
    const route = a.dataset.route;
    let active = false;
    if (route === '/') active = (path === '/');
    else if (route) active = path.startsWith(route);
    a.classList.toggle('active', active);
  }
}
router.onAfterNavigate(updateActiveNav);

// =====================================================
// Hide chrome on reader route (full-bleed reading)
// =====================================================
function toggleReaderMode(path) {
  const isReader = path.startsWith('/read/');
  document.body.classList.toggle('reader-mode', isReader);
  document.getElementById('topnav')?.classList.toggle('hidden', isReader);
  document.getElementById('bottomnav')?.classList.toggle('hidden', isReader);
  document.body.classList.toggle('has-bottom-nav', !isReader);
}
router.onAfterNavigate(toggleReaderMode);

// =====================================================
// Sticky navbar shadow on scroll
// =====================================================
let scrollRaf = null;
function onScroll() {
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    document.getElementById('topnav')?.classList.toggle('scrolled', window.scrollY > 8);
    scrollRaf = null;
  });
}
window.addEventListener('scroll', onScroll, { passive: true });

// =====================================================
// AUTH UI in navbar — Sign In button (signed-out) or
// avatar dropdown (signed-in). Mounted once.
// =====================================================
function mountAuthChrome() {
  const navActions = document.querySelector('#topnav .nav-actions');
  if (!navActions || navActions.querySelector('[data-auth-slot]')) return;

  const slot = document.createElement('div');
  slot.dataset.authSlot = '1';
  slot.style.position = 'relative';
  slot.style.display = 'flex';
  slot.style.alignItems = 'center';
  slot.style.gap = 'var(--s-2)';
  navActions.appendChild(slot);

  // Theme toggle button — appears alongside the auth button when feature enabled
  const themeBtn = document.createElement('button');
  themeBtn.className = 'theme-toggle';
  themeBtn.setAttribute('aria-label', 'Toggle theme (dark / light / sepia)');
  themeBtn.title = 'Toggle theme';
  themeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  themeBtn.addEventListener('click', () => cycleTheme());
  // Hidden by default; shown when settings load with feature enabled
  themeBtn.style.display = 'none';
  slot.appendChild(themeBtn);
  // Re-evaluate visibility whenever settings change
  function updateThemeBtn() {
    const s = getSettings();
    themeBtn.style.display = s.features?.themeToggleEnabled ? 'inline-flex' : 'none';
  }
  updateThemeBtn();
  document.addEventListener('themechange', updateThemeBtn);
  loadSettings().then(updateThemeBtn);

  function paint(user, profileData) {
    slot.innerHTML = '';
    if (!user) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-outline btn-sm';
      btn.id = 'navSignIn';
      btn.textContent = 'Sign In';
      btn.addEventListener('click', () => openAuthModal({ initialTab: 'signin' }));
      slot.appendChild(btn);
      return;
    }

    // Signed in — avatar button
    const photoURL = profileData?.photoURL || user.photoURL || '';
    const initial = avatarLetter(profileData?.displayName || user.displayName || user.email);

    const trigger = document.createElement('button');
    trigger.className = 'icon-btn';
    trigger.setAttribute('aria-label', 'Account menu');
    trigger.style.cssText = `
      width: 32px; height: 32px;
      border-radius: var(--r-full);
      background: ${photoURL ? `url('${esc(photoURL)}') center/cover` : 'linear-gradient(135deg, var(--accent), var(--accent-2))'};
      color: var(--bg);
      font-family: var(--font-display);
      font-weight: var(--fw-bold);
      font-size: var(--fs-sm);
      ${photoURL ? '' : 'display: grid; place-items: center;'}
    `;
    trigger.textContent = photoURL ? '' : initial;
    slot.appendChild(trigger);

    let popover = null;
    function close() { popover?.remove(); popover = null; document.removeEventListener('click', onDocClick); }
    function onDocClick(e) { if (popover && !slot.contains(e.target)) close(); }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (popover) { close(); return; }
      popover = document.createElement('div');
      popover.style.cssText = `
        position: absolute; top: calc(100% + 8px); right: 0;
        background: var(--surface-1); border: 1px solid var(--border);
        border-radius: var(--r-md); box-shadow: var(--sh-lg);
        padding: var(--s-2); min-width: 220px; z-index: var(--z-sticky);
        display: flex; flex-direction: column; gap: 4px;
      `;
      popover.innerHTML = `
        <div style="padding: var(--s-3); border-bottom: 1px solid var(--border-soft); margin-bottom: var(--s-1);">
          <div style="font-weight: var(--fw-semibold); font-size: var(--fs-sm);">${esc(profileData?.displayName || user.displayName || 'Reader')}</div>
          <div style="font-size: var(--fs-xs); color: var(--text-muted);">${esc(user.email || '')}</div>
        </div>
        <a href="/profile" class="nav-link" style="padding: var(--s-2) var(--s-3);">My Profile</a>
        <a href="/library" class="nav-link" style="padding: var(--s-2) var(--s-3);">Library</a>
        <a href="/library?tab=history" class="nav-link" style="padding: var(--s-2) var(--s-3);">History</a>
        <hr style="border: 0; border-top: 1px solid var(--border-soft); margin: var(--s-1) 0;">
        <button class="nav-link" data-act="signout" style="padding: var(--s-2) var(--s-3); text-align: left; color: var(--danger); width: 100%;">Sign Out</button>
      `;
      slot.appendChild(popover);
      popover.querySelector('[data-act="signout"]').addEventListener('click', async () => {
        close();
        await signOut();
      });
      popover.addEventListener('click', (ev) => {
        if (ev.target.closest('a')) close();
      });
      setTimeout(() => document.addEventListener('click', onDocClick), 0);
    });
  }

  // Repaint on auth changes + profile changes
  let lastUser = null;
  let lastProfile = null;
  onAuthChange((user) => {
    lastUser = user;
    paint(lastUser, lastProfile);
  });
  onProfileChange((p) => {
    lastProfile = p;
    paint(lastUser, lastProfile);
  });
  // Initial paint
  paint(getUser(), getProfile());
}
mountAuthChrome();

// =====================================================
// Mobile menu drawer
// =====================================================
const menuBtn = document.getElementById('navMenuBtn');
let menuDrawer = null;
menuBtn?.addEventListener('click', () => {
  if (menuDrawer) { menuDrawer.remove(); menuDrawer = null; return; }
  menuDrawer = document.createElement('div');
  menuDrawer.className = 'menu-drawer open';
  menuDrawer.innerHTML = `
    <div class="menu-drawer-content">
      <div class="between" style="margin-bottom: var(--s-6);">
        <div class="nav-logo">${esc(SITE.logoLead)}<span style="color:var(--accent);">${esc(SITE.logoAccent)}</span></div>
        <button class="icon-btn" data-close aria-label="Close menu">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <nav class="stack gap-2" aria-label="Mobile menu">
        <a href="/"        class="nav-link" style="padding:var(--s-3); font-size:var(--fs-base);">Home</a>
        <a href="/browse"  class="nav-link" style="padding:var(--s-3); font-size:var(--fs-base);">Browse</a>
        <a href="/search"  class="nav-link" style="padding:var(--s-3); font-size:var(--fs-base);">Search</a>
        <a href="/library" class="nav-link" style="padding:var(--s-3); font-size:var(--fs-base);">My Library</a>
        <a href="/profile" class="nav-link" style="padding:var(--s-3); font-size:var(--fs-base);">My Profile</a>
        <hr style="border: 0; border-top: 1px solid var(--border); margin: var(--s-3) 0;">
        <a href="/admin"   class="nav-link" target="_blank" style="padding:var(--s-3); font-size:var(--fs-sm); color:var(--text-muted);">Admin</a>
      </nav>
    </div>
  `;
  document.body.appendChild(menuDrawer);
  menuDrawer.addEventListener('click', (e) => {
    if (e.target === menuDrawer || e.target.closest('[data-close]') || e.target.closest('a')) {
      menuDrawer?.remove();
      menuDrawer = null;
    }
  });
});

// =====================================================
// Back-to-top FAB (mounted globally, visible everywhere including reader)
// =====================================================
mountBackToTop();

// =====================================================
// Boot router
// =====================================================
router.start({ outlet });

// =====================================================
// Footer (lazy mount once, after first navigation)
// =====================================================
function mountFooter() {
  if (document.querySelector('.footer')) return;
  const f = document.createElement('footer');
  f.className = 'footer';
  // Build social links HTML
  const socialLinks = [];
  if (SITE.social.discord) socialLinks.push(`<a href="${esc(SITE.social.discord)}" target="_blank" rel="noopener" aria-label="Discord" class="footer-social-link"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg></a>`);
  if (SITE.social.twitter) socialLinks.push(`<a href="${esc(SITE.social.twitter)}" target="_blank" rel="noopener" aria-label="Twitter / X" class="footer-social-link"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>`);
  if (SITE.social.telegram) socialLinks.push(`<a href="${esc(SITE.social.telegram)}" target="_blank" rel="noopener" aria-label="Telegram" class="footer-social-link"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></a>`);

  f.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <div class="nav-logo" style="margin-bottom: var(--s-3);">${esc(SITE.logoLead)}<span style="color:var(--accent);">${esc(SITE.logoAccent)}</span></div>
          <p style="font-size: var(--fs-sm); color: var(--text-muted); max-width: 36ch;">
            ${esc(SITE.tagline)}
          </p>
          ${socialLinks.length ? `<div class="footer-social" style="display:flex; gap:var(--s-3); margin-top:var(--s-4);">${socialLinks.join('')}</div>` : ''}
        </div>
        <div>
          <h4>Browse</h4>
          <ul>
            <li><a href="/browse">All Series</a></li>
            <li><a href="/genre/action">Action</a></li>
            <li><a href="/genre/romance">Romance</a></li>
            <li><a href="/genre/fantasy">Fantasy</a></li>
          </ul>
        </div>
        <div>
          <h4>Account</h4>
          <ul>
            <li><a href="/library">My Library</a></li>
            <li><a href="/search">Search</a></li>
            <li><a href="/profile">Profile</a></li>
          </ul>
        </div>
        <div>
          <h4>Info</h4>
          <ul>
            <li><a href="/about">About</a></li>
            <li><a href="/contact">Contact</a></li>
            <li><a href="/privacy">Privacy Policy</a></li>
            <li><a href="/terms">Terms of Service</a></li>
            <li><a href="/dmca">DMCA</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span class="footer-tagline">Read first. Read free. Read at <strong>${esc(SITE.name)}</strong>.</span>
        <span class="footer-copy">© ${new Date().getFullYear()} ${esc(SITE.name)}</span>
      </div>
    </div>
  `;
  document.body.appendChild(f);
}
// Mount footer after first paint (don't block routing)
requestIdleCallback ? requestIdleCallback(mountFooter) : setTimeout(mountFooter, 200);

// =====================================================
// Cookie / Privacy consent banner (localStorage-dismissed)
// =====================================================
function mountCookieBanner() {
  if (localStorage.getItem('cookie-consent')) return;
  const banner = document.createElement('div');
  banner.className = 'cookie-banner';
  banner.setAttribute('role', 'alert');
  banner.innerHTML = `
    <p class="cookie-banner-text">
      We use localStorage and IndexedDB to save your reading preferences and library.
      No tracking cookies are used.
      <a href="/privacy">Privacy Policy</a>
    </p>
    <div class="cookie-banner-actions">
      <button class="btn btn-primary btn-sm" data-accept>Got it</button>
    </div>
  `;
  document.body.appendChild(banner);
  banner.querySelector('[data-accept]').addEventListener('click', () => {
    localStorage.setItem('cookie-consent', '1');
    banner.remove();
  });
}
requestIdleCallback ? requestIdleCallback(mountCookieBanner) : setTimeout(mountCookieBanner, 500);
