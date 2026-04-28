import type {
  CensusData,
  WalkScoreData,
  NewsArticle,
} from "@workspace/api-zod";

/**
 * RMA Lead Scoring Model — assumptions documented inline.
 *
 * The product (an AI leasing assistant for multifamily property managers)
 * generates the most value when:
 *   1. The prospect operates in markets with a HIGH renter share
 *      (more inbound prospect chats per property → bigger automation lift).
 *   2. The prospect's company is LARGE / actively GROWING
 *      (multi-property portfolios get more value from a centralized AI
 *      assistant; growing companies have buying urgency and CapEx headroom).
 *   3. The market has high rent-per-unit
 *      (higher revenue at risk per missed lead → faster ROI on automation).
 *
 * Scoring: starts at 30 (cold-leaning default) and applies weighted adjustments.
 * Final value is clamped to [0, 100]. Each adjustment emits a human-readable
 * "reason" so SDRs can see exactly why a score landed where it did.
 *
 * Weight budget (max contribution if every signal is at its best):
 *   - Renter density (Census)            : +25  ←  primary ICP signal
 *   - Company size / portfolio (news)    : +20  ←  buying power signal
 *   - Recent growth mentions (news)      : +15  ←  buying urgency signal
 *   - Rent revenue at stake (Census)     : +10
 *   - Median household income (Census)   :  +8
 *   - Market size / population (Census)  :  +5
 *   ----------------------------------------
 *   Total upside from base 30            : +83  → caps at 100
 *   Negative pull-down for poor fit      : up to −25
 */
export interface BaseScore {
  score: number;
  reasons: string[];
}

const POSITIVE_GROWTH_TERMS = [
  "expansion",
  "expand",
  "growth",
  "grow",
  "growing",
  "hiring",
  "hires",
  "raises",
  "raised",
  "funding",
  "investment",
  "invests",
  "launches",
  "opens",
  "opening",
  "new property",
  "new community",
  "breaks ground",
  "groundbreaking",
];

const PORTFOLIO_SIZE_TERMS = [
  "portfolio",
  "properties",
  "communities",
  "units",
  "doors",
  "buildings",
  "national",
  "nationwide",
  "fortune",
  "largest",
  "leading",
  "top-ranked",
  "billion",
  "billion-dollar",
];

/** Computes a [0–100] heuristic lead score from WalkScore, Census, and news signals. */
export function computeBaseScore(args: {
  walk: WalkScoreData;
  census: CensusData;
  news: NewsArticle[];
}): BaseScore {
  let score = 30;
  const reasons: string[] = [];

  // ────────────────────────────────────────────────────────────
  // 1) RENTER DENSITY — primary ICP signal (max +25 / min −10)
  //    Assumption: every 10pp above 35% renters meaningfully
  //    expands the addressable resident-conversation volume.
  // ────────────────────────────────────────────────────────────
  const renterPct = args.census.renterOccupiedPct;
  if (renterPct !== null) {
    if (renterPct >= 65) {
      score += 25;
      reasons.push(
        `+25 Renter-dominant market (${renterPct}% renters) — peak ICP density`,
      );
    } else if (renterPct >= 50) {
      score += 18;
      reasons.push(
        `+18 Renter-majority market (${renterPct}% renters) — strong ICP fit`,
      );
    } else if (renterPct >= 35) {
      score += 8;
      reasons.push(`+8 Healthy renter share (${renterPct}%)`);
    } else if (renterPct >= 25) {
      score -= 2;
      reasons.push(`−2 Below-average renter share (${renterPct}%)`);
    } else {
      score -= 10;
      reasons.push(
        `−10 Owner-dominant market (only ${renterPct}% renters) — weak ICP fit`,
      );
    }
  } else {
    reasons.push("Renter share unavailable — neutral");
  }

  // ────────────────────────────────────────────────────────────
  // 2) COMPANY SIZE / PORTFOLIO SIGNALS from news (max +20)
  //    Assumption: news that mentions large portfolio language
  //    (units, communities, billion, national, etc.) is a proxy
  //    for buying power and centralized procurement.
  // ────────────────────────────────────────────────────────────
  const recentCutoff = Date.now() - 1000 * 60 * 60 * 24 * 180; // 180 days
  const recent = args.news.filter(
    (a) => new Date(a.publishedAt).getTime() >= recentCutoff,
  );
  const portfolioMatches = recent.filter((a) =>
    PORTFOLIO_SIZE_TERMS.some((term) =>
      (a.title + " " + (a.description ?? "")).toLowerCase().includes(term),
    ),
  );
  if (portfolioMatches.length >= 3) {
    score += 20;
    reasons.push(
      `+20 Strong portfolio-scale signal (${portfolioMatches.length} news mentions of size/portfolio language)`,
    );
  } else if (portfolioMatches.length === 2) {
    score += 13;
    reasons.push(`+13 Moderate portfolio-scale signal (2 news mentions)`);
  } else if (portfolioMatches.length === 1) {
    score += 7;
    reasons.push(`+7 Some portfolio-scale signal (1 news mention)`);
  } else if (recent.length === 0) {
    score -= 5;
    reasons.push(
      `−5 No recent news coverage — unknown company momentum (180-day window)`,
    );
  }

  // ────────────────────────────────────────────────────────────
  // 3) RECENT GROWTH MENTIONS from news (max +15)
  //    Assumption: terms like expansion, hiring, funding, opening
  //    correlate with budget cycles and willingness to pilot new
  //    operational tools.
  // ────────────────────────────────────────────────────────────
  const growthMatches = recent.filter((a) =>
    POSITIVE_GROWTH_TERMS.some((term) =>
      (a.title + " " + (a.description ?? "")).toLowerCase().includes(term),
    ),
  );
  if (growthMatches.length >= 3) {
    score += 15;
    reasons.push(
      `+15 Active growth signals — ${growthMatches.length} expansion/hiring/funding mentions`,
    );
  } else if (growthMatches.length === 2) {
    score += 10;
    reasons.push(`+10 Multiple growth signals (2 articles)`);
  } else if (growthMatches.length === 1) {
    score += 5;
    reasons.push(`+5 Recent growth mention (1 article)`);
  }

  // ────────────────────────────────────────────────────────────
  // 4) RENT REVENUE AT STAKE (max +10 / min −3)
  //    Assumption: higher rent per unit means each missed inbound
  //    is worth more in lifetime value, increasing AI ROI.
  // ────────────────────────────────────────────────────────────
  const rent = args.census.medianGrossRent;
  if (rent !== null) {
    if (rent >= 2400) {
      score += 10;
      reasons.push(
        `+10 Premium rent market ($${rent.toLocaleString()}/mo) — high revenue at stake`,
      );
    } else if (rent >= 1800) {
      score += 6;
      reasons.push(`+6 High rent market ($${rent.toLocaleString()}/mo)`);
    } else if (rent >= 1300) {
      score += 2;
      reasons.push(`+2 Moderate rent market ($${rent.toLocaleString()}/mo)`);
    } else if (rent < 900) {
      score -= 3;
      reasons.push(`−3 Low rent market ($${rent.toLocaleString()}/mo)`);
    }
  }

  // ────────────────────────────────────────────────────────────
  // 5) MEDIAN HOUSEHOLD INCOME (max +8 / min −5)
  //    Assumption: higher income tracts attract Class-A multifamily
  //    properties — RMA's sweet-spot product tier.
  // ────────────────────────────────────────────────────────────
  const income = args.census.medianHouseholdIncome;
  if (income !== null) {
    if (income >= 110000) {
      score += 8;
      reasons.push(
        `+8 Affluent area ($${income.toLocaleString()} median income) — Class-A territory`,
      );
    } else if (income >= 80000) {
      score += 4;
      reasons.push(`+4 Above-avg income ($${income.toLocaleString()})`);
    } else if (income < 45000) {
      score -= 5;
      reasons.push(`−5 Lower-income area ($${income.toLocaleString()})`);
    }
  }

  // ────────────────────────────────────────────────────────────
  // 7) MARKET SIZE / POPULATION (max +5 / min −7)
  //    Assumption: large MSAs have more multifamily inventory and
  //    a deeper pool of competing properties, increasing the value
  //    of differentiation through an AI assistant.
  // ────────────────────────────────────────────────────────────
  const pop = args.census.totalPopulation;
  if (pop !== null) {
    if (pop >= 500000) {
      score += 5;
      reasons.push(`+5 Major metro (pop. ${pop.toLocaleString()})`);
    } else if (pop >= 100000) {
      score += 3;
      reasons.push(`+3 Mid-sized metro (pop. ${pop.toLocaleString()})`);
    } else if (pop >= 25000) {
      score += 1;
    } else if (pop < 10000) {
      score -= 7;
      reasons.push(`−7 Small market (pop. ${pop.toLocaleString()})`);
    }
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
  };
}

/** Converts a numeric score to a hot/warm/cold tier label. */
export function tierFromScore(score: number): "hot" | "warm" | "cold" {
  if (score >= 75) return "hot";
  if (score >= 50) return "warm";
  return "cold";
}
