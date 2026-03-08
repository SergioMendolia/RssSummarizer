import { Ollama } from "ollama";
import type { LlmConfig } from "./config.ts";

const SYSTEM_PROMPT = `You are a concise news summarizer. Given an article's title and content, write a clear 4-6 sentence summary capturing the key points. Be factual and neutral. Do not include any preamble like "This article discusses..." — just state the key information directly. Always write the summary in the same language as the article.`;

export class Summarizer {
  private client: Ollama;
  private model: string;
  private maxTokens: number;

  constructor(config: LlmConfig) {
    this.client = new Ollama({ host: config.host });
    this.model = config.model;
    this.maxTokens = config.maxTokens;
  }

  async summarize(title: string, textContent: string): Promise<string | null> {
    try {
      const response = await this.client.chat({
        model: this.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Title: ${title}\n\nContent:\n${textContent}`,
          },
        ],
        options: {
          temperature: 0.3,
          num_predict: this.maxTokens,
        },
      });

      const summary = response.message.content?.trim();
      if (!summary) {
        console.error("[summarizer] LLM returned empty response");
        return null;
      }

      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[summarizer] LLM error: ${message}`);
      return null;
    }
  }
}
