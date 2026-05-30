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
