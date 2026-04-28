import { logger } from "../logger";
import type { NewsArticle } from "@workspace/api-zod";

const NEWS_API_KEY = process.env["NEWS_API_KEY"];

const REAL_ESTATE_CONTEXT =
  `(apartment OR multifamily OR "real estate" OR residential OR properties OR leasing OR REIT OR housing OR "property management")`;

/**
 * Fetches recent news articles about a company, filtered to real estate context or location.
 * Results are post-filtered to ensure the company name appears in the title or description.
 */
export async function fetchNews(
  companyName: string,
  city: string,
  state: string,
): Promise<NewsArticle[]> {
  if (!NEWS_API_KEY) return [];

  const locationContext = `("${city}" OR "${state}")`;
  const q = `"${companyName}" AND (${REAL_ESTATE_CONTEXT} OR ${locationContext})`;

  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", q);
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("language", "en");
  url.searchParams.set("pageSize", "10");

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

    const nameLower = companyName.toLowerCase();
    const relevant = (json.articles ?? []).filter((a) => {
      const haystack = `${a.title} ${a.description ?? ""}`.toLowerCase();
      return haystack.includes(nameLower);
    });

    return relevant.slice(0, 5).map((a) => ({
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
