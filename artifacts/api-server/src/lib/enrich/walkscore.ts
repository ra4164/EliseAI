import { logger } from "../logger";
import type { WalkScoreData } from "@workspace/api-zod";

const EMPTY: WalkScoreData = {
  walk: null,
  walkDescription: null,
  transit: null,
  transitDescription: null,
  bike: null,
  bikeDescription: null,
};

const FOOD_AMENITIES = new Set([
  "restaurant","cafe","bar","fast_food","pub","food_court","ice_cream","bakery","biergarten",
]);
const SHOP_AMENITIES = new Set([
  "supermarket","convenience","pharmacy","bakery","butcher","deli",
  "greengrocer","clothes","shoes","mall","department_store","hardware","electronics",
]);
const SERVICE_AMENITIES = new Set([
  "bank","atm","post_office","library","cinema","theatre","gym",
  "fitness_centre","school","hospital","clinic","dentist","doctors",
]);
const TRANSIT_AMENITIES = new Set(["bus_station"]);
const TRANSIT_HIGHWAY = new Set(["bus_stop"]);
const TRANSIT_RAILWAY = new Set(["subway_entrance","tram_stop","station","halt","stop"]);
const LEISURE_TAGS = new Set(["park","playground","garden","sports_centre","pitch","track"]);

function walkLabel(s: number): string {
  if (s >= 90) return "Walker's Paradise";
  if (s >= 70) return "Very Walkable";
  if (s >= 50) return "Somewhat Walkable";
  if (s >= 25) return "Car-Dependent";
  return "Almost All Errands Require a Car";
}

function transitLabel(s: number): string {
  if (s >= 90) return "Rider's Paradise";
  if (s >= 70) return "Excellent Transit";
  if (s >= 50) return "Good Transit";
  if (s >= 25) return "Some Transit";
  return "Minimal Transit";
}

function bikeLabel(s: number): string {
  if (s >= 90) return "Biker's Paradise";
  if (s >= 70) return "Very Bikeable";
  if (s >= 50) return "Bikeable";
  if (s >= 25) return "Some Bike Infrastructure";
  return "Minimal Bike Infrastructure";
}

/** Computes walkability, transit, and bike scores from OpenStreetMap amenity density via Overpass. */
export async function fetchWalkScore(
  _address: string,
  lat: number,
  lon: number,
): Promise<WalkScoreData> {
  const query = `[out:json][timeout:20];
(
  node["amenity"~"restaurant|cafe|bar|fast_food|pub|food_court|ice_cream|bakery|supermarket|convenience|pharmacy|bank|atm|post_office|library|cinema|theatre|school|hospital|clinic|dentist|doctors|bus_station"](around:800,${lat},${lon});
  node["shop"~"supermarket|convenience|bakery|butcher|deli|greengrocer|clothes|shoes|mall|department_store"](around:800,${lat},${lon});
  node["highway"="bus_stop"](around:800,${lat},${lon});
  node["railway"~"subway_entrance|tram_stop|station|halt"](around:800,${lat},${lon});
  node["leisure"~"park|playground|garden|sports_centre|pitch|track"](around:800,${lat},${lon});
);
out tags;`;

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "Overpass API returned non-200");
      return EMPTY;
    }

    const json = (await res.json()) as {
      elements: Array<{ tags?: Record<string, string> }>;
    };
    const elements = json.elements ?? [];

    let food = 0, shop = 0, service = 0, transit = 0, leisure = 0;

    for (const el of elements) {
      const t = el.tags ?? {};
      const amenity = t["amenity"] ?? "";
      const shopTag = t["shop"] ?? "";
      const highway = t["highway"] ?? "";
      const railway = t["railway"] ?? "";
      const leisureTag = t["leisure"] ?? "";

      if (FOOD_AMENITIES.has(amenity)) food++;
      else if (SHOP_AMENITIES.has(amenity) || SHOP_AMENITIES.has(shopTag)) shop++;
      else if (SERVICE_AMENITIES.has(amenity)) service++;

      if (TRANSIT_AMENITIES.has(amenity) || TRANSIT_HIGHWAY.has(highway) || TRANSIT_RAILWAY.has(railway)) transit++;
      if (LEISURE_TAGS.has(leisureTag)) leisure++;
    }

    const walkAmenities = food + shop + service;

    const walkScore =
      walkAmenities >= 60 ? 95 :
      walkAmenities >= 40 ? 87 :
      walkAmenities >= 25 ? 76 :
      walkAmenities >= 15 ? 63 :
      walkAmenities >= 8  ? 50 :
      walkAmenities >= 4  ? 35 :
      walkAmenities >= 1  ? 20 : 5;

    const transitScore =
      transit >= 20 ? 92 :
      transit >= 12 ? 78 :
      transit >= 7  ? 63 :
      transit >= 3  ? 45 :
      transit >= 1  ? 28 : 5;

    const bikeScore = Math.min(100, Math.round(walkScore * 0.55 + Math.min(45, leisure * 5)));

    return {
      walk: walkScore,
      walkDescription: walkLabel(walkScore),
      transit: transitScore,
      transitDescription: transitLabel(transitScore),
      bike: bikeScore,
      bikeDescription: bikeLabel(bikeScore),
    };
  } catch (err) {
    logger.warn({ err }, "Overpass API error");
    return EMPTY;
  }
}
