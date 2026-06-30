// View: About
import { html, esc } from '../lib/utils.js';
import { pageTitle, SITE } from '../lib/site.config.js';
import { setMeta } from '../lib/utils.js';

export default async function about(_params, ctx) {
  setMeta({
    title: pageTitle('About'),
    description: `About ${SITE.name} — a free manga, manhwa, and manhua reading platform with premium features.`,
    url: `${SITE.baseUrl}/about`,
    type: 'website'
  });

  ctx.outlet.innerHTML = html`
    <div class="container section legal-page">
      <h1>About ${esc(SITE.name)}</h1>

      <div class="about-hero">
        <p class="about-tagline">${esc(SITE.tagline)}</p>
      </div>

      <h2>What is ${esc(SITE.name)}?</h2>
      <p>${esc(SITE.name)} is a free online platform for reading manhwa, manga, and manhua in English. We provide a premium reading experience with features you'd expect from paid platforms — completely free.</p>

      <h2>Features</h2>
      <div class="about-features">
        <div class="about-feature">
          <span class="about-feature-icon">📖</span>
          <h3>Premium Reader</h3>
          <p>Adjustable zoom, fit modes, keyboard navigation, swipe gestures, and reading progress tracking.</p>
        </div>
        <div class="about-feature">
          <span class="about-feature-icon">📚</span>
          <h3>Library & Sync</h3>
          <p>Bookmark series, track reading history, and sync across all your devices when signed in.</p>
        </div>
        <div class="about-feature">
          <span class="about-feature-icon">📴</span>
          <h3>Offline Reading</h3>
          <p>Chapter images are cached as you read. Continue reading even without an internet connection.</p>
        </div>
        <div class="about-feature">
          <span class="about-feature-icon">🎨</span>
          <h3>Multiple Themes</h3>
          <p>Choose between dark, light, and sepia modes for comfortable reading any time of day.</p>
        </div>
        <div class="about-feature">
          <span class="about-feature-icon">⚡</span>
          <h3>Fast & Lightweight</h3>
          <p>Built with zero frameworks. Lightning-fast page loads and smooth navigation.</p>
        </div>
        <div class="about-feature">
          <span class="about-feature-icon">📱</span>
          <h3>Mobile First</h3>
          <p>Designed for phones and tablets. Install as an app from your browser for the full experience.</p>
        </div>
      </div>

      <h2>Our Mission</h2>
      <p>We believe great manga and manhwa should be accessible to everyone. Our goal is to provide the cleanest, fastest, and most enjoyable reading experience possible — without paywalls, intrusive ads, or tracking.</p>

      <h2>Contact</h2>
      <p>Have questions, suggestions, or issues? Reach out:</p>
      <ul>
        <li><strong>Email:</strong> contact@jayascans.online</li>
        <li><strong>DMCA:</strong> <a href="/dmca">DMCA Policy & Takedown Requests</a></li>
      </ul>

      <h2>Legal</h2>
      <ul>
        <li><a href="/privacy">Privacy Policy</a></li>
        <li><a href="/terms">Terms of Service</a></li>
        <li><a href="/dmca">DMCA Policy</a></li>
      </ul>

      <div class="legal-back">
        <a href="/" class="btn btn-outline">← Back to Home</a>
      </div>
    </div>
  `;

  return { title: pageTitle('About') };
}
