import { logger } from "../logger";

export interface GeocodeResult {
  lat: number;
  lon: number;
  matchedAddress: string;
  state: string;
  county: string;
  tract: string;
  block: string;
  // Census place GEOID, if available (used for ACS lookups at city/place level)
  placeGeoid?: string;
  placeName?: string;
}

const CENSUS_GEOCODER =
  "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";

export async function geocodeAddress(
  address: string,
): Promise<GeocodeResult | null> {
  const url = new URL(CENSUS_GEOCODER);
  url.searchParams.set("address", address);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("vintage", "Current_Current");
  url.searchParams.set("format", "json");
  url.searchParams.set("layers", "Census Tracts,Incorporated Places");

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      logger.warn({ status: res.status }, "Census geocoder returned non-200");
      return null;
    }
    const json = (await res.json()) as {
      result?: {
        addressMatches?: Array<{
          coordinates: { x: number; y: number };
          matchedAddress: string;
          geographies?: Record<
            string,
            Array<Record<string, string | number>>
          >;
        }>;
      };
    };
    const match = json.result?.addressMatches?.[0];
    if (!match) return null;
    const geo = match.geographies ?? {};
    const tractEntry = geo["Census Tracts"]?.[0];
    const placeEntry = geo["Incorporated Places"]?.[0];
    if (!tractEntry) return null;
    return {
      lat: match.coordinates.y,
      lon: match.coordinates.x,
      matchedAddress: match.matchedAddress,
      state: String(tractEntry["STATE"]),
      county: String(tractEntry["COUNTY"]),
      tract: String(tractEntry["TRACT"]),
      block: String(tractEntry["BLOCK"] ?? ""),
      placeGeoid: placeEntry
        ? `${placeEntry["STATE"]}${placeEntry["PLACE"]}`
        : undefined,
      placeName: placeEntry ? String(placeEntry["NAME"]) : undefined,
    };
  } catch (err) {
    logger.warn({ err }, "Census geocoder error");
    return null;
  }
}
