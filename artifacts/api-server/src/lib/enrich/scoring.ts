import type {
  CensusData,
  WalkScoreData,
  NewsArticle,
} from "@workspace/api-zod";

export interface BaseScore {
  score: number;
  reasons: string[];
}

const POSITIVE_NEWS_TERMS = [
  "expansion",
  "expand",
  "acquir",
  "acquisition",
  "growth",
  "grow",
  "hiring",
  "raises",
  "raised",
  "funding",
  "launches",
  "opens",
  "opening",
  "new property",
  "portfolio",
  "investment",
];

export function computeBaseScore(args: {
  walk: WalkScoreData;
  census: CensusData;
  news: NewsArticle[];
}): BaseScore {
  let score = 50;
  const reasons: string[] = [];

  // WalkScore signal — dense, walkable areas are high-value for EliseAI
  const w = args.walk.walk;
  if (w !== null) {
    if (w >= 90) {
      score += 14;
      reasons.push(`Excellent walkability (${w}) — dense urban demand`);
    } else if (w >= 70) {
      score += 9;
      reasons.push(`Very walkable (${w}) — strong urban renter market`);
    } else if (w >= 50) {
      score += 3;
      reasons.push(`Somewhat walkable (${w})`);
    } else if (w >= 25) {
      score -= 4;
      reasons.push(`Car-dependent area (walk score ${w})`);
    } else {
      score -= 10;
      reasons.push(`Rural / very car-dependent (walk score ${w})`);
    }
  }

  const t = args.walk.transit;
  if (t !== null && t >= 60) {
    score += 5;
    reasons.push(`Strong transit access (${t})`);
  }

  // Demographics — income and renter pct
  const income = args.census.medianHouseholdIncome;
  if (income !== null) {
    if (income >= 100000) {
      score += 10;
      reasons.push(
        `High median income ($${income.toLocaleString()}) — premium rental market`,
      );
    } else if (income >= 75000) {
      score += 5;
      reasons.push(`Above-avg income ($${income.toLocaleString()})`);
    } else if (income < 45000) {
      score -= 5;
      reasons.push(`Lower-income area ($${income.toLocaleString()})`);
    }
  }

  const rent = args.census.medianGrossRent;
  if (rent !== null && rent >= 1800) {
    score += 6;
    reasons.push(
      `High median gross rent ($${rent.toLocaleString()}/mo) — high revenue at stake`,
    );
  }

  const renterPct = args.census.renterOccupiedPct;
  if (renterPct !== null) {
    if (renterPct >= 50) {
      score += 8;
      reasons.push(`Renter-majority area (${renterPct}%) — core ICP`);
    } else if (renterPct >= 35) {
      score += 3;
      reasons.push(`Healthy renter share (${renterPct}%)`);
    } else if (renterPct < 25) {
      score -= 4;
      reasons.push(`Owner-dominant area (${renterPct}% renters)`);
    }
  }

  const pop = args.census.totalPopulation;
  if (pop !== null) {
    if (pop >= 250000) {
      score += 6;
      reasons.push(`Large metro (pop. ${pop.toLocaleString()})`);
    } else if (pop >= 50000) {
      score += 2;
    } else if (pop < 10000) {
      score -= 6;
      reasons.push(`Small market (pop. ${pop.toLocaleString()})`);
    }
  }

  // Recent news signals
  const recentCutoff = Date.now() - 1000 * 60 * 60 * 24 * 90;
  const recent = args.news.filter(
    (a) => new Date(a.publishedAt).getTime() >= recentCutoff,
  );
  if (recent.length > 0) {
    score += 3;
    reasons.push(`${recent.length} news mentions in last 90 days`);
    const positive = recent.filter((a) =>
      POSITIVE_NEWS_TERMS.some((term) =>
        (a.title + " " + (a.description ?? "")).toLowerCase().includes(term),
      ),
    );
    if (positive.length > 0) {
      score += 6;
      reasons.push(
        `Positive growth signals in news (${positive.length} article${positive.length > 1 ? "s" : ""})`,
      );
    }
  } else {
    reasons.push("No recent news coverage found");
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
  };
}

export function tierFromScore(score: number): "hot" | "warm" | "cold" {
  if (score >= 75) return "hot";
  if (score >= 50) return "warm";
  return "cold";
}
