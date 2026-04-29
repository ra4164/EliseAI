import { Router, type IRouter } from "express";
import { listLeads } from "../lib/store";
import { pushRowsToSheet, pullRowsFromSheet, PUSH_HEADERS } from "../lib/googleSheets";
import type { Lead } from "@workspace/api-zod";

const router: IRouter = Router();

/** Maps a Lead to an ordered string array matching PUSH_HEADERS for Sheets export. */
function leadToRow(l: Lead): string[] {
  const e = l.enrichment;
  return PUSH_HEADERS.map((h) => {
    switch (h) {
      case "id": return l.id;
      case "name": return l.name;
      case "email": return l.email;
      case "company": return l.company;
      case "propertyAddress": return l.propertyAddress;
      case "city": return l.city;
      case "state": return l.state;
      case "country": return l.country;
      case "status": return l.status;
      case "funnelStatus": return l.funnelStatus ?? "";
      case "createdAt": return l.createdAt;
      case "score": return String(e?.score ?? "");
      case "tier": return e?.tier ?? "";
      case "enrichedAt": return e?.enrichedAt ?? "";
      case "scoreReasons": return e?.scoreReasons.join(" | ") ?? "";
      case "salesInsights": return e?.salesInsights.join(" | ") ?? "";
      case "talkingPoints": return e?.talkingPoints.join(" | ") ?? "";
      case "outreachSubject": return e?.outreachEmail.subject ?? "";
      case "outreachBody": return e?.outreachEmail.body ?? "";
      case "walkScore": return String(e?.walkScore.walk ?? "");
      case "transitScore": return String(e?.walkScore.transit ?? "");
      case "bikeScore": return String(e?.walkScore.bike ?? "");
      case "medianHouseholdIncome": return String(e?.census.medianHouseholdIncome ?? "");
      case "medianGrossRent": return String(e?.census.medianGrossRent ?? "");
      case "medianHomeValue": return String(e?.census.medianHomeValue ?? "");
      case "totalPopulation": return String(e?.census.totalPopulation ?? "");
      case "renterOccupiedPct": return String(e?.census.renterOccupiedPct ?? "");
      case "bachelorsOrHigherPct": return String(e?.census.bachelorsOrHigherPct ?? "");
      case "placeName": return e?.census.placeName ?? "";
      case "newsTitles": return e?.news.map((n) => n.title).join(" | ") ?? "";
      case "newsUrls": return e?.news.map((n) => n.url).join(" | ") ?? "";
      default: return "";
    }
  });
}

/** Pushes all enriched leads to the connected Google Sheet, returning the row count written. */
router.post("/sheets/push", async (_req, res) => {
  try {
    const leads = await listLeads();
    const enriched = leads.filter((l) => l.status === "enriched" && l.enrichment);
    if (enriched.length === 0) {
      res.status(400).json({ error: "No enriched leads to push" });
      return;
    }
    const rows = enriched.map(leadToRow);
    const count = await pushRowsToSheet(rows);
    res.json({ pushed: count });
  } catch (err) {
    if (err instanceof Error && err.message === "SHEETS_NOT_CONNECTED") {
      res.status(503).json({ error: "SHEETS_NOT_CONNECTED" });
      return;
    }
    res.status(500).json({ error: String(err) });
  }
});

/** Reads leads from the connected Google Sheet and returns them as structured lead input rows. */
router.get("/sheets/pull", async (_req, res) => {
  try {
    const allRows = await pullRowsFromSheet();
    if (allRows.length < 2) {
      res.json({ leads: [] });
      return;
    }

    const headers = (allRows[0] ?? []).map((h) => h.trim().toLowerCase());
    const idx = (candidates: string[]) => {
      for (const c of candidates) {
        const i = headers.indexOf(c);
        if (i >= 0) return i;
      }
      return -1;
    };

    const map = {
      name: idx(["name", "full name", "fullname"]),
      email: idx(["email", "email address"]),
      company: idx(["company", "company name", "organization", "property group"]),
      propertyAddress: idx(["propertyaddress", "property address", "address", "street"]),
      city: idx(["city"]),
      state: idx(["state", "region"]),
      country: idx(["country"]),
    };

    const dataRows = allRows.slice(1);
    const leads: Array<{
      name: string; email: string; company: string;
      propertyAddress: string; city: string; state: string; country: string;
    }> = [];

    for (const cells of dataRows) {
      const get = (i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
      const lead = {
        name: get(map.name),
        email: get(map.email),
        company: get(map.company),
        propertyAddress: get(map.propertyAddress),
        city: get(map.city),
        state: get(map.state),
        country: get(map.country) || "USA",
      };
      if (lead.name && lead.email && lead.company && lead.propertyAddress && lead.city && lead.state) {
        leads.push(lead);
      }
    }

    res.json({ leads, total: leads.length });
  } catch (err) {
    if (err instanceof Error && err.message === "SHEETS_NOT_CONNECTED") {
      res.status(503).json({ error: "SHEETS_NOT_CONNECTED" });
      return;
    }
    res.status(500).json({ error: String(err) });
  }
});

export default router;
