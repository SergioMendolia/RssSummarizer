import { Hono } from "hono";
import type { AppConfig } from "./config.ts";
import { type ArticleCache } from "./cache.ts";
import { generateFeed } from "./feed-generator.ts";

export function createServer(cache: ArticleCache, config: AppConfig): Hono {
  const app = new Hono();
  const baseUrl = `http://${config.server.host === "0.0.0.0" ? "localhost" : config.server.host}:${config.server.port}`;

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
