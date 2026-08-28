/**
 * Bot / crawler detection (user-agent heuristic).
 *
 * Used at WRITE time so automated traffic (search crawlers, uptime probes,
 * AI scrapers, link-preview bots) never enters `analytics_events` at all.
 * Filtering at write time keeps the table small and means every dashboard
 * query is automatically bot-free — no per-query filters to forget.
 *
 * This is a deliberately cheap substring heuristic, not a full UA parser:
 * it catches the overwhelming majority of non-human traffic (Googlebot,
 * Bingbot, AhrefsBot, facebookexternalhit, WhatsApp link-preview,
 * Lighthouse, HeadlessChrome, python-requests, curl, …) with zero deps.
 */

/** Substrings that mark a user agent as automated. Matched lower-cased. */
const BOT_TOKENS: string[] = [
  // Generic automation
  "bot",
  "crawl",
  "spider",
  "scrape",
  "slurp",
  "archiver",
  "fetcher",
  "headless",
  "lighthouse",
  "phantomjs",
  "puppeteer",
  "playwright",
  "selenium",
  "wget",
  "curl",
  "lynx",
  "okhttp",
  "java/",
  "go-http-client",
  "libwww",
  // Search / SEO
  "bing",
  "yandex",
  "baidu",
  "duckduck",
  "ahrefs",
  "semrush",
  "majestic",
  // Social link previews
  "facebookexternalhit",
  "whatsapp",
  "telegrambot",
  "twitterbot",
  "linkedinbot",
  "pinterestbot",
  "slackbot",
  "discordbot",
  // AI scrapers
  "gptbot",
  "chatgpt",
  "claudebot",
  "anthropic",
  "ccbot",
  "openai",
  "perplexity",
  "bytespider",
  // Uptime / monitoring
  "uptime",
  "pingdom",
  "statuscake",
  "betteruptime",
  "site24x7",
  "monitor",
  "checker",
  "preview",
  "proxy",
];

/**
 * Returns true when the user agent looks automated (or is missing entirely —
 * real browsers always send a UA; many scripts don't).
 */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true;
  const ua = userAgent.toLowerCase();
  return BOT_TOKENS.some((token) => ua.includes(token));
}
