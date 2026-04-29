import { logger } from "../logger";
import type { CensusData, Lead, NewsArticle } from "@workspace/api-zod";

const GEMINI_API_KEY = process.env["GEMINI_API_KEY"];
const GEMINI_MODEL = "gemini-2.5-flash";

export interface GeminiInsightInput {
  lead: Pick<
    Lead,
    "name" | "email" | "company" | "propertyAddress" | "city" | "state" | "country"
  >;
  repNotes?: string | null;
  census: CensusData;
  news: NewsArticle[];
  baseScore: number;
  baseReasons: string[];
  tier: "hot" | "warm" | "cold";
}

export interface GeminiInsightOutput {
  scoreAdjustment: number;
  scoreReasons: string[];
  salesInsights: string[];
  talkingPoints: string[];
}

const SYSTEM_PROMPT = `You are an expert SDR assistant for EliseAI, an AI leasing assistant for multifamily property managers.

EliseAI handles 24/7 prospect management, AI-guided tours, scheduling, follow-ups, and move-in coordination so leasing teams can focus on closing. Best-fit prospects: multifamily operators with mid-to-large portfolios, actively growing, in renter-dense markets.

Your job:
1. Suggest a numeric score adjustment (-20 to +20) and explain why in 2–4 short bullet reasons. Use your own world knowledge about the company — if it is a well-known large operator (e.g. Greystar, AvalonBay, Camden, MAA, Equity Residential, NMI, Lincoln Property), apply a strong positive adjustment even if no news was provided. Absence of news does not mean a weak prospect. Distinguish between "unknown small operator" (neutral) and "known large/national operator" (positive boost).
2. Produce 3–5 SALES INSIGHTS — concrete, useful facts a rep needs before calling. Draw on your knowledge of the company's portfolio size, markets, and reputation.
3. Produce 3–5 TALKING POINTS — specific things to mention on a call.

If rep notes are provided, use them to make insights and talking points more specific.

Output strictly valid JSON matching the provided schema. No markdown, no extra prose.`;

/** Calls the Gemini API to produce score adjustments, sales insights, and talking points. */
export async function generateInsights(
  input: GeminiInsightInput,
): Promise<GeminiInsightOutput | null> {
  if (!GEMINI_API_KEY) return null;

  const userContent = JSON.stringify({
    lead: input.lead,
    repNotes: input.repNotes || null,
    tier: input.tier,
    demographics: input.census,
    recentNews: input.news.map((n) => ({
      title: n.title,
      source: n.source,
      publishedAt: n.publishedAt,
      summary: n.description,
    })),
    heuristicScore: input.baseScore,
    heuristicReasons: input.baseReasons,
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userContent }] }],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          scoreAdjustment: { type: "number" },
          scoreReasons: { type: "array", items: { type: "string" } },
          salesInsights: { type: "array", items: { type: "string" } },
          talkingPoints: { type: "array", items: { type: "string" } },
        },
        required: [
          "scoreAdjustment",
          "scoreReasons",
          "salesInsights",
          "talkingPoints",
        ],
      },
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.warn({ status: res.status, text }, "Gemini returned non-200");
      return null;
    }
    const json = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as GeminiInsightOutput;
    return parsed;
  } catch (err) {
    logger.warn({ err }, "Gemini error");
    return null;
  }
}
