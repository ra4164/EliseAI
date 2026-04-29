import { logger } from "../logger";
import type { NewsArticle } from "@workspace/api-zod";

const NEWS_API_KEY = process.env["NEWS_API_KEY"];

const REAL_ESTATE_CONTEXT = `(apartment OR multifamily OR "real estate" OR residential OR properties OR leasing OR REIT OR housing OR "property management" OR rent OR rental)`;

const BUYING_SIGNALS = `(funding OR hiring OR layoffs OR acquisition OR expansion OR raises OR IPO OR "going public" OR merger OR "joint venture" OR "new community" OR groundbreaking)`;

const REAL_ESTATE_TERMS = [
  "apartment", "multifamily", "real estate", "residential", "properties",
  "leasing", "reit", "housing", "property management", "rent", "rental",
];

const BUYING_SIGNAL_TERMS = [
  "funding", "funded", "raises", "raised", "investment", "series a", "series b",
  "series c", "venture", "ipo", "going public",
  "hiring", "hires", "hired", "jobs", "workforce", "headcount", "talent",
  "layoff", "layoffs", "cut", "cuts", "reduction", "downsizing",
  "acquisition", "acquires", "acquired", "merger", "merges", "joint venture",
  "expansion", "expands", "expand", "growth", "grow", "opening", "opens",
  "launch", "launches", "new community", "new property", "groundbreaking",
  "breaks ground",
];

/**
 * Fetches recent news relevant to a company or its local real estate market.
 * Captures both company-specific articles and location-level buying signals
 * (funding, hiring, layoffs, expansion, market trends).
 */
export async function fetchNews(
  companyName: string,
  city: string,
  state: string,
): Promise<NewsArticle[]> {
  if (!NEWS_API_KEY) return [];

  const signals = `(${REAL_ESTATE_CONTEXT} OR ${BUYING_SIGNALS})`;
  const q = `("${companyName}" AND ${signals}) OR ("${city}" AND ${signals})`;

  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", q);
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("language", "en");
  url.searchParams.set("pageSize", "15");

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
    const cityLower = city.toLowerCase();
    const stateLower = state.toLowerCase();

    const relevant = (json.articles ?? []).filter((a) => {
      const haystack = `${a.title} ${a.description ?? ""}`.toLowerCase();
      const hasCompany = haystack.includes(nameLower);
      const hasLocation =
        haystack.includes(cityLower) || haystack.includes(stateLower);
      const hasSignal =
        REAL_ESTATE_TERMS.some((t) => haystack.includes(t)) ||
        BUYING_SIGNAL_TERMS.some((t) => haystack.includes(t));
      return hasCompany || (hasLocation && hasSignal);
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
