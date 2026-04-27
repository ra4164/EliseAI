export interface FunnelPrediction {
  label: string;
  likelihood: number;
  detail: string;
  scoreAdjustment: number;
  accentColor: string;
  bgColor: string;
}

const FUNNEL_PREDICTIONS: Record<string, FunnelPrediction> = {
  contacted: {
    label: "Awaiting Reply",
    likelihood: 25,
    detail: "Rep reached out — waiting on prospect response.",
    scoreAdjustment: 5,
    accentColor: "#2563EB",
    bgColor: "#EFF6FF",
  },
  replied: {
    label: "Prospect Engaged",
    likelihood: 40,
    detail: "Prospect responded — opportunity is active.",
    scoreAdjustment: 10,
    accentColor: "#D97706",
    bgColor: "#FFFBEB",
  },
  ghosted: {
    label: "Low Likelihood",
    likelihood: 8,
    detail: "No reply after outreach — follow up or deprioritize.",
    scoreAdjustment: -20,
    accentColor: "#DC2626",
    bgColor: "#FEF2F2",
  },
  call_booked: {
    label: "High Likelihood to Close",
    likelihood: 70,
    detail: "Call scheduled — this lead is actively converting.",
    scoreAdjustment: 25,
    accentColor: "#16A34A",
    bgColor: "#F0FDF4",
  },
  lost: {
    label: "Lost",
    likelihood: 0,
    detail: "Deal marked lost — no further action needed.",
    scoreAdjustment: -30,
    accentColor: "#64748B",
    bgColor: "#F8FAFC",
  },
};

export function getFunnelPrediction(funnelStatus: string | null | undefined): FunnelPrediction | null {
  if (!funnelStatus) return null;
  return FUNNEL_PREDICTIONS[funnelStatus] ?? null;
}

export function getEffectiveScore(baseScore: number, funnelStatus: string | null | undefined): number {
  const pred = getFunnelPrediction(funnelStatus);
  if (!pred) return baseScore;
  return Math.max(0, Math.min(100, baseScore + pred.scoreAdjustment));
}

export function getEffectiveTier(effectiveScore: number): "hot" | "warm" | "cold" {
  if (effectiveScore >= 75) return "hot";
  if (effectiveScore >= 50) return "warm";
  return "cold";
}
