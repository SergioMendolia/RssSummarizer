import { loadConfig } from "./config.ts";
import { ArticleCache } from "./cache.ts";
import { Summarizer } from "./summarizer.ts";
import { FeedProcessor } from "./feed-processor.ts";
import { createServer } from "./server.ts";

const config = loadConfig();
const cache = new ArticleCache(config.cache.dbPath);
const summarizer = new Summarizer(config.llm);
const processor = new FeedProcessor(cache, summarizer, config);

const app = createServer(cache, config);

// Start feed processing scheduler
processor.startScheduler();

// Graceful shutdown
function shutdown() {
  console.log("\nShutting down...");
  processor.stopScheduler();
  cache.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(`RSS Summarizer running on http://${config.server.host}:${config.server.port}`);
console.log(`Feeds: ${config.feeds.map((f) => `/feed/${f.name}`).join(", ")}, /feed/all`);

export default {
  port: config.server.port,
  hostname: config.server.host,
  fetch: app.fetch,
};
