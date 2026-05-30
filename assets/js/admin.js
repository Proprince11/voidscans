// =====================================================
// admin.js — Admin SPA entry. Auth gate + tab router.
// =====================================================

import { onAuthChange, signIn, signOut, resetPassword, verifyAdmin, getUser } from './lib/auth.js';
import { toast } from './lib/ui.js';
import { dashboard } from './admin/dashboard.js';
import { reports } from './admin/reports.js';
import { seriesAdmin } from './admin/series.js';
import { chaptersAdmin } from './admin/chapters.js';
import { commentsAdmin } from './admin/comments.js';
import { toolsAdmin } from './admin/tools.js';
import { settingsAdmin } from './admin/settings.js';

const $ = (id) => document.getElementById(id);

// =====================================================
// AUTH GATE
// =====================================================
function showShell(name) {
  ['bootLoader', 'loginShell', 'adminShell', 'noAdminShell'].forEach(id => {
    $(id).hidden = (id !== name);
  });
}

onAuthChange(async (user) => {
  if (!user) { showShell('loginShell'); return; }
  // Verify admin custom claim with a fresh token
  const ok = await verifyAdmin();
  if (!ok) { showShell('noAdminShell'); return; }
  showShell('adminShell');
  mountAdmin();
});

// =====================================================
// LOGIN FORM
// =====================================================
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('loginErr').style.display = 'none';
  $('loginBtn').disabled = true;
  $('loginBtn').textContent = 'Signing in…';
  try {
    await signIn($('email').value.trim(), $('password').value);
    // onAuthChange will swap shells
  } catch (err) {
    $('loginErr').textContent = err.code === 'auth/invalid-credential'
      ? 'Wrong email or password.'
      : (err.message || 'Sign-in failed.');
    $('loginErr').style.display = '';
  } finally {
    $('loginBtn').disabled = false;
    $('loginBtn').textContent = 'Sign In';
  }
});

$('resetLink').addEventListener('click', async (e) => {
  e.preventDefault();
  const email = $('email').value.trim();
  if (!email) { toast('Enter your email first', 'error'); return; }
  try {
    await resetPassword(email);
    toast('Password reset email sent. Check your inbox.', 'success', 5000);
  } catch (err) {
    toast(err.message || 'Reset failed', 'error');
  }
});

$('signOutBtn').addEventListener('click', () => signOut());

// =====================================================
// ADMIN APP — tab router
// =====================================================
const TABS = {
  dashboard: dashboard,
  reports:   reports,
  series:    seriesAdmin,
  chapters:  chaptersAdmin,
  comments:  commentsAdmin,
  tools:     toolsAdmin,
  settings:  settingsAdmin
};

let mounted = false;
let currentCleanup = null;

function mountAdmin() {
  if (mounted) return;
  mounted = true;
  document.querySelectorAll('.admin-nav-item[data-tab]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = el.dataset.tab;
      navigate(tab);
    });
  });
  // Initial tab from hash or default
  const initial = (location.hash.replace('#', '') || 'dashboard');
  navigate(initial);
}

async function navigate(tab) {
  if (!TABS[tab]) tab = 'dashboard';
  document.querySelectorAll('.admin-nav-item[data-tab]').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  location.hash = tab;
  if (currentCleanup) { try { currentCleanup(); } catch {} currentCleanup = null; }
  const outlet = $('adminOutlet');
  outlet.innerHTML = '<div class="center" style="padding: var(--s-12);"><div class="spinner"></div></div>';
  try {
    const res = await TABS[tab]({ outlet, navigate });
    currentCleanup = res?.cleanup || null;
  } catch (e) {
    console.error(e);
    outlet.innerHTML = `<div class="empty-state"><h3>Failed to load</h3><p>${e.message}</p></div>`;
  }
}

window.addEventListener('hashchange', () => {
  const tab = location.hash.replace('#', '') || 'dashboard';
  if (TABS[tab]) navigate(tab);
});
