import type { Lead, LeadEnrichment } from "@workspace/api-zod";
import { logger } from "../logger";
import { geocodeAddress } from "./geocode";
import { fetchCensusData } from "./census";
import { fetchNews } from "./news";
import { generateInsights } from "./gemini";
import { computeBaseScore, tierFromScore } from "./scoring";

/** Extracts the first word from a full name. */
function firstName(fullName: string): string {
  return fullName.split(" ")[0] ?? fullName;
}

/** Returns a tier-appropriate subject and body email template signed by Rupa. */
function buildTemplateEmail(
  lead: Pick<Lead, "name" | "company" | "city" | "state">,
  tier: "hot" | "warm" | "cold",
): { subject: string; body: string } {
  const name = firstName(lead.name);
  const company = lead.company;
  const city = lead.city;
  const state = lead.state;

  if (tier === "hot") {
    return {
      subject: `leasing ops at ${company}`,
      body: `Hi ${name},\n\nManaging leasing at scale in ${city} is no small thing — between after-hours inquiries, tour scheduling, and resident follow-ups, the volume adds up fast.\n\nEliseAI handles all of that automatically — prospect management, AI-guided tours, even move-in coordination — so your team can focus on the work that actually needs a human.\n\nWould love to show you what it looks like in practice:\nBook 15 minutes here: https://eliseai.com/book-a-demo\n\nBest,\nRupa`,
    };
  }

  if (tier === "warm") {
    return {
      subject: `how is ${company} handling leasing volume?`,
      body: `Hi ${name},\n\nCurious how your team is currently managing prospect inquiries and tour scheduling in ${city} — especially after hours.\n\nA lot of operators we talk to are dealing with the same thing: leasing staff stretched thin, response times slipping, leads going cold. EliseAI plugs into your existing workflow and handles the repetitive stuff — follow-ups, scheduling, renewals — so nothing falls through the cracks.\n\nHappy to walk you through it if it sounds relevant:\nGrab a time here: https://eliseai.com/book-a-demo\n\nBest,\nRupa`,
    };
  }

  return {
    subject: `quick one for ${company}`,
    body: `Hi ${name},\n\nCame across ${company} and wanted to reach out — we work with property managers across ${state} on automating the parts of leasing that eat up the most time: inquiries, tour coordination, maintenance follow-ups, renewals.\n\nNot sure if the timing is right for you, but if it's something you're thinking about this year, happy to share what operators similar to you are doing.\n\nTake a look here: https://eliseai.com/book-a-demo\n\nBest,\nRupa`,
  };
}

/** Runs the full enrichment pipeline: geocode → Census → news → AI → score. */
export async function enrichLead(lead: Lead): Promise<LeadEnrichment> {
  const warnings: string[] = [];
  const fullAddress = `${lead.propertyAddress}, ${lead.city}, ${lead.state}`;

  const geo = await geocodeAddress(fullAddress);
  if (!geo) warnings.push("Could not geocode the property address");

  const [census, news] = await Promise.all([
    geo
      ? fetchCensusData(geo)
      : Promise.resolve({
          medianHouseholdIncome: null,
          medianGrossRent: null,
          medianHomeValue: null,
          totalPopulation: null,
          renterOccupiedPct: null,
          bachelorsOrHigherPct: null,
          placeName: null,
        }),
    fetchNews(lead.company),
  ]);

  if (!census.medianHouseholdIncome && !census.totalPopulation) {
    warnings.push("Census ACS data unavailable for this address");
  }

  if (news.length === 0) warnings.push("No recent news found for this company");

  const base = computeBaseScore({ census, news });
  const baseTier = tierFromScore(base.score);

  let aiInsights = await generateInsights({
    lead: {
      name: lead.name,
      email: lead.email,
      company: lead.company,
      propertyAddress: lead.propertyAddress,
      city: lead.city,
      state: lead.state,
      country: lead.country,
    },
    repNotes: lead.notes,
    census,
    news,
    baseScore: base.score,
    baseReasons: base.reasons,
    tier: baseTier,
  });

  if (!aiInsights) {
    warnings.push("AI insights unavailable — showing heuristic data only");
    aiInsights = {
      scoreAdjustment: 0,
      scoreReasons: [],
      salesInsights: buildFallbackInsights(lead, census, news),
      talkingPoints: buildFallbackTalkingPoints(lead, census),
    };
  }

  const adjusted = Math.max(
    0,
    Math.min(100, Math.round(base.score + aiInsights.scoreAdjustment)),
  );

  const finalTier = tierFromScore(adjusted);
  const outreachEmail = buildTemplateEmail(lead, finalTier);

  const enrichment: LeadEnrichment = {
    score: adjusted,
    tier: finalTier,
    scoreReasons: [...base.reasons, ...aiInsights.scoreReasons],
    salesInsights: aiInsights.salesInsights,
    talkingPoints: aiInsights.talkingPoints,
    outreachEmail,
    walkScore: {
      walk: null,
      walkDescription: null,
      transit: null,
      transitDescription: null,
      bike: null,
      bikeDescription: null,
    },
    census,
    news,
    enrichedAt: new Date().toISOString(),
    warnings,
  };

  logger.info(
    {
      leadId: lead.id,
      score: enrichment.score,
      tier: enrichment.tier,
      warnings: warnings.length,
    },
    "Lead enriched",
  );

  return enrichment;
}

/** Generates heuristic sales insights from Census and news data when AI is unavailable. */
function buildFallbackInsights(
  lead: Lead,
  census: {
    medianHouseholdIncome: number | null;
    totalPopulation: number | null;
  },
  news: Array<{ title: string }>,
): string[] {
  const out: string[] = [];
  if (census.medianHouseholdIncome !== null)
    out.push(
      `Local median household income is $${census.medianHouseholdIncome.toLocaleString()}.`,
    );
  if (census.totalPopulation !== null)
    out.push(`Area population: ${census.totalPopulation.toLocaleString()}.`);
  if (news.length > 0) out.push(`Latest news headline: "${news[0]?.title}"`);
  out.push(`Operates ${lead.company} in ${lead.city}, ${lead.state}.`);
  return out;
}

/** Generates heuristic talking points from Census data when AI is unavailable. */
function buildFallbackTalkingPoints(
  lead: Lead,
  census: { medianGrossRent: number | null },
): string[] {
  const out: string[] = [];
  out.push(`Mention the ${lead.city} multifamily market specifically.`);
  if (census.medianGrossRent !== null && census.medianGrossRent >= 1500)
    out.push(
      `Tie ROI to the high local rent (~$${census.medianGrossRent.toLocaleString()}/mo).`,
    );
  out.push("Ask about current leasing team headcount and after-hours coverage.");
  return out;
}
