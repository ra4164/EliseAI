import { logger } from "../logger";
import type { NewsArticle } from "@workspace/api-zod";

const NEWS_API_KEY = process.env["NEWS_API_KEY"];

/** Fetches up to 5 recent English news articles matching the query via NewsAPI. */
export async function fetchNews(query: string): Promise<NewsArticle[]> {
  if (!NEWS_API_KEY) return [];
  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", `"${query}"`);
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("language", "en");
  url.searchParams.set("pageSize", "5");

  try {
    const res = await fetch(url, {
      headers: { "X-Api-Key": NEWS_API_KEY },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "NewsAPI returned non-200");
      return [];
    }
    const json = (await res.json()) as {
      articles?: Array<{
        title: string;
        url: string;
        publishedAt: string;
        description?: string | null;
        source?: { name?: string };
      }>;
    };
    return (json.articles ?? []).slice(0, 5).map((a) => ({
      title: a.title,
      url: a.url,
      publishedAt: a.publishedAt,
      description: a.description ?? null,
      source: a.source?.name ?? "Unknown",
    }));
  } catch (err) {
    logger.warn({ err }, "NewsAPI error");
    return [];
  }
}
