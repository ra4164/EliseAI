import { logger } from "../logger";
import type { CensusData } from "@workspace/api-zod";
import type { GeocodeResult } from "./geocode";

// ACS 5-Year (2022) variables
// B19013_001E: Median household income
// B25064_001E: Median gross rent
// B25077_001E: Median home value
// B01003_001E: Total population
// B25003_003E: Renter occupied housing units
// B25003_001E: Total occupied housing units
// B15003_022E: Bachelor's degree (25+)
// B15003_023E: Master's degree
// B15003_024E: Professional degree
// B15003_025E: Doctorate degree
// B15003_001E: Total population 25 years and over
const VARIABLES = [
  "NAME",
  "B19013_001E",
  "B25064_001E",
  "B25077_001E",
  "B01003_001E",
  "B25003_001E",
  "B25003_003E",
  "B15003_022E",
  "B15003_023E",
  "B15003_024E",
  "B15003_025E",
  "B15003_001E",
];

/** Converts a Census API string value to a number, treating sentinel values as null. */
function toNumOrNull(value: string): number | null {
  if (value === undefined || value === null) return null;
  if (value === "" || value === "-666666666" || value === "null") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Fetches ACS 5-Year demographics for the geocoded location (place or county level). */
export async function fetchCensusData(
  geo: GeocodeResult,
): Promise<CensusData> {
  // Prefer place-level data when available, otherwise fall back to county.
  // The Census ACS public endpoint works without an API key (500 req/day limit).
  const url = new URL("https://api.census.gov/data/2022/acs/acs5");
  url.searchParams.set("get", VARIABLES.join(","));
  if (geo.placeGeoid) {
    url.searchParams.set("for", `place:${geo.placeGeoid.slice(2)}`);
    url.searchParams.set("in", `state:${geo.state}`);
  } else {
    url.searchParams.set("for", `county:${geo.county}`);
    url.searchParams.set("in", `state:${geo.state}`);
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      logger.warn({ status: res.status }, "Census ACS returned non-200");
      return emptyCensus(geo.placeName ?? null);
    }
    const data = (await res.json()) as string[][];
    const [headers, row] = data;
    if (!headers || !row) return emptyCensus(geo.placeName ?? null);
    const map = Object.fromEntries(
      headers.map((h, i) => [h, row[i] ?? ""]),
    );
    const renterOccupied = toNumOrNull(map["B25003_003E"] ?? "");
    const totalOccupied = toNumOrNull(map["B25003_001E"] ?? "");
    const bachelorsPlus =
      (toNumOrNull(map["B15003_022E"] ?? "") ?? 0) +
      (toNumOrNull(map["B15003_023E"] ?? "") ?? 0) +
      (toNumOrNull(map["B15003_024E"] ?? "") ?? 0) +
      (toNumOrNull(map["B15003_025E"] ?? "") ?? 0);
    const totalAdults = toNumOrNull(map["B15003_001E"] ?? "");
    return {
      medianHouseholdIncome: toNumOrNull(map["B19013_001E"] ?? ""),
      medianGrossRent: toNumOrNull(map["B25064_001E"] ?? ""),
      medianHomeValue: toNumOrNull(map["B25077_001E"] ?? ""),
      totalPopulation: toNumOrNull(map["B01003_001E"] ?? ""),
      renterOccupiedPct:
        renterOccupied !== null && totalOccupied && totalOccupied > 0
          ? Math.round((renterOccupied / totalOccupied) * 1000) / 10
          : null,
      bachelorsOrHigherPct:
        totalAdults && totalAdults > 0
          ? Math.round((bachelorsPlus / totalAdults) * 1000) / 10
          : null,
      placeName: (map["NAME"] || geo.placeName) ?? null,
    };
  } catch (err) {
    logger.warn({ err }, "Census ACS error");
    return emptyCensus(geo.placeName ?? null);
  }
}

/** Returns a CensusData object with all numeric fields null and the given place name. */
function emptyCensus(placeName: string | null): CensusData {
  return {
    medianHouseholdIncome: null,
    medianGrossRent: null,
    medianHomeValue: null,
    totalPopulation: null,
    renterOccupiedPct: null,
    bachelorsOrHigherPct: null,
    placeName,
  };
}
