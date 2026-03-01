import { Hono } from "hono";
import type { AppConfig } from "./config.ts";
import { type ArticleCache } from "./cache.ts";
import { generateFeed, generateAggregatedFeed } from "./feed-generator.ts";

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function createServer(cache: ArticleCache, config: AppConfig): Hono {
  const app = new Hono();
  const baseUrl = `http://${config.server.host === "0.0.0.0" ? "localhost" : config.server.host}:${config.server.port}`;

  app.get("/feed/all", (c) => {
    const maxItems = Math.max(...config.feeds.map((f) => f.maxItems));
    const articles = cache.getAllArticles(maxItems);
    const prefixed = articles.map((a) => ({
      ...a,
      title: `[${a.feedName}] ${a.title}`,
    }));
    const xml = generateAggregatedFeed(prefixed, baseUrl);

    return c.body(xml, 200, {
      "Content-Type": "application/rss+xml; charset=utf-8",
    });
  });

  app.get("/feed/:slug", (c) => {
    const slug = c.req.param("slug");
    const feedConfig = config.feeds.find((f) => f.name === slug);

    if (!feedConfig) {
      const available = config.feeds.map((f) => f.name).join(", ");
      return c.text(`Feed not found: ${slug}\nAvailable feeds: ${available}`, 404);
    }

    const articles = cache.getArticlesByFeed(feedConfig.name, feedConfig.maxItems);
    const xml = generateFeed(feedConfig, articles, baseUrl);

    return c.body(xml, 200, {
      "Content-Type": "application/rss+xml; charset=utf-8",
    });
  });

  app.get("/display", (c) => {
    const maxItems = Math.max(...config.feeds.map((f) => f.maxItems));
    const articles = cache.getAllArticles(maxItems);

    const articlesByFeed = new Map<string, typeof articles>();
    for (const a of articles) {
      const list = articlesByFeed.get(a.feedName) ?? [];
      list.push(a);
      articlesByFeed.set(a.feedName, list);
    }

    const sections = Array.from(articlesByFeed.entries())
      .map(
        ([feedName, items]) => `
      <section>
        <h2>${esc(feedName)}</h2>
        ${items
          .map(
            (a) => `
        <article>
          <h3><a href="${esc(a.link)}">${esc(a.title)}</a></h3>
          <time datetime="${esc(a.pubDate)}">${new Date(a.pubDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</time>
          ${a.status === "error" ? "<p><em>Summary unavailable.</em></p>" : a.summary ? `<p>${esc(a.summary)}</p>` : ""}
        </article>`
          )
          .join("\n")}
      </section>`
      )
      .join("\n");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RSS Summarizer</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; max-width: 50rem; margin: 0 auto; padding: 1rem 1.5rem; line-height: 1.6; color: #222; background: #fafafa; }
    h1 { border-bottom: 2px solid #ddd; padding-bottom: 0.3rem; }
    h2 { color: #555; margin-top: 2rem; }
    article { border-left: 3px solid #ccc; padding: 0.5rem 1rem; margin: 1rem 0; background: #fff; }
    article h3 { margin: 0 0 0.25rem; font-size: 1.1rem; }
    article h3 a { color: #1a6; text-decoration: none; }
    article h3 a:hover { text-decoration: underline; }
    time { font-size: 0.85rem; color: #888; }
    article p { margin: 0.5rem 0 0; }
    footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ddd; font-size: 0.85rem; color: #888; }
  </style>
</head>
<body>
  <header>
    <h1>RSS Summarizer</h1>
    <p>${articles.length} articles from ${articlesByFeed.size} feed${articlesByFeed.size !== 1 ? "s" : ""} &mdash; <a href="/feed/all">RSS feed</a></p>
  </header>
  <main>${sections}</main>
  <footer>Powered by RSS Summarizer</footer>
</body>
</html>`;

    return c.html(html);
  });

  app.get("/health", (c) => {
    const stats = cache.getFeedStats();
    return c.json({
      status: "ok",
      feeds: config.feeds.map((f) => {
        const s = stats.find((st) => st.feedName === f.name);
        return {
          name: f.name,
          url: f.url,
          articles: s?.total ?? 0,
          summarized: s?.done ?? 0,
          errors: s?.errors ?? 0,
        };
      }),
    });
  });

  return app;
}
