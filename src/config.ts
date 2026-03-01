import { readFileSync, existsSync } from "fs";
import yaml from "js-yaml";

export interface LlmConfig {
  host: string;
  model: string;
  maxTokens: number;
}

export interface FeedConfig {
  name: string;
  url: string;
  refreshMinutes: number;
  maxItems: number;
}

export interface CacheConfig {
  dbPath: string;
  articleTtlDays: number;
}

export interface ServerConfig {
  port: number;
  host: string;
}

export interface AppConfig {
  server: ServerConfig;
  llm: LlmConfig;
  cache: CacheConfig;
  feeds: FeedConfig[];
}

export function loadConfig(path = "config.yaml"): AppConfig {
  if (!existsSync(path)) {
    console.error(
      `Config file not found: ${path}\nCopy config.example.yaml to config.yaml and edit it.`
    );
    process.exit(1);
  }

  const raw = yaml.load(readFileSync(path, "utf-8")) as Record<string, unknown>;

  if (!raw || typeof raw !== "object") {
    console.error("Invalid config file: expected a YAML object");
    process.exit(1);
  }

  const llmRaw = raw.llm as Record<string, unknown> | undefined;
  if (!llmRaw?.host || !llmRaw?.model) {
    console.error("Config error: llm.host and llm.model are required");
    process.exit(1);
  }

  const feedsRaw = raw.feeds as Array<Record<string, unknown>> | undefined;
  if (!feedsRaw || !Array.isArray(feedsRaw) || feedsRaw.length === 0) {
    console.error("Config error: at least one feed is required");
    process.exit(1);
  }

  const slugPattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
  const feeds: FeedConfig[] = feedsRaw.map((f, i) => {
    if (!f.name || !f.url) {
      console.error(`Config error: feeds[${i}] requires name and url`);
      process.exit(1);
    }
    const name = String(f.name);
    if (!slugPattern.test(name)) {
      console.error(
        `Config error: feeds[${i}].name "${name}" must be lowercase alphanumeric with hyphens (e.g. "my-feed")`
      );
      process.exit(1);
    }
    return {
      name,
      url: String(f.url),
      refreshMinutes: Number(f.refreshMinutes) || 30,
      maxItems: Number(f.maxItems) || 20,
    };
  });

  const serverRaw = (raw.server as Record<string, unknown>) || {};
  const cacheRaw = (raw.cache as Record<string, unknown>) || {};

  return {
    server: {
      port: Number(serverRaw.port) || 3000,
      host: String(serverRaw.host || "0.0.0.0"),
    },
    llm: {
      host: String(llmRaw.host),
      model: String(llmRaw.model),
      maxTokens: Number(llmRaw.maxTokens) || 500,
    },
    cache: {
      dbPath: String(cacheRaw.dbPath || "./data/cache.sqlite"),
      articleTtlDays: Number(cacheRaw.articleTtlDays) || 30,
    },
    feeds,
  };
}
