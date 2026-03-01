import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

const MAX_CONTENT_LENGTH = 8000;
const FETCH_TIMEOUT_MS = 15000;

export interface ExtractedArticle {
  title: string;
  textContent: string;
  excerpt: string;
}

export async function extractArticle(url: string): Promise<ExtractedArticle | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; RSS-Summarizer/1.0; +https://github.com/rss-summarizer)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[extractor] HTTP ${response.status} for ${url}`);
      return null;
    }

    const html = await response.text();
    const { document } = parseHTML(html);

    const reader = new Readability(document);
    const article = reader.parse();

    if (!article || !article.textContent?.trim()) {
      console.error(`[extractor] Readability returned no content for ${url}`);
      return null;
    }

    const textContent = article.textContent.trim().slice(0, MAX_CONTENT_LENGTH);

    return {
      title: article.title || "Untitled",
      textContent,
      excerpt: article.excerpt || "",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[extractor] Failed to extract ${url}: ${message}`);
    return null;
  }
}
