import { Database } from "bun:sqlite";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";

export interface CachedArticle {
  id: string;
  feedName: string;
  title: string;
  link: string;
  pubDate: string;
  summary: string | null;
  status: "pending" | "done" | "error";
  errorMessage: string | null;
}

export class ArticleCache {
  private db: Database;

  constructor(dbPath: string) {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.exec("PRAGMA journal_mode=WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        feed_name TEXT NOT NULL,
        title TEXT,
        link TEXT,
        pub_date TEXT,
        summary TEXT,
        status TEXT DEFAULT 'pending',
        error_message TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_articles_feed ON articles(feed_name);
      CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
      CREATE INDEX IF NOT EXISTS idx_articles_created ON articles(created_at);
    `);
  }

  hasArticle(id: string): boolean {
    const row = this.db.query("SELECT 1 FROM articles WHERE id = ?").get(id);
    return row !== null;
  }

  getArticlesByFeed(feedName: string, limit: number): CachedArticle[] {
    const rows = this.db
      .query(
        `SELECT id, feed_name, title, link, pub_date, summary, status, error_message
         FROM articles
         WHERE feed_name = ? AND status = 'done'
         ORDER BY pub_date DESC
         LIMIT ?`
      )
      .all(feedName, limit) as Array<{
      id: string;
      feed_name: string;
      title: string;
      link: string;
      pub_date: string;
      summary: string | null;
      status: "done";
      error_message: string | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      feedName: r.feed_name,
      title: r.title,
      link: r.link,
      pubDate: r.pub_date,
      summary: r.summary,
      status: r.status,
      errorMessage: r.error_message,
    }));
  }

  upsertArticle(article: CachedArticle): void {
    this.db
      .query(
        `INSERT INTO articles (id, feed_name, title, link, pub_date, summary, status, error_message, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           summary = excluded.summary,
           status = excluded.status,
           error_message = excluded.error_message,
           updated_at = datetime('now')`
      )
      .run(
        article.id,
        article.feedName,
        article.title,
        article.link,
        article.pubDate,
        article.summary,
        article.status,
        article.errorMessage
      );
  }

  markError(id: string, message: string): void {
    this.db
      .query(
        `UPDATE articles SET status = 'error', error_message = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .run(message, id);
  }

  purgeOlderThan(days: number): number {
    const result = this.db
      .query(`DELETE FROM articles WHERE created_at < datetime('now', '-' || ? || ' days')`)
      .run(days);
    return result.changes;
  }

  getFeedStats(): Array<{ feedName: string; total: number; done: number; errors: number }> {
    const rows = this.db
      .query(
        `SELECT feed_name,
                COUNT(*) as total,
                SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
         FROM articles GROUP BY feed_name`
      )
      .all() as Array<{ feed_name: string; total: number; done: number; errors: number }>;

    return rows.map((r) => ({
      feedName: r.feed_name,
      total: r.total,
      done: r.done,
      errors: r.errors,
    }));
  }

  close(): void {
    this.db.close();
  }
}
