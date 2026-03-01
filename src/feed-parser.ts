import Parser from "rss-parser";

export interface ParsedFeedItem {
  id: string;
  title: string;
  link: string;
  pubDate: string;
}

export interface ParsedFeed {
  title: string;
  description: string;
  link: string;
  items: ParsedFeedItem[];
}

const parser = new Parser();

export async function parseFeed(url: string): Promise<ParsedFeed> {
  try {
    const feed = await parser.parseURL(url);

    const items: ParsedFeedItem[] = (feed.items || [])
      .filter((item) => item.link)
      .map((item) => ({
        id: item.guid || item.link!,
        title: item.title || "Untitled",
        link: item.link!,
        pubDate: item.isoDate || new Date().toISOString(),
      }));

    return {
      title: feed.title || "Untitled Feed",
      description: feed.description || "",
      link: feed.link || url,
      items,
    };
  } catch (error) {
    console.error(`[feed-parser] Failed to parse feed ${url}:`, error);
    return {
      title: "Untitled Feed",
      description: "",
      link: url,
      items: [],
    };
  }
}
