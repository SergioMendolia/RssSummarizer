import Parser from "rss-parser";

export interface ParsedFeedItem {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  imageUrl: string | null;
}

export interface ParsedFeed {
  title: string;
  description: string;
  link: string;
  items: ParsedFeedItem[];
}

type FeedItem = Parser.Item & {
  enclosure?: { url?: string; type?: string };
  "media:content"?: { $?: { url?: string; medium?: string } };
  "media:thumbnail"?: { $?: { url?: string } };
};

const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "media:content"],
      ["media:thumbnail", "media:thumbnail"],
    ],
  },
});

function extractFeedImage(item: FeedItem): string | null {
  // 1. Enclosure with image type
  if (item.enclosure?.url && item.enclosure.type?.startsWith("image/")) {
    return item.enclosure.url;
  }
  // 2. media:content with image medium
  const media = item["media:content"];
  if (media?.$?.url && (!media.$.medium || media.$.medium === "image")) {
    return media.$.url;
  }
  // 3. media:thumbnail
  const thumb = item["media:thumbnail"];
  if (thumb?.$?.url) {
    return thumb.$.url;
  }
  // 4. Enclosure without type (might still be an image)
  if (item.enclosure?.url) {
    return item.enclosure.url;
  }
  return null;
}

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
        imageUrl: extractFeedImage(item as FeedItem),
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
