import type { AppConfig, FeedConfig } from "./config.ts";
import { ArticleCache } from "./cache.ts";
import { Summarizer } from "./summarizer.ts";
import { parseFeed } from "./feed-parser.ts";
import { extractArticle } from "./article-extractor.ts";

const DELAY_BETWEEN_ARTICLES_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class FeedProcessor {
  private cache: ArticleCache;
  private summarizer: Summarizer;
  private config: AppConfig;
  private timers: Timer[] = [];

  constructor(cache: ArticleCache, summarizer: Summarizer, config: AppConfig) {
    this.cache = cache;
    this.summarizer = summarizer;
    this.config = config;
  }

  async processFeed(feedConfig: FeedConfig): Promise<void> {
    console.log(`[processor] Processing feed: ${feedConfig.name}`);

    const feed = await parseFeed(feedConfig.url);
    if (feed.items.length === 0) {
      console.log(`[processor] No items found for ${feedConfig.name}`);
      return;
    }

    let newCount = 0;
    let cachedCount = 0;
    let errorCount = 0;

    for (const item of feed.items) {
      if (this.cache.hasArticle(item.id)) {
        cachedCount++;
        continue;
      }

      // Insert as pending first
      this.cache.upsertArticle({
        id: item.id,
        feedName: feedConfig.name,
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        summary: null,
        imageUrl: item.imageUrl,
        status: "pending",
        errorMessage: null,
      });

      // Extract article content
      const extracted = await extractArticle(item.link);
      if (!extracted) {
        this.cache.markError(item.id, "Content extraction failed");
        errorCount++;
        await sleep(DELAY_BETWEEN_ARTICLES_MS);
        continue;
      }

      // Only use image if the feed provides one
      const imageUrl = item.imageUrl;

      // Summarize
      const summary = await this.summarizer.summarize(extracted.title || item.title, extracted.textContent);
      if (!summary) {
        this.cache.markError(item.id, "LLM summarization failed");
        errorCount++;
        await sleep(DELAY_BETWEEN_ARTICLES_MS);
        continue;
      }

      // Store completed article
      this.cache.upsertArticle({
        id: item.id,
        feedName: feedConfig.name,
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        summary,
        imageUrl,
        status: "done",
        errorMessage: null,
      });

      newCount++;
      await sleep(DELAY_BETWEEN_ARTICLES_MS);
    }

    console.log(
      `[processor] Feed ${feedConfig.name}: ${newCount} new, ${cachedCount} cached, ${errorCount} errors`
    );
  }

  async processAllFeeds(): Promise<void> {
    const results = await Promise.allSettled(
      this.config.feeds.map((feed) => this.processFeed(feed))
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      if (result.status === "rejected") {
        console.error(
          `[processor] Feed ${this.config.feeds[i]!.name} failed:`,
          result.reason
        );
      }
    }
  }

  startScheduler(): void {
    // Run initial pass
    this.processAllFeeds();

    // Schedule periodic refreshes per feed
    for (const feedConfig of this.config.feeds) {
      const intervalMs = feedConfig.refreshMinutes * 60 * 1000;
      const timer = setInterval(() => {
        this.processFeed(feedConfig).catch((error) => {
          console.error(`[scheduler] Error processing ${feedConfig.name}:`, error);
        });
      }, intervalMs);

      this.timers.push(timer);
      console.log(
        `[scheduler] Feed "${feedConfig.name}" scheduled every ${feedConfig.refreshMinutes}m`
      );
    }

    // Daily cache purge
    const purgeTimer = setInterval(() => {
      const deleted = this.cache.purgeOlderThan(this.config.cache.articleTtlDays);
      if (deleted > 0) {
        console.log(`[scheduler] Purged ${deleted} old articles from cache`);
      }
    }, 24 * 60 * 60 * 1000);

    this.timers.push(purgeTimer);
  }

  stopScheduler(): void {
    for (const timer of this.timers) {
      clearInterval(timer);
    }
    this.timers = [];
    console.log("[scheduler] All timers stopped");
  }
}
