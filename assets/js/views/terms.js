// View: Terms of Service
import { html, esc } from '../lib/utils.js';
import { pageTitle, SITE } from '../lib/site.config.js';
import { setMeta } from '../lib/utils.js';

export default async function terms(_params, ctx) {
  setMeta({
    title: pageTitle('Terms of Service'),
    description: `Terms of Service for ${SITE.name}. Read our terms before using the site.`,
    url: `${SITE.baseUrl}/terms`,
    type: 'website'
  });

  ctx.outlet.innerHTML = html`
    <div class="container section legal-page">
      <h1>Terms of Service</h1>
      <p class="legal-updated">Last updated: June 30, 2026</p>

      <p>By accessing and using ${esc(SITE.name)} (<a href="${esc(SITE.baseUrl)}">${esc(SITE.baseUrl)}</a>), you agree to be bound by these Terms of Service. If you do not agree, please do not use the site.</p>

      <h2>1. Use of the Site</h2>
      <ul>
        <li>You must be at least 13 years old to use this site.</li>
        <li>You may browse, read, and search content freely without an account.</li>
        <li>Creating an account is optional and enables features like library sync, bookmarks, and comments.</li>
        <li>You agree not to use the site for any unlawful purpose.</li>
      </ul>

      <h2>2. User Accounts</h2>
      <ul>
        <li>You are responsible for maintaining the security of your account credentials.</li>
        <li>You agree not to share your account with others.</li>
        <li>We reserve the right to suspend or terminate accounts that violate these terms.</li>
        <li>One account per person. Creating multiple accounts to bypass restrictions is not allowed.</li>
      </ul>

      <h2>3. User-Generated Content</h2>
      <p>When you post comments on ${esc(SITE.name)}:</p>
      <ul>
        <li>You retain ownership of your comments but grant us a license to display them on the site.</li>
        <li>You agree not to post content that is hateful, abusive, spam, sexually explicit, or illegal.</li>
        <li>We reserve the right to remove any comment at our discretion.</li>
        <li>Repeated violations will result in account suspension.</li>
      </ul>

      <h2>4. Content & Copyright</h2>
      <ul>
        <li>${esc(SITE.name)} hosts fan translations of manga, manhwa, and manhua.</li>
        <li>We respect intellectual property rights and comply with DMCA takedown requests.</li>
        <li>If you are a copyright holder and believe your work is being infringed, please see our <a href="/dmca">DMCA Policy</a>.</li>
        <li>We encourage readers to support official releases when available.</li>
      </ul>

      <h2>5. Prohibited Activities</h2>
      <p>You agree NOT to:</p>
      <ul>
        <li>Scrape, crawl, or bulk-download content from the site</li>
        <li>Attempt to gain unauthorized access to admin or other user accounts</li>
        <li>Use bots or automated tools to interact with the site</li>
        <li>Redistribute or re-upload content from this site to other platforms</li>
        <li>Interfere with or disrupt the site's infrastructure</li>
        <li>Bypass any rate limiting or anti-spam measures</li>
      </ul>

      <h2>6. Availability & Modifications</h2>
      <ul>
        <li>We do not guarantee 100% uptime. The site may be temporarily unavailable for maintenance.</li>
        <li>We reserve the right to modify, suspend, or discontinue any part of the service at any time.</li>
        <li>Features and content may change without prior notice.</li>
      </ul>

      <h2>7. Limitation of Liability</h2>
      <p>${esc(SITE.name)} is provided "as is" without warranties of any kind. We are not liable for:</p>
      <ul>
        <li>Any loss of data, reading progress, or bookmarks</li>
        <li>Content accuracy or completeness</li>
        <li>Third-party links or services</li>
        <li>Any damages arising from use of the site</li>
      </ul>

      <h2>8. Termination</h2>
      <p>We may terminate or suspend your access to the site immediately, without prior notice, for any reason, including violation of these Terms.</p>

      <h2>9. Changes to Terms</h2>
      <p>We may update these Terms from time to time. Continued use of the site after changes constitutes acceptance of the new Terms.</p>

      <h2>10. Contact</h2>
      <p>Questions about these Terms? Contact us at:</p>
      <p><strong>Email:</strong> contact@jayascans.online</p>

      <div class="legal-back">
        <a href="/" class="btn btn-outline">← Back to Home</a>
      </div>
    </div>
  `;

  return { title: pageTitle('Terms of Service') };
}
