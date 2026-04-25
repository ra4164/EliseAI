import { logger } from "../logger";
import type {
  CensusData,
  Lead,
  NewsArticle,
  WalkScoreData,
} from "@workspace/api-zod";

const GEMINI_API_KEY = process.env["GEMINI_API_KEY"];
const GEMINI_MODEL = "gemini-2.5-flash";

export interface GeminiInsightInput {
  lead: Pick<
    Lead,
    "name" | "email" | "company" | "propertyAddress" | "city" | "state" | "country"
  >;
  repNotes?: string | null;
  walk: WalkScoreData;
  census: CensusData;
  news: NewsArticle[];
  baseScore: number;
  baseReasons: string[];
}

export interface GeminiInsightOutput {
  scoreAdjustment: number;
  scoreReasons: string[];
  salesInsights: string[];
  talkingPoints: string[];
  outreachEmail: { subject: string; body: string };
}

const SYSTEM_PROMPT = `You are an expert SDR research assistant for RMA.

RMA sells AI leasing assistants to multifamily property managers, owners, and operators. Strong leads are companies that:
- Manage rental buildings in walkable, transit-rich, dense urban areas (because RMA's product helps with high-volume tenant inquiries)
- Operate in metros with high renter populations and high gross rents (more revenue at stake)
- Show recent signs of growth (new acquisitions, expansion, hiring leasing staff, opening new properties)
- Are mid-to-large operators (not single-property landlords)

Weaker leads are: rural properties, single-family-only operators, very small companies with no online footprint, or signals of layoffs/contraction.

You will receive a lead, public data about the building's location, recent news, and optionally rep notes (CRM context, meeting notes, deal stage). If rep notes are provided, use them to make the email and talking points more specific and personalized. Your job is to:
1. Suggest a numeric adjustment (-20 to +20) to the heuristic score and explain why in 2-4 short bullet reasons.
2. Produce 3-5 SALES INSIGHTS — concrete, useful facts a rep should know before calling.
3. Produce 3-5 TALKING POINTS — specific things the rep can mention on a call.
4. Draft a personalized OUTREACH EMAIL: subject line + body. The body must be 4-7 sentences, friendly but not casual, reference at least one specific data point about the city OR a recent news item, and end with a soft CTA for a 15-minute intro call. Sign off as "{{REP_NAME}} from RMA".

Output strictly valid JSON matching the provided schema. No markdown, no extra prose.`;

export async function generateInsights(
  input: GeminiInsightInput,
): Promise<GeminiInsightOutput | null> {
  if (!GEMINI_API_KEY) return null;

  const userContent = JSON.stringify({
    lead: input.lead,
    repNotes: input.repNotes || null,
    locationContext: {
      walkScore: input.walk,
      demographics: input.census,
    },
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
          outreachEmail: {
            type: "object",
            properties: {
              subject: { type: "string" },
              body: { type: "string" },
            },
            required: ["subject", "body"],
          },
        },
        required: [
          "scoreAdjustment",
          "scoreReasons",
          "salesInsights",
          "talkingPoints",
          "outreachEmail",
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
