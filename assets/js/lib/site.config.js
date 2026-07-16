// =====================================================
// site.config.js — SINGLE SOURCE OF TRUTH for brand + domain.
//
// 🔁 To rebrand (e.g. JayaScans → SomethingElse) or change domain LATER,
//    edit THIS file's values + the one Worker var (PUBLIC_BASE_URL in
//    wrangler.jsonc). See docs/13-domain-and-rename.md for the full,
//    short checklist of any remaining static spots.
//
// Everything dynamic (footer, page-title suffix, share text, JSON-LD,
// menu logo) reads from here, so a rename is a 2-file change.
// =====================================================

export const SITE = {
  // Brand
  name: 'JayaScans',          // full brand name shown in UI + titles
  shortName: 'JayaScans',     // PWA short name / compact spots
  // Split logo styling: "JAYA" + accent "SCANS". Keep two parts so the
  // navbar/footer logo renders the accent half automatically.
  logoLead: 'JAYA',
  logoAccent: 'SCANS',

  // Domain — used for absolute links (share, canonical, og). Keep in sync
  // with wrangler.jsonc → vars.PUBLIC_BASE_URL (server side).
  baseUrl: 'https://jayascans.online',

  // Worker API URL — admin uploads (R2) route here directly.
  // The custom domain may route through Pages which lacks bindings,
  // so uploads go to the Worker's native .workers.dev endpoint.
  workerApi: 'https://voidscans.isthe.workers.dev',

  // Cache Worker URL — edge-caches Firestore reads (8× fewer reads).
  // Set to '' to disable (falls back to direct Firestore).
  cacheApi: 'https://jayascans-cache.isthe.workers.dev',

  tagline: 'Premium reading experience for manhwa, manga, and manhua. Free forever.',

  // Optional socials (leave '' to hide)
  social: {
    discord: '',
    telegram: '',
    twitter: ''
  }
};

/** Append the brand to a page title: pageTitle('Browse') → 'Browse · JayaScans' */
export function pageTitle(part) {
  return part ? `${part} · ${SITE.name}` : SITE.name;
}
