// =====================================================
// branding.js — Apply admin-configurable branding to the live page.
//
// Replaces the navbar logo with the admin-uploaded image (if any),
// updates page meta from site settings, and injects ad slots into
// header/footer placeholders. Idempotent — safe to call multiple times.
// =====================================================

import { getSettings, onSettingsChange } from './settings.js';
import { SITE } from './site.config.js';

/** Replace the inline navbar logo with the uploaded image, if set. */
export function applyBranding() {
  const s = getSettings();
  applyLogo(s);
  applyAds(s);
}

function applyLogo(settings) {
  const logoUrl = settings?.branding?.logoUrl?.trim();
  const navLogo = document.querySelector('.nav-logo');
  if (!navLogo) return;

  // Find or create the <img> swap target
  let imgEl = navLogo.querySelector('.nav-logo-img');

  if (logoUrl) {
    // Use the uploaded logo: hide the inline SVG mark + text, show <img>
    if (!imgEl) {
      imgEl = document.createElement('img');
      imgEl.className = 'nav-logo-img';
      imgEl.alt = settings.branding?.siteName || SITE.name;
      imgEl.style.cssText = 'height: 32px; width: auto; max-width: 220px; object-fit: contain; display: block;';
      navLogo.prepend(imgEl);
    }
    imgEl.src = logoUrl;
    navLogo.classList.add('has-custom-logo');
  } else if (imgEl) {
    imgEl.remove();
    navLogo.classList.remove('has-custom-logo');
  }

  // Update aria-label too
  const name = settings.branding?.siteName || SITE.name;
  navLogo.setAttribute('aria-label', `${name} home`);
}

/**
 * Inject admin-configured ad scripts into named slots in the page.
 * Each slot is a <div data-ad-slot="header|footer|sidebar|mid-chapter">
 * that gets innerHTML set from the corresponding settings field.
 */
function applyAds(settings) {
  if (!settings.features?.adsEnabled) {
    // Master toggle off — clear any injected slots
    document.querySelectorAll('[data-ad-slot]').forEach(el => { el.innerHTML = ''; });
    return;
  }
  const ads = settings.monetization?.ads || {};
  injectSlot('header',       ads.headerEnabled,       ads.headerScript);
  injectSlot('footer',       ads.footerEnabled,       ads.footerScript);
  injectSlot('sidebar',      ads.sidebarEnabled,      ads.sidebarScript);
  injectSlot('mid-chapter',  ads.midChapterEnabled,   ads.midChapterScript);
}

function injectSlot(name, enabled, script) {
  document.querySelectorAll(`[data-ad-slot="${name}"]`).forEach(el => {
    if (enabled && script && script.trim()) {
      // Use a sandboxed approach — set innerHTML, then re-execute scripts manually
      // (innerHTML doesn't run <script> tags by default).
      el.innerHTML = script;
      el.querySelectorAll('script').forEach(oldScript => {
        const newScript = document.createElement('script');
        for (const a of oldScript.attributes) newScript.setAttribute(a.name, a.value);
        newScript.text = oldScript.text;
        oldScript.replaceWith(newScript);
      });
      el.style.display = '';
    } else {
      el.innerHTML = '';
      el.style.display = 'none';
    }
  });
}

/** Wire up live updates so admin saves apply without a reload. */
export function watchBrandingChanges() {
  onSettingsChange(() => applyBranding());
}
