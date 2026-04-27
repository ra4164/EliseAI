import { logger } from "../logger";
import type { WalkScoreData } from "@workspace/api-zod";

const WALKSCORE_API_KEY = process.env["WALKSCORE_API_KEY"];

const EMPTY: WalkScoreData = {
  walk: null,
  walkDescription: null,
  transit: null,
  transitDescription: null,
  bike: null,
  bikeDescription: null,
};

/** Fetches Walk, Transit, and Bike scores for the given address and coordinates. */
export async function fetchWalkScore(
  address: string,
  lat: number,
  lon: number,
): Promise<WalkScoreData> {
  if (!WALKSCORE_API_KEY) return EMPTY;
  const url = new URL("https://api.walkscore.com/score");
  url.searchParams.set("format", "json");
  url.searchParams.set("address", address);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("transit", "1");
  url.searchParams.set("bike", "1");
  url.searchParams.set("wsapikey", WALKSCORE_API_KEY);

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      logger.warn({ status: res.status }, "WalkScore returned non-200");
      return EMPTY;
    }
    const json = (await res.json()) as {
      walkscore?: number;
      description?: string;
      transit?: { score?: number; description?: string };
      bike?: { score?: number; description?: string };
    };
    return {
      walk: typeof json.walkscore === "number" ? json.walkscore : null,
      walkDescription: json.description ?? null,
      transit: typeof json.transit?.score === "number" ? json.transit.score : null,
      transitDescription: json.transit?.description ?? null,
      bike: typeof json.bike?.score === "number" ? json.bike.score : null,
      bikeDescription: json.bike?.description ?? null,
    };
  } catch (err) {
    logger.warn({ err }, "WalkScore error");
    return EMPTY;
  }
}
