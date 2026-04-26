import type { Lead, LeadEnrichment } from "@workspace/api-zod";
import { logger } from "../logger";
import { geocodeAddress } from "./geocode";
import { fetchCensusData } from "./census";
import { fetchWalkScore } from "./walkscore";
import { fetchNews } from "./news";
import { generateInsights } from "./gemini";
import { computeBaseScore, tierFromScore } from "./scoring";

export async function enrichLead(lead: Lead): Promise<LeadEnrichment> {
  const warnings: string[] = [];
  const fullAddress = `${lead.propertyAddress}, ${lead.city}, ${lead.state}`;

  // Geocode (required for census + walkscore)
  const geo = await geocodeAddress(fullAddress);
  if (!geo) warnings.push("Could not geocode the property address");

  const [census, walk, news] = await Promise.all([
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
    geo
      ? fetchWalkScore(fullAddress, geo.lat, geo.lon)
      : Promise.resolve({
          walk: null,
          walkDescription: null,
          transit: null,
          transitDescription: null,
          bike: null,
          bikeDescription: null,
        }),
    fetchNews(lead.company),
  ]);

  if (!census.medianHouseholdIncome && !census.totalPopulation) {
    warnings.push("Census ACS data unavailable for this address");
  }
  if (walk.walk === null) warnings.push("WalkScore unavailable for this address");
  if (news.length === 0) warnings.push("No recent news found for this company");

  const base = computeBaseScore({ walk, census, news });

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
    walk,
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
      salesInsights: buildFallbackInsights(lead, walk, census, news),
      talkingPoints: buildFallbackTalkingPoints(lead, walk, census),
      outreachEmail: buildFallbackEmail(lead, census, walk),
    };
  }

  const adjusted = Math.max(
    0,
    Math.min(100, Math.round(base.score + aiInsights.scoreAdjustment)),
  );

  const enrichment: LeadEnrichment = {
    score: adjusted,
    tier: tierFromScore(adjusted),
    scoreReasons: [...base.reasons, ...aiInsights.scoreReasons],
    salesInsights: aiInsights.salesInsights,
    talkingPoints: aiInsights.talkingPoints,
    outreachEmail: aiInsights.outreachEmail,
    walkScore: walk,
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

function buildFallbackInsights(
  lead: Lead,
  walk: { walk: number | null },
  census: {
    medianHouseholdIncome: number | null;
    totalPopulation: number | null;
  },
  news: Array<{ title: string }>,
): string[] {
  const out: string[] = [];
  if (walk.walk !== null)
    out.push(`Walk Score for the building is ${walk.walk}.`);
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

function buildFallbackTalkingPoints(
  lead: Lead,
  walk: { walk: number | null },
  census: { medianGrossRent: number | null },
): string[] {
  const out: string[] = [];
  out.push(`Mention the ${lead.city} multifamily market specifically.`);
  if (walk.walk !== null && walk.walk >= 70)
    out.push("Highlight tenant inquiry volume in walkable urban buildings.");
  if (census.medianGrossRent !== null && census.medianGrossRent >= 1500)
    out.push(
      `Tie ROI to the high local rent (~$${census.medianGrossRent.toLocaleString()}/mo).`,
    );
  out.push("Ask about current leasing team headcount and after-hours coverage.");
  return out;
}

function buildFallbackEmail(
  lead: Lead,
  census: { placeName: string | null; medianGrossRent: number | null; renterOccupiedPct: number | null },
  walk: { walk: number | null },
): { subject: string; body: string } {
  const firstName = lead.name.split(" ")[0];
  const place = census.placeName ?? lead.city;

  let hook: string;
  if (census.renterOccupiedPct !== null && census.renterOccupiedPct >= 50) {
    hook = `${Math.round(census.renterOccupiedPct)}% of ${place} households rent — that's a lot of inbound leasing traffic for your team to handle.`;
  } else if (census.medianGrossRent !== null && census.medianGrossRent >= 1500) {
    hook = `Median rents in ${place} are sitting around $${census.medianGrossRent.toLocaleString()}/mo — at that price point, every missed inquiry is real revenue out the door.`;
  } else if (walk.walk !== null && walk.walk >= 70) {
    hook = `${lead.company}'s building scores a ${walk.walk} Walk Score, which means high resident inquiry volume — tours, pricing, follow-ups — coming in around the clock.`;
  } else {
    hook = `Noticed ${lead.company} operates in ${place} — curious how your team handles leasing inquiries after hours.`;
  }

  return {
    subject: `${lead.city} multifamily + RMA`,
    body: `Hi ${firstName},\n\n${hook} RMA's AI handles those conversations 24/7 so your leasing team can focus on closing — teams typically see tour bookings up 30%+ in the first quarter.\n\nWorth a quick chat?\n\n{{REP_NAME}} from RMA`,
  };
}
