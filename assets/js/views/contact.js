// View: Contact
import { html, esc } from '../lib/utils.js';
import { pageTitle, SITE } from '../lib/site.config.js';
import { setMeta } from '../lib/utils.js';

export default async function contact(_params, ctx) {
  setMeta({
    title: pageTitle('Contact'),
    description: `Contact ${SITE.name} — reach out for questions, suggestions, DMCA requests, or support.`,
    url: `${SITE.baseUrl}/contact`,
    type: 'website'
  });

  ctx.outlet.innerHTML = html`
    <div class="container section legal-page">
      <h1>Contact Us</h1>

      <p>We'd love to hear from you. Whether you have a question, suggestion, bug report, or need to file a DMCA request, here's how to reach us.</p>

      <div class="contact-grid">
        <div class="contact-card">
          <span class="contact-icon">✉️</span>
          <h3>General Inquiries</h3>
          <p>Questions, feedback, or suggestions about the site.</p>
          <a href="mailto:contact@jayascans.online" class="btn btn-outline">contact@jayascans.online</a>
        </div>

        <div class="contact-card">
          <span class="contact-icon">⚖️</span>
          <h3>DMCA & Copyright</h3>
          <p>Copyright holders can submit takedown requests.</p>
          <a href="mailto:dmca@jayascans.online" class="btn btn-outline">dmca@jayascans.online</a>
          <p style="margin-top: var(--s-2); font-size: var(--fs-sm); color: var(--text-muted);">See our <a href="/dmca">full DMCA policy</a> for requirements.</p>
        </div>

        <div class="contact-card">
          <span class="contact-icon">🐛</span>
          <h3>Bug Reports</h3>
          <p>Found a broken page, missing chapter, or display issue?</p>
          <a href="mailto:contact@jayascans.online?subject=Bug Report" class="btn btn-outline">Report a Bug</a>
        </div>

        <div class="contact-card">
          <span class="contact-icon">💬</span>
          <h3>Community</h3>
          <p>Join our community for updates, discussions, and chapter notifications.</p>
          <div class="contact-social">
            ${SITE.social.discord ? `<a href="${esc(SITE.social.discord)}" target="_blank" rel="noopener" class="btn btn-outline">Discord</a>` : ''}
            ${SITE.social.twitter ? `<a href="${esc(SITE.social.twitter)}" target="_blank" rel="noopener" class="btn btn-outline">Twitter / X</a>` : ''}
            ${!SITE.social.discord && !SITE.social.twitter ? `<p style="color: var(--text-muted); font-size: var(--fs-sm);">Coming soon!</p>` : ''}
          </div>
        </div>
      </div>

      <h2>Response Time</h2>
      <p>We typically respond within 24–48 hours. DMCA requests are processed within 48 hours of receipt.</p>

      <div class="legal-back">
        <a href="/" class="btn btn-outline">← Back to Home</a>
      </div>
    </div>
  `;

  return { title: pageTitle('Contact') };
}
