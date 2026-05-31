// =====================================================
// ui.js — Tiny UI helpers: toast, modal, drawer, progress.
// No external deps, idempotent (safe to call repeatedly).
// =====================================================

import { esc, icon } from './utils.js';

// =====================================================
// TOAST
// =====================================================
function toastContainer() {
  let el = document.querySelector('.toast-container');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast-container';
    document.body.appendChild(el);
  }
  return el;
}

export function toast(message, type = 'info', duration = 3000) {
  const c = toastContainer();
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${esc(message)}</span>`;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
    setTimeout(() => t.remove(), 200);
  }, duration);
  return t;
}

// =====================================================
// CONFIRM MODAL
// =====================================================
export function confirmModal({ title = 'Confirm', message = '', confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <h3 class="modal-title">${esc(title)}</h3>
        <p style="color: var(--text-soft); margin: 0;">${esc(message)}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-act="cancel">${esc(cancelLabel)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="confirm">${esc(confirmLabel)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    function close(value) {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 220);
      resolve(value);
    }
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'confirm') close(true);
      if (act === 'cancel')  close(false);
    });
  });
}

// =====================================================
// DRAWER (bottom sheet on mobile, side panel on desktop)
// =====================================================
export function drawer(html, { onOpen, onClose } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'drawer';
  overlay.innerHTML = `
    <div class="drawer-content">
      <div class="drawer-handle"></div>
      ${html}
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
  onOpen?.(overlay);
  function close() {
    overlay.classList.remove('open');
    setTimeout(() => { overlay.remove(); onClose?.(); }, 320);
  }
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
    if (e.target.closest('[data-drawer-close]')) close();
  });
  return { close, el: overlay };
}

// =====================================================
// LOADING SKELETON BUILDER
// =====================================================
export function skeletonGrid(count = 12) {
  let html = '<div class="card-grid">';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="card">
        <div class="skel skel-card"></div>
        <div class="card-info">
          <div class="skel skel-line long" style="margin-bottom:8px;"></div>
          <div class="skel skel-line short"></div>
        </div>
      </div>
    `;
  }
  return html + '</div>';
}

export function spinner(size = 'normal') {
  return `<div class="center" style="padding: var(--s-8);"><div class="spinner ${size === 'sm' ? 'spinner-sm' : ''}"></div></div>`;
}

// =====================================================
// SCROLL PROGRESS BAR
// =====================================================
let progressBarEl = null;
let progressActive = false;

export function startProgressBar() {
  if (progressActive) return;
  progressActive = true;
  if (!progressBarEl) {
    progressBarEl = document.createElement('div');
    progressBarEl.className = 'progress-bar';
    document.body.appendChild(progressBarEl);
  }
  progressBarEl.style.width = '0%';
  function onScroll() {
    const h = document.documentElement;
    const pct = (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) * 100;
    progressBarEl.style.width = pct + '%';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  progressBarEl._onScroll = onScroll;
}

export function stopProgressBar() {
  if (!progressActive) return;
  progressActive = false;
  if (progressBarEl) {
    window.removeEventListener('scroll', progressBarEl._onScroll);
    progressBarEl.remove();
    progressBarEl = null;
  }
}

// =====================================================
// SHARE
// =====================================================
export async function share({ title, text, url }) {
  const safeUrl = url || location.href;
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url: safeUrl });
      return 'shared';
    } catch (e) {
      if (e.name !== 'AbortError') throw e;
      return 'cancelled';
    }
  }
  // Fallback: copy URL
  try {
    await navigator.clipboard.writeText(safeUrl);
    toast('Link copied to clipboard', 'success');
    return 'copied';
  } catch {
    toast('Could not copy link', 'error');
    return 'failed';
  }
}

// =====================================================
// IMG HELPER — graceful fallback on broken images
// =====================================================
export function safeImg(src, alt = '', cls = '') {
  const safeSrc = esc(src || '');
  return `<img src="${safeSrc}" alt="${esc(alt)}" class="${cls}" loading="lazy" onerror="this.onerror=null;this.style.background='var(--surface-3)';this.removeAttribute('src');">`;
}

// =====================================================
// FAB (back-to-top)
// =====================================================
export function mountBackToTop() {
  if (document.querySelector('.fab.back-to-top')) return;
  const fab = document.createElement('button');
  fab.className = 'fab back-to-top';
  fab.setAttribute('aria-label', 'Back to top');
  fab.innerHTML = icon('chevronUp');
  fab.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.body.appendChild(fab);
  function onScroll() {
    fab.classList.toggle('visible', window.scrollY > 400);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  return fab;
}


// =====================================================
// AUTH MODAL — sign-in / sign-up / forgot password
// =====================================================
import { signIn, signUp, signInWithGoogle, resetPassword } from './auth.js';

const GOOGLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.836.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>`;

/** Open the auth modal. Returns a Promise that resolves to the signed-in
 *  user (or null if cancelled). */
export function openAuthModal({ initialTab = 'signin' } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="Authentication" style="max-width: 420px;">
        <button class="icon-btn" data-act="close" aria-label="Close" style="position:absolute; top:var(--s-3); right:var(--s-3);">
          ${icon('close')}
        </button>

        <h3 class="modal-title" style="margin-bottom: var(--s-4);">Welcome to JayaScans</h3>

        <div style="display:flex; gap:var(--s-1); border-bottom:1px solid var(--border); margin-bottom:var(--s-5);">
          <button class="tab ${initialTab === 'signin' ? 'active' : ''}" data-tab="signin" style="flex:1;">Sign In</button>
          <button class="tab ${initialTab === 'signup' ? 'active' : ''}" data-tab="signup" style="flex:1;">Create Account</button>
        </div>

        <form id="authForm" novalidate>
          <div class="field" data-only="signup" ${initialTab === 'signup' ? '' : 'hidden'}>
            <label class="field-label" for="auth-name">Display Name</label>
            <input class="input" id="auth-name" placeholder="Reader" maxlength="40">
          </div>
          <div class="field">
            <label class="field-label" for="auth-email">Email</label>
            <input class="input" id="auth-email" type="email" required autocomplete="email">
          </div>
          <div class="field">
            <label class="field-label" for="auth-pass">Password</label>
            <input class="input" id="auth-pass" type="password" required minlength="6" autocomplete="current-password">
            <span class="field-hint" data-only="signup" ${initialTab === 'signup' ? '' : 'hidden'}>At least 6 characters.</span>
          </div>
          <button type="submit" class="btn btn-primary btn-block" id="auth-submit">
            ${initialTab === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
          <p id="auth-err" class="field-error" style="display:none; margin-top:var(--s-3); text-align:center;"></p>
        </form>

        <div style="text-align:center; margin: var(--s-5) 0 var(--s-4); color: var(--text-muted); font-size:var(--fs-xs); position:relative;">
          <span style="background:var(--surface-1); padding:0 var(--s-3); position:relative; z-index:1;">or continue with</span>
          <hr style="border:0; border-top:1px solid var(--border); position:absolute; top:50%; left:0; right:0; margin:0; z-index:0;">
        </div>

        <button type="button" class="btn btn-outline btn-block" id="auth-google" style="gap:var(--s-3);">
          ${GOOGLE_SVG} Continue with Google
        </button>

        <p style="text-align:center; margin-top:var(--s-4); font-size:var(--fs-xs); color:var(--text-muted);">
          <a href="#" id="auth-reset" style="color:var(--accent);" data-only="signin" ${initialTab === 'signin' ? '' : 'hidden'}>Forgot password?</a>
        </p>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    let tab = initialTab;
    let resolved = false;

    const $ = (sel) => overlay.querySelector(sel);

    function close(value = null) {
      if (resolved) return;
      resolved = true;
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 220);
      resolve(value);
    }

    function showErr(msg) {
      const el = $('#auth-err');
      el.textContent = msg;
      el.style.display = msg ? '' : 'none';
    }

    function setTab(name) {
      tab = name;
      overlay.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
      overlay.querySelectorAll('[data-only]').forEach(el => {
        el.hidden = (el.dataset.only !== name);
      });
      $('#auth-submit').textContent = name === 'signin' ? 'Sign In' : 'Create Account';
      $('#auth-pass').setAttribute('autocomplete', name === 'signin' ? 'current-password' : 'new-password');
      showErr('');
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) return close(null);
      if (e.target.closest('[data-act="close"]')) return close(null);
      const tabBtn = e.target.closest('[data-tab]');
      if (tabBtn) setTab(tabBtn.dataset.tab);
    });

    $('#authForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#auth-email').value.trim();
      const pass = $('#auth-pass').value;
      const name = $('#auth-name').value.trim();
      if (!email || !pass) { showErr('Email and password are required.'); return; }
      const btn = $('#auth-submit');
      const orig = btn.textContent;
      btn.disabled = true;
      btn.textContent = tab === 'signin' ? 'Signing in…' : 'Creating account…';
      try {
        const user = tab === 'signin'
          ? await signIn(email, pass)
          : await signUp(email, pass, name || email.split('@')[0]);
        toast(tab === 'signin' ? 'Signed in!' : 'Account created!', 'success');
        close(user);
      } catch (err) {
        showErr(friendlyAuthError(err));
        btn.disabled = false;
        btn.textContent = orig;
      }
    });

    $('#auth-google').addEventListener('click', async () => {
      showErr('');
      const btn = $('#auth-google');
      btn.disabled = true;
      try {
        const user = await signInWithGoogle();
        toast('Signed in with Google', 'success');
        close(user);
      } catch (err) {
        if (err.code === 'auth/popup-closed-by-user') { btn.disabled = false; return; }
        if (err.code === 'auth/operation-not-allowed') {
          showErr('Google sign-in is not enabled yet. Use email & password instead.');
        } else {
          showErr(friendlyAuthError(err));
        }
        btn.disabled = false;
      }
    });

    $('#auth-reset').addEventListener('click', async (e) => {
      e.preventDefault();
      const email = $('#auth-email').value.trim();
      if (!email) { showErr('Enter your email above first.'); return; }
      try {
        await resetPassword(email);
        toast('Password reset email sent. Check your inbox.', 'success', 5000);
      } catch (err) {
        showErr(friendlyAuthError(err));
      }
    });

    // Focus first input
    setTimeout(() => $(initialTab === 'signup' ? '#auth-name' : '#auth-email')?.focus(), 200);
  });
}

function friendlyAuthError(err) {
  const code = err?.code || '';
  if (code.includes('invalid-credential') || code.includes('wrong-password')) return 'Wrong email or password.';
  if (code.includes('user-not-found')) return 'No account found with that email.';
  if (code.includes('email-already-in-use')) return 'An account already exists with that email. Sign in instead.';
  if (code.includes('weak-password')) return 'Password is too weak. Use at least 6 characters.';
  if (code.includes('invalid-email')) return 'That email looks invalid.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Try again in a few minutes.';
  if (code.includes('network')) return 'Network error. Check your connection.';
  return err?.message || 'Something went wrong. Try again.';
}
