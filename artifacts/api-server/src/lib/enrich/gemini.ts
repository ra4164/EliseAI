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
  tier: "hot" | "warm" | "cold";
}

export interface GeminiInsightOutput {
  scoreAdjustment: number;
  scoreReasons: string[];
  salesInsights: string[];
  talkingPoints: string[];
  outreachEmail: { subject: string; body: string };
}

const SYSTEM_PROMPT = `You are an expert SDR assistant for RMA, an AI leasing assistant for multifamily property managers.

RMA's product handles 24/7 tenant inquiries (tours, pricing, follow-ups) so leasing teams can focus on closing. Best-fit prospects: multifamily operators in walkable, high-renter markets, actively growing, mid-to-large portfolios.

Your job:
1. Suggest a numeric score adjustment (-20 to +20) and explain why in 2–4 short bullet reasons.
2. Produce 3–5 SALES INSIGHTS — concrete, useful facts a rep needs before calling.
3. Produce 3–5 TALKING POINTS — specific things to mention on a call.
4. Draft an OUTREACH EMAIL following the strict rules below.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMAIL RULES — NON-NEGOTIABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LENGTH: 3–5 sentences maximum. Not one sentence more.

OPENING SENTENCE: Must open with a specific hook about the PROSPECT — a recent news headline, their renter-market percentage, their local rent level, or a growth signal. NEVER open with "I'm reaching out from RMA", "I wanted to reach out", or any variant that leads with RMA.

TONE BY TIER (use the "tier" field in the input):
  • HOT  — Direct and specific. Assume they're open to buying. Reference one concrete detail (news, stat). Propose a specific next step: "Are you free Thursday for a 15-min call?" Don't hedge.
  • WARM — Curious and ROI-focused. Ask one question about their current leasing process. Tie it to a specific market stat (rent, renter %, walk score).
  • COLD — Educational, zero pressure. One soft question at the end ("Worth a quick chat?"). Plant the seed, don't pitch hard. One relevant fact, stated conversationally.

SUBJECT LINE: Specific and curiosity-driven. Use the company name, city, or a data point. Examples: "Austin multifamily + RMA", "Saw your Q1 expansion — quick thought", "Dallas renter market + leasing AI". NEVER use generic subjects like "Partnership Opportunity", "Introduction", or "Quick Question".

SIGN-OFF: End with "{{REP_NAME}} from RMA" — no variations.

DO NOT include: "Hope this finds you well", "I know your time is valuable", multi-paragraph pitches, bulleted lists, or any sentence that could appear in a mass template.

If rep notes are provided, use them to make the email and talking points more specific.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Output strictly valid JSON matching the provided schema. No markdown, no extra prose.`;

export async function generateInsights(
  input: GeminiInsightInput,
): Promise<GeminiInsightOutput | null> {
  if (!GEMINI_API_KEY) return null;

  const userContent = JSON.stringify({
    lead: input.lead,
    repNotes: input.repNotes || null,
    tier: input.tier,
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
