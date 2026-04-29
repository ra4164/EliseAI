import { logger } from "./logger";

const SPREADSHEET_ID = "1LjMOSrSfjOWq1V5sMG7_KO8_HbsmHDRguSTSnlNpCVo";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

export const PUSH_HEADERS = [
  "id",
  "name",
  "email",
  "company",
  "propertyAddress",
  "city",
  "state",
  "country",
  "status",
  "funnelStatus",
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

async function getAccessToken(): Promise<string> {
  const connectorsHost = process.env["REPLIT_CONNECTORS_HOSTNAME"];
  const identity = process.env["REPL_IDENTITY"];

  if (!connectorsHost || !identity) {
    throw new Error("SHEETS_NOT_CONNECTED");
  }

  const url = `https://${connectorsHost}/v1/connectors/ccfg_google-sheet_E42A9F6CA62546F68A1FECA0E8/token`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${identity}` },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.warn({ status: res.status, text }, "Failed to get Google Sheets token");
    throw new Error("SHEETS_NOT_CONNECTED");
  }

  const data = (await res.json()) as { access_token?: string; token?: string };
  const token = data.access_token ?? data.token;
  if (!token) throw new Error("SHEETS_NOT_CONNECTED");
  return token;
}

async function sheetsRequest(
  path: string,
  method: string,
  body?: unknown,
): Promise<unknown> {
  const token = await getAccessToken();
  const res = await fetch(`${SHEETS_API}/${SPREADSHEET_ID}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${text}`);
  }
  return res.json();
}

/** Clears Sheet1 and writes a header row followed by the provided data rows, returning the row count. */
export async function pushRowsToSheet(rows: string[][]): Promise<number> {
  const range = "Sheet1!A1";
  await sheetsRequest(`/values/${encodeURIComponent(range)}:clear`, "POST");
  const values = [PUSH_HEADERS, ...rows];
  await sheetsRequest(
    `/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    "PUT",
    { range, majorDimension: "ROWS", values },
  );
  logger.info({ rowCount: rows.length }, "Pushed leads to Google Sheets");
  return rows.length;
}

/** Reads all rows from Sheet1 and returns them as a 2D string array (first row is headers). */
export async function pullRowsFromSheet(): Promise<string[][]> {
  const range = "Sheet1!A1:ZZ10000";
  const data = (await sheetsRequest(
    `/values/${encodeURIComponent(range)}`,
    "GET",
  )) as { values?: string[][] };
  return data.values ?? [];
}
