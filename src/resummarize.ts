import { loadConfig } from "./config.ts";
import { ArticleCache } from "./cache.ts";
import { Summarizer } from "./summarizer.ts";
import { FeedProcessor } from "./feed-processor.ts";

const config = loadConfig();
const cache = new ArticleCache(config.cache.dbPath);
const summarizer = new Summarizer(config.llm);
const processor = new FeedProcessor(cache, summarizer, config);

try {
  await processor.resummarizeErrors();
} finally {
  cache.close();
}
