// =====================================================
// router.js — Tiny path-based SPA router with View Transitions.
//
// Routes are registered as { pattern, view } where:
//   pattern: '/series/:slug'
//   view:    async (params, ctx) => returns { title, cleanup? }
//
// The view function is responsible for rendering into ctx.outlet.
// Cleanup functions run when the route unmounts.
// =====================================================

const routes = [];
let currentCleanup = null;
let outletEl = null;
let _onAfterNavigate = [];

export function setOutlet(el) { outletEl = el; }

export function onAfterNavigate(fn) {
  _onAfterNavigate.push(fn);
  return () => { _onAfterNavigate = _onAfterNavigate.filter(f => f !== fn); };
}

export function register(pattern, view) {
  // Build a regex
  const keys = [];
  const rx = new RegExp(
    '^' +
    pattern
      .replace(/\/:([^/]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; })
      .replace(/\*$/, '.*') +
    '$'
  );
  routes.push({ pattern, rx, keys, view });
}

function matchRoute(path) {
  for (const r of routes) {
    const m = r.rx.exec(path);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1] || ''));
      return { route: r, params };
    }
  }
  return null;
}

function withTransition(fn) {
  if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.startViewTransition(fn);
  } else {
    fn();
  }
}

async function render(path) {
  if (!outletEl) outletEl = document.getElementById('app');
  if (!outletEl) return;

  const found = matchRoute(path);
  const ctx = {
    path,
    query: Object.fromEntries(new URLSearchParams(location.search).entries()),
    outlet: outletEl,
    navigate
  };

  // Run previous cleanup
  if (currentCleanup) {
    try { currentCleanup(); } catch {}
    currentCleanup = null;
  }

  if (!found) {
    outletEl.innerHTML = '';
    const notFoundView = routes.find(r => r.pattern === '*')?.view;
    if (notFoundView) {
      const result = await notFoundView({}, ctx);
      currentCleanup = result?.cleanup || null;
      if (result?.title) document.title = result.title;
    } else {
      outletEl.innerHTML = '<div class="container section"><h1>Not found</h1></div>';
    }
    _onAfterNavigate.forEach(fn => fn(path));
    return;
  }

  // Render
  let result;
  try {
    result = await found.route.view(found.params, ctx);
    if (result?.title) document.title = result.title;
    currentCleanup = result?.cleanup || null;
  } catch (e) {
    console.error('Route render error:', e);
    outletEl.innerHTML = `
      <div class="container section">
        <div class="empty-state">
          <div class="icon">⚠️</div>
          <h3>Something went wrong</h3>
          <p style="color: var(--text-muted); max-width: 40ch; margin: var(--s-2) auto var(--s-4);">
            ${e.message?.includes('fetch') || e.message?.includes('network') || e.message?.includes('Failed')
              ? 'Couldn\'t connect to the server. Check your internet and try again.'
              : 'An unexpected error occurred. Try refreshing the page.'}
          </p>
          <div style="display: flex; gap: var(--s-3); justify-content: center; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="location.reload()">Retry</button>
            <a href="/" class="btn btn-outline">Go Home</a>
          </div>
          <p style="font-size: var(--fs-xs); color: var(--text-faint); margin-top: var(--s-4);">${e.message || ''}</p>
        </div>
      </div>`;
  }
  _onAfterNavigate.forEach(fn => fn(path));
}

export function navigate(to, { replace = false, scroll = true } = {}) {
  const url = new URL(to, location.origin);
  if (url.origin !== location.origin) {
    location.href = to;
    return;
  }
  const path = url.pathname + url.search;
  if (replace) history.replaceState({}, '', path);
  else history.pushState({}, '', path);
  withTransition(() => render(url.pathname));
  if (scroll) window.scrollTo({ top: 0, behavior: 'instant' });
}

/** Initialize router: handle initial URL + back/forward + link clicks. */
export function start({ outlet }) {
  if (outlet) outletEl = outlet;
  // Intercept link clicks
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    if (a.target === '_blank' || a.hasAttribute('download') || a.hasAttribute('data-no-router')) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(href);
  });
  window.addEventListener('popstate', () => withTransition(() => render(location.pathname)));
  // Initial
  withTransition(() => render(location.pathname));
}
