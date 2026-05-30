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

// Lazy-import views: code-split so a slow chapter image
// doesn't prevent the home page from rendering.
import { home }     from './views/home.js';
import { browse }   from './views/browse.js';
import { search }   from './views/search.js';
import { genre }    from './views/genre.js';
import { series }   from './views/series.js';
import { reader }   from './views/reader.js';
import { library }  from './views/library.js';
import { profile }  from './views/profile.js';
import { notFound } from './views/notFound.js';

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
  navActions.appendChild(slot);

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
        <div class="nav-logo">VOID<span style="color:var(--accent);">SCANS</span></div>
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
// Back-to-top FAB (mounted globally, hides on reader)
// =====================================================
mountBackToTop();
router.onAfterNavigate((p) => {
  const fab = document.querySelector('.fab.back-to-top');
  if (!fab) return;
  fab.style.display = p.startsWith('/read/') ? 'none' : '';
});

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
  f.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <div class="nav-logo" style="margin-bottom: var(--s-3);">VOID<span style="color:var(--accent);">SCANS</span></div>
          <p style="font-size: var(--fs-sm); color: var(--text-muted); max-width: 36ch;">
            Premium reading experience for manhwa, manga, and manhua. Free forever.
          </p>
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
          </ul>
        </div>
        <div>
          <h4>Info</h4>
          <ul>
            <li><a href="/dmca">DMCA</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        © ${new Date().getFullYear()} VoidScans · Built with care.
      </div>
    </div>
  `;
  document.body.appendChild(f);
}
// Mount footer after first paint (don't block routing)
requestIdleCallback ? requestIdleCallback(mountFooter) : setTimeout(mountFooter, 200);
