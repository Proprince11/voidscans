// View: Privacy Policy
import { html, esc } from '../lib/utils.js';
import { pageTitle, SITE } from '../lib/site.config.js';
import { setMeta } from '../lib/utils.js';

export default async function privacy(_params, ctx) {
  setMeta({
    title: pageTitle('Privacy Policy'),
    description: `Privacy Policy for ${SITE.name}. Learn how we handle your data, what we collect, and your rights.`,
    url: `${SITE.baseUrl}/privacy`,
    type: 'website'
  });

  ctx.outlet.innerHTML = html`
    <div class="container section legal-page">
      <h1>Privacy Policy</h1>
      <p class="legal-updated">Last updated: June 30, 2026</p>

      <p>${esc(SITE.name)} ("we", "us", "our") operates the website <a href="${esc(SITE.baseUrl)}">${esc(SITE.baseUrl)}</a>. This page informs you of our policies regarding the collection, use, and disclosure of personal information when you use our site.</p>

      <h2>1. Information We Collect</h2>

      <h3>Account Information</h3>
      <p>When you create an account, we collect:</p>
      <ul>
        <li>Email address</li>
        <li>Display name (optional)</li>
        <li>Profile photo URL (if you sign in with Google)</li>
      </ul>

      <h3>Usage Data</h3>
      <p>We automatically collect:</p>
      <ul>
        <li>Reading history and bookmarks (stored locally on your device and synced to your account if signed in)</li>
        <li>Reading preferences (theme, zoom level, fit mode)</li>
        <li>Comments you post</li>
      </ul>

      <h3>Analytics</h3>
      <p>We use Cloudflare Web Analytics, which is a privacy-friendly, cookieless analytics service. It does not track individual users, does not use cookies, and does not collect personal information. It only provides aggregate page view and visitor data.</p>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li><strong>Account features:</strong> To sync your library, bookmarks, and reading progress across devices.</li>
        <li><strong>Comments:</strong> To display your comments on series and chapter pages.</li>
        <li><strong>Site improvement:</strong> Aggregate analytics help us understand which pages are popular and improve the reading experience.</li>
      </ul>

      <h2>3. Data Storage</h2>
      <ul>
        <li><strong>Authentication:</strong> Handled by Firebase Authentication (Google Cloud). Your credentials are never stored directly on our servers.</li>
        <li><strong>Database:</strong> Your profile, library, and comments are stored in Google Cloud Firestore.</li>
        <li><strong>Local storage:</strong> Reading preferences, theme choice, and offline reading data are stored in your browser's localStorage and IndexedDB.</li>
      </ul>

      <h2>4. Cookies</h2>
      <p>${esc(SITE.name)} does <strong>not</strong> use tracking cookies. We use:</p>
      <ul>
        <li><strong>localStorage:</strong> For theme preferences, reading settings, and comment cooldowns.</li>
        <li><strong>IndexedDB:</strong> For offline library and reading history.</li>
        <li><strong>Firebase Auth tokens:</strong> Stored in localStorage/IndexedDB for session persistence (not cookies).</li>
      </ul>
      <p>No third-party advertising cookies are used.</p>

      <h2>5. Third-Party Services</h2>
      <table class="legal-table">
        <thead><tr><th>Service</th><th>Purpose</th><th>Privacy Policy</th></tr></thead>
        <tbody>
          <tr><td>Firebase (Google)</td><td>Authentication & database</td><td><a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener">firebase.google.com/support/privacy</a></td></tr>
          <tr><td>Cloudflare</td><td>Hosting, CDN, analytics</td><td><a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener">cloudflare.com/privacypolicy</a></td></tr>
          <tr><td>Google Fonts</td><td>Typography</td><td><a href="https://policies.google.com/privacy" target="_blank" rel="noopener">policies.google.com/privacy</a></td></tr>
        </tbody>
      </table>

      <h2>6. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li><strong>Access:</strong> View all data associated with your account via your profile page.</li>
        <li><strong>Delete:</strong> Delete your account and all associated data by contacting us at the email below.</li>
        <li><strong>Export:</strong> Request a copy of your data.</li>
        <li><strong>Opt out:</strong> You can use the site without an account. Reading, browsing, and searching work without sign-in.</li>
      </ul>

      <h2>7. Data Retention</h2>
      <p>We retain your account data for as long as your account is active. If you delete your account, all associated data (profile, library, comments) is permanently removed within 30 days.</p>

      <h2>8. Children's Privacy</h2>
      <p>Our site is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal data, please contact us.</p>

      <h2>9. Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated "Last updated" date.</p>

      <h2>10. Contact Us</h2>
      <p>If you have questions about this Privacy Policy or want to exercise your data rights, contact us at:</p>
      <p><strong>Email:</strong> contact@jayascans.online</p>

      <div class="legal-back">
        <a href="/" class="btn btn-outline">← Back to Home</a>
      </div>
    </div>
  `;

  return { title: pageTitle('Privacy Policy') };
}
