import type { Lead } from "@workspace/api-client-react";

const CSV_HEADERS = [
  "name",
  "email",
  "company",
  "propertyAddress",
  "city",
  "state",
  "country",
];

const ENRICHED_HEADERS = [
  "id",
  "batchId",
  "batchLabel",
  "name",
  "email",
  "company",
  "propertyAddress",
  "city",
  "state",
  "country",
  "status",
  "createdAt",
  "score",
  "tier",
  "enrichedAt",
  "scoreReasons",
  "salesInsights",
  "talkingPoints",
  "outreachSubject",
  "outreachBody",
  "walkScore",
  "transitScore",
  "bikeScore",
  "medianHouseholdIncome",
  "medianGrossRent",
  "medianHomeValue",
  "totalPopulation",
  "renterOccupiedPct",
  "bachelorsOrHigherPct",
  "placeName",
  "newsTitles",
  "newsUrls",
];

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const headerLine = headers.map(escapeCsv).join(",");
  const lines = rows.map((r) =>
    headers.map((h) => escapeCsv(r[h])).join(","),
  );
  return [headerLine, ...lines].join("\n");
}

function triggerDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCsvTemplate() {
  const sample = [
    {
      name: "Jane Doe",
      email: "jane.doe@example.com",
      company: "Greystar Real Estate Partners",
      propertyAddress: "123 Main St",
      city: "Austin",
      state: "TX",
      country: "USA",
    },
  ];
  triggerDownload("rma-leads-template.csv", rowsToCsv(CSV_HEADERS, sample));
}

export function downloadEnrichedCsv(leads: Lead[]) {
  const rows = leads.map((l) => {
    const e = l.enrichment;
    return {
      id: l.id,
      batchId: l.batchId ?? "",
      batchLabel: l.batchLabel ?? "",
      name: l.name,
      email: l.email,
      company: l.company,
      propertyAddress: l.propertyAddress,
      city: l.city,
      state: l.state,
      country: l.country,
      status: l.status,
      createdAt: l.createdAt,
      score: e?.score ?? "",
      tier: e?.tier ?? "",
      enrichedAt: e?.enrichedAt ?? "",
      scoreReasons: e?.scoreReasons.join(" | ") ?? "",
      salesInsights: e?.salesInsights.join(" | ") ?? "",
      talkingPoints: e?.talkingPoints.join(" | ") ?? "",
      outreachSubject: e?.outreachEmail.subject ?? "",
      outreachBody: e?.outreachEmail.body ?? "",
      walkScore: e?.walkScore.walk ?? "",
      transitScore: e?.walkScore.transit ?? "",
      bikeScore: e?.walkScore.bike ?? "",
      medianHouseholdIncome: e?.census.medianHouseholdIncome ?? "",
      medianGrossRent: e?.census.medianGrossRent ?? "",
      medianHomeValue: e?.census.medianHomeValue ?? "",
      totalPopulation: e?.census.totalPopulation ?? "",
      renterOccupiedPct: e?.census.renterOccupiedPct ?? "",
      bachelorsOrHigherPct: e?.census.bachelorsOrHigherPct ?? "",
      placeName: e?.census.placeName ?? "",
      newsTitles: e?.news.map((n) => n.title).join(" | ") ?? "",
      newsUrls: e?.news.map((n) => n.url).join(" | ") ?? "",
    };
  });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  triggerDownload(`rma-enriched-leads-${ts}.csv`, rowsToCsv(ENRICHED_HEADERS, rows));
}

interface ParsedRow {
  name: string;
  email: string;
  company: string;
  propertyAddress: string;
  city: string;
  state: string;
  country: string;
}

// Minimal RFC4180-style CSV parser supporting quoted fields with embedded commas/quotes.
function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += ch;
      }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

export function parseLeadsCsv(text: string): {
  leads: ParsedRow[];
  errors: string[];
} {
  const errors: string[] = [];
  const rows = parseCsvText(text);
  if (rows.length === 0) {
    return { leads: [], errors: ["File is empty"] };
  }
  // Detect header row by checking if first row contains "email" or "name".
  const first = rows[0]!.map((c) => c.trim().toLowerCase());
  const hasHeader = first.includes("email") || first.includes("name");
  let headers: string[];
  let dataRows: string[][];
  if (hasHeader) {
    headers = first;
    dataRows = rows.slice(1);
  } else {
    headers = CSV_HEADERS;
    dataRows = rows;
  }

  const idx = (key: string) => {
    const variants: Record<string, string[]> = {
      name: ["name", "full name", "fullname", "contact"],
      email: ["email", "email address"],
      company: ["company", "company name", "organization", "property group"],
      propertyAddress: ["propertyaddress", "property address", "address", "street"],
      city: ["city"],
      state: ["state", "region"],
      country: ["country"],
    };
    const candidates = variants[key] || [key];
    for (const c of candidates) {
      const i = headers.indexOf(c);
      if (i >= 0) return i;
    }
    return -1;
  };

  const map = {
    name: idx("name"),
    email: idx("email"),
    company: idx("company"),
    propertyAddress: idx("propertyAddress"),
    city: idx("city"),
    state: idx("state"),
    country: idx("country"),
  };

  const required: Array<keyof typeof map> = [
    "name",
    "email",
    "company",
    "propertyAddress",
    "city",
    "state",
  ];
  const missing = required.filter((k) => map[k] < 0);
  if (missing.length > 0) {
    errors.push(`Missing required columns: ${missing.join(", ")}`);
    return { leads: [], errors };
  }

  const leads: ParsedRow[] = [];
  dataRows.forEach((cells, rowIdx) => {
    const get = (i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
    const lead: ParsedRow = {
      name: get(map.name),
      email: get(map.email),
      company: get(map.company),
      propertyAddress: get(map.propertyAddress),
      city: get(map.city),
      state: get(map.state),
      country: get(map.country) || "USA",
    };
    const missingFields = required.filter((k) => !lead[k]);
    if (missingFields.length > 0) {
      errors.push(
        `Row ${rowIdx + (hasHeader ? 2 : 1)}: missing ${missingFields.join(", ")}`,
      );
      return;
    }
    leads.push(lead);
  });

  return { leads, errors };
}
