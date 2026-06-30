// View: DMCA Policy
import { html, esc } from '../lib/utils.js';
import { pageTitle, SITE } from '../lib/site.config.js';
import { setMeta } from '../lib/utils.js';

export default async function dmca(_params, ctx) {
  setMeta({
    title: pageTitle('DMCA Policy'),
    description: `DMCA takedown policy for ${SITE.name}. Copyright holders can submit removal requests here.`,
    url: `${SITE.baseUrl}/dmca`,
    type: 'website'
  });

  ctx.outlet.innerHTML = html`
    <div class="container section legal-page">
      <h1>DMCA Policy</h1>

      <p>${esc(SITE.name)} respects intellectual property rights. If you are a copyright holder (or authorized agent) and believe content hosted via this site infringes your rights, please follow the procedure below.</p>

      <h2>How to File a Takedown</h2>
      <p>Send an email to: <strong><a href="mailto:dmca@jayascans.online">dmca@jayascans.online</a></strong></p>

      <p>Include all of the following:</p>
      <ol>
        <li><strong>Identification of the copyrighted work</strong> — series title, original publisher, ISBN if applicable.</li>
        <li><strong>Identification of the infringing material</strong> — direct URL(s) to the page(s) on this site (e.g. <code>${esc(SITE.baseUrl)}/series/example</code>).</li>
        <li><strong>Your contact information</strong> — full legal name, postal address, phone number, email.</li>
        <li><strong>A statement</strong> that you have a good-faith belief that the use is not authorized by the copyright owner, its agent, or the law.</li>
        <li><strong>A statement under penalty of perjury</strong> that the information in the notice is accurate, and that you are the copyright owner or authorized to act on the owner's behalf.</li>
        <li><strong>A physical or electronic signature.</strong></li>
      </ol>

      <h2>Response Timeline</h2>
      <ul>
        <li>Valid notices are processed within <strong>48 hours</strong> of receipt.</li>
        <li>The infringing content will be removed.</li>
        <li>The user who uploaded the content (if applicable) will be notified.</li>
      </ul>

      <h2>Counter-Notice</h2>
      <p>If you believe content was removed in error, you may submit a counter-notice to the same email address. Include the standard DMCA counter-notice elements (URL, statement under penalty of perjury, contact info, consent to jurisdiction).</p>

      <h2>Repeat Infringers</h2>
      <p>Accounts that repeatedly upload infringing material will be permanently suspended.</p>

      <h2>False Claims</h2>
      <p>Submitting a false DMCA notice may result in liability for damages under 17 U.S.C. § 512(f).</p>

      <hr style="border: 0; border-top: 1px solid var(--border); margin: var(--s-8) 0;">
      <p style="font-size: var(--fs-sm); color: var(--text-muted);"><em>This policy is provided for transparency and is not legal advice.</em></p>

      <div class="legal-back">
        <a href="/" class="btn btn-outline">← Back to Home</a>
      </div>
    </div>
  `;

  return { title: pageTitle('DMCA Policy') };
}
