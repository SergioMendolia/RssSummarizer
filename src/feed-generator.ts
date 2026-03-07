import { Feed } from "feed";
import type { FeedConfig } from "./config.ts";
import type { CachedArticle } from "./cache.ts";

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

    feed.addItem({
      title: article.title,
      id: article.id,
      link: article.link,
      description: article.status === "error" ? "Summary unavailable." : (article.summary || ""),
      content,
      date: new Date(article.pubDate),
      ...(article.imageUrl ? { image: article.imageUrl } : {}),
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

    feed.addItem({
      title: article.title,
      id: article.id,
      link: article.link,
      description: article.status === "error" ? "Summary unavailable." : (article.summary || ""),
      content,
      date: new Date(article.pubDate),
      ...(article.imageUrl ? { image: article.imageUrl } : {}),
    });
  }

  return feed.rss2();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
