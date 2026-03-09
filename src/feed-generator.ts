import { Feed } from "feed";
import type { FeedConfig } from "./config.ts";
import type { CachedArticle } from "./cache.ts";

const VALID_IMAGE_EXTENSIONS: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  bmp: "image/bmp",
  avif: "image/avif",
};

function getImageEnclosure(url: string): { url: string; type: string; length: number } | null {
  if (!isAbsoluteUrl(url)) return null;
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split(".").pop()?.toLowerCase();
    const mime = ext ? VALID_IMAGE_EXTENSIONS[ext] : undefined;
    if (!mime) return null;
    return { url, type: mime, length: 0 };
  } catch {
    return null;
  }
}

export function generateFeed(
  feedConfig: FeedConfig,
  articles: CachedArticle[],
  baseUrl: string,
  originalTitle?: string
): string {
  const feedUrl = `${baseUrl}/feed/${feedConfig.name}`;
  const title = originalTitle
    ? `${originalTitle} (Summarized)`
    : `${feedConfig.name} (Summarized)`;

  const feed = new Feed({
    title,
    description: `AI-summarized version of ${feedConfig.name}`,
    id: feedUrl,
    link: feedUrl,
    updated: new Date(),
    feedLinks: { rss: feedUrl },
    copyright: "",
  });

  for (const article of articles) {
    const imageHtml = article.imageUrl
      ? `<p><img src="${escapeHtml(article.imageUrl)}" alt="${escapeHtml(article.title)}" /></p>\n`
      : "";

    let content: string;
    if (article.status === "error") {
      content = `${imageHtml}<p><em>Summary unavailable.</em></p>\n<p><a href="${escapeHtml(article.link)}">Read the full article</a></p>`;
    } else if (article.summary) {
      content = `${imageHtml}<p>${escapeHtml(article.summary)}</p>\n<p><a href="${escapeHtml(article.link)}">Read the full article</a></p>`;
    } else {
      content = `${imageHtml}<p><a href="${escapeHtml(article.link)}">Read the full article</a></p>`;
    }

    const enclosure = article.imageUrl ? getImageEnclosure(article.imageUrl) : null;

    feed.addItem({
      title: article.title,
      id: `summarized:${feedConfig.name}:${article.id}`,
      link: article.link,
      description: escapeXml(article.status === "error" ? "Summary unavailable." : (article.summary || "")),
      content,
      date: new Date(article.pubDate),
      ...(enclosure ? { enclosure } : {}),
    });
  }

  return feed.rss2();
}

export function generateAggregatedFeed(
  articles: CachedArticle[],
  baseUrl: string
): string {
  const feedUrl = `${baseUrl}/feed/all`;

  const feed = new Feed({
    title: "All Feeds (Summarized)",
    description: "AI-summarized aggregation of all feeds",
    id: feedUrl,
    link: feedUrl,
    updated: new Date(),
    feedLinks: { rss: feedUrl },
    copyright: "",
  });

  for (const article of articles) {
    const imageHtml = article.imageUrl
      ? `<p><img src="${escapeHtml(article.imageUrl)}" alt="${escapeHtml(article.title)}" /></p>\n`
      : "";

    let content: string;
    if (article.status === "error") {
      content = `${imageHtml}<p><em>Summary unavailable.</em></p>\n<p><a href="${escapeHtml(article.link)}">Read the full article</a></p>`;
    } else if (article.summary) {
      content = `${imageHtml}<p>${escapeHtml(article.summary)}</p>\n<p><a href="${escapeHtml(article.link)}">Read the full article</a></p>`;
    } else {
      content = `${imageHtml}<p><a href="${escapeHtml(article.link)}">Read the full article</a></p>`;
    }

    const enclosure = article.imageUrl ? getImageEnclosure(article.imageUrl) : null;

    feed.addItem({
      title: article.title,
      id: `summarized:all:${article.id}`,
      link: article.link,
      description: escapeXml(article.status === "error" ? "Summary unavailable." : (article.summary || "")),
      content,
      date: new Date(article.pubDate),
      ...(enclosure ? { enclosure } : {}),
    });
  }

  return feed.rss2();
}

function isAbsoluteUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
