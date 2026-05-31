// =====================================================
// theme.js — Dark / Light / Sepia theme switcher.
//
// Stores user preference in localStorage. Falls back to:
//   1. User's saved preference (if any)
//   2. Site default (from settings.theme.defaultTheme, if set)
//   3. 'dark' (hard fallback)
//
// Sets data-theme attr on <html> so CSS can override variables.
// CSS lives in tokens.css under [data-theme="light"] / [data-theme="sepia"].
// =====================================================

const LS_KEY = 'jayascans:theme';
const VALID = ['dark', 'light', 'sepia'];

export function getTheme() {
  try {
    const v = localStorage.getItem(LS_KEY);
    return VALID.includes(v) ? v : null;
  } catch { return null; }
}

export function setTheme(theme) {
  if (!VALID.includes(theme)) theme = 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(LS_KEY, theme); } catch {}
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}

/** Apply theme on boot. Call from app.js once site settings are loaded
 *  (or with siteDefault='dark' synchronously before settings load). */
export function applyInitialTheme(siteDefault = 'dark') {
  const userPref = getTheme();
  const theme = userPref || (VALID.includes(siteDefault) ? siteDefault : 'dark');
  document.documentElement.setAttribute('data-theme', theme);
}

export function cycleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = VALID[(VALID.indexOf(current) + 1) % VALID.length];
  setTheme(next);
  return next;
}
