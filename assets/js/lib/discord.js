// =====================================================
// discord.js — Fire a Discord webhook on chapter publish.
//
// Note: webhook URL is admin-configured and stored in /site/settings.
// Discord webhooks are not "secret" the way API keys are — they only
// allow posting messages to one channel, and admins can rotate them
// from the Discord channel settings if leaked.
//
// Fired client-side from the admin browser when creating a chapter.
// Failures are logged but never block the chapter create itself.
// =====================================================

import { getSettings } from './settings.js';
import { SITE } from './site.config.js';

/**
 * Send a Discord embed announcing a new chapter.
 * @param {object} args
 * @param {string} args.seriesTitle
 * @param {string} args.seriesSlug
 * @param {number|string} args.chapterNum
 * @param {string} [args.chapterTitle]
 * @param {string} [args.coverUrl]
 */
export async function announceChapter({ seriesTitle, seriesSlug, chapterNum, chapterTitle = '', coverUrl = '' }) {
  const settings = getSettings();
  if (!settings.features.discordWebhookEnabled) return { skipped: 'feature disabled' };
  if (!settings.integrations?.discord?.enabled) return { skipped: 'integration disabled' };

  const url = settings.integrations?.discord?.webhookUrl;
  if (!url || !/^https:\/\/(discord(app)?\.com)\/api\/webhooks\//.test(url)) {
    return { skipped: 'no/invalid webhook URL' };
  }

  const mention = settings.integrations?.discord?.mentionRole?.trim() || '';
  const chapterUrl = `${SITE.baseUrl}/read/${encodeURIComponent(seriesSlug)}/${chapterNum}`;
  const seriesUrl  = `${SITE.baseUrl}/series/${encodeURIComponent(seriesSlug)}`;

  const body = {
    content: mention ? `${mention}` : undefined,
    embeds: [{
      title: `Chapter ${chapterNum}${chapterTitle ? ` — ${chapterTitle}` : ''}`,
      url: chapterUrl,
      description: `New chapter of **[${seriesTitle}](${seriesUrl})** is up!`,
      color: 0xf0b941, // brand gold
      thumbnail: coverUrl ? { url: coverUrl } : undefined,
      footer: { text: SITE.name },
      timestamp: new Date().toISOString()
    }]
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, error: `Discord ${res.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
