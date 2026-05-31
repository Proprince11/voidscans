// View: 404
import { html } from '../lib/utils.js';
import { pageTitle } from '../lib/site.config.js';

export async function notFound(_params, ctx) {
  ctx.outlet.innerHTML = html`
    <div class="container notfound">
      <div>
        <h1>404</h1>
        <p>This page got lost in the void. The series or chapter you're looking for doesn't exist or was moved.</p>
        <div class="row gap-3 center" style="justify-content: center;">
          <a href="/" class="btn btn-primary">Go Home</a>
          <a href="/browse" class="btn btn-outline">Browse Series</a>
        </div>
      </div>
    </div>
  `;
  return { title: pageTitle('Not Found') };
}
