import { randomUUID } from "node:crypto";
import { eq, or, sql } from "drizzle-orm";
import { db, leadsTable } from "@workspace/db";
import type { Lead, LeadInput, LeadEnrichment, AdditionalContact } from "@workspace/api-zod";

/** Maps a raw database row to a typed Lead object. */
function rowToLead(row: typeof leadsTable.$inferSelect): Lead {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
    propertyAddress: row.propertyAddress,
    city: row.city,
    state: row.state,
    country: row.country,
    status: row.status as Lead["status"],
    createdAt: row.createdAt,
    enrichment: (row.enrichment as Lead["enrichment"]) ?? null,
    errorMessage: row.errorMessage ?? null,
    batchId: row.batchId ?? null,
    batchLabel: row.batchLabel ?? null,
    notes: row.notes ?? null,
    outreachSentAt: row.outreachSentAt ?? null,
    additionalContacts: (row.additionalContacts as AdditionalContact[]) ?? [],
    funnelStatus: (row.funnelStatus as Lead["funnelStatus"]) ?? null,
    funnelStatusUpdatedAt: row.funnelStatusUpdatedAt ?? null,
  };
}

/** Returns all leads ordered by creation date descending. */
export async function listLeads(): Promise<Lead[]> {
  const rows = await db
    .select()
    .from(leadsTable)
    .orderBy(sql`${leadsTable.createdAt} DESC`);
  return rows.map(rowToLead);
}

/** Fetches a single lead by its UUID, or returns undefined if not found. */
export async function getLead(id: string): Promise<Lead | undefined> {
  const rows = await db
    .select()
    .from(leadsTable)
    .where(eq(leadsTable.id, id))
    .limit(1);
  return rows[0] ? rowToLead(rows[0]) : undefined;
}

/** Finds a lead whose primary or additional-contact email matches (case-insensitive). */
export async function findLeadByEmail(email: string): Promise<Lead | undefined> {
  const normalized = email.toLowerCase().trim();
  const rows = await db.select().from(leadsTable);
  return rows.map(rowToLead).find(
    (l) =>
      l.email.toLowerCase().trim() === normalized ||
      l.additionalContacts.some(
        (c) => c.email.toLowerCase().trim() === normalized,
      ),
  );
}

/** Lowercases and collapses whitespace in an address string for comparison. */
export function normalizeAddress(addr: string): string {
  return addr.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Returns all leads whose property address matches after normalization. */
export async function findLeadsByAddress(propertyAddress: string): Promise<Lead[]> {
  const norm = normalizeAddress(propertyAddress);
  const rows = await db.select().from(leadsTable);
  return rows.map(rowToLead).filter(
    (l) => normalizeAddress(l.propertyAddress) === norm,
  );
}

/** Inserts a new lead with pending status and optional batch grouping. */
export async function addLead(
  input: LeadInput,
  batchId: string | null = null,
  batchLabel: string | null = null,
): Promise<Lead> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const values = {
    id,
    name: input.name,
    email: input.email,
    company: input.company,
    propertyAddress: input.propertyAddress,
    city: input.city,
    state: input.state,
    country: input.country,
    status: "pending" as const,
    createdAt: now,
    enrichment: null,
    errorMessage: null,
    batchId,
    batchLabel,
    notes: null,
    outreachSentAt: null,
    additionalContacts: [],
    funnelStatus: null,
    funnelStatusUpdatedAt: null,
  };
  await db.insert(leadsTable).values(values);
  return rowToLead(values as typeof leadsTable.$inferSelect);
}

/** Appends an additional contact to a lead, skipping duplicates by email. */
export async function addContactToLead(
  id: string,
  contact: AdditionalContact,
): Promise<Lead | undefined> {
  const existing = await getLead(id);
  if (!existing) return undefined;
  const alreadyExists = existing.additionalContacts.some(
    (c) => c.email.toLowerCase().trim() === contact.email.toLowerCase().trim(),
  );
  if (alreadyExists) return existing;
  const updated = [...existing.additionalContacts, contact];
  const rows = await db
    .update(leadsTable)
    .set({ additionalContacts: updated })
    .where(eq(leadsTable.id, id))
    .returning();
  return rows[0] ? rowToLead(rows[0]) : undefined;
}

/** Sets the outreachSentAt timestamp on a specific additional contact by email. */
export async function updateAdditionalContactSentAt(
  id: string,
  email: string,
  outreachSentAt: string | null,
): Promise<Lead | undefined> {
  const existing = await getLead(id);
  if (!existing) return undefined;
  const norm = email.toLowerCase().trim();
  const updated = existing.additionalContacts.map((c) =>
    c.email.toLowerCase().trim() === norm ? { ...c, outreachSentAt } : c,
  );
  const rows = await db
    .update(leadsTable)
    .set({ additionalContacts: updated })
    .where(eq(leadsTable.id, id))
    .returning();
  return rows[0] ? rowToLead(rows[0]) : undefined;
}

/** Applies a partial update to a lead, mapping only known fields to DB columns. */
export async function updateLead(id: string, patch: Partial<Lead>): Promise<Lead | undefined> {
  const dbPatch: Partial<typeof leadsTable.$inferInsert> = {};
  if (patch.status !== undefined)
    dbPatch.status = patch.status as typeof leadsTable.$inferInsert["status"];
  if (patch.enrichment !== undefined)
    dbPatch.enrichment = (patch.enrichment as object | null | undefined) ?? null;
  if (patch.errorMessage !== undefined) dbPatch.errorMessage = patch.errorMessage;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  if (patch.outreachSentAt !== undefined) dbPatch.outreachSentAt = patch.outreachSentAt;
  if (patch.batchId !== undefined) dbPatch.batchId = patch.batchId;
  if (patch.batchLabel !== undefined) dbPatch.batchLabel = patch.batchLabel;
  if (patch.additionalContacts !== undefined)
    dbPatch.additionalContacts = patch.additionalContacts;
  if (patch.funnelStatus !== undefined)
    dbPatch.funnelStatus = patch.funnelStatus as typeof leadsTable.$inferInsert["funnelStatus"];
  if (patch.funnelStatusUpdatedAt !== undefined)
    dbPatch.funnelStatusUpdatedAt = patch.funnelStatusUpdatedAt;

  if (Object.keys(dbPatch).length === 0) return getLead(id);

  const rows = await db
    .update(leadsTable)
    .set(dbPatch)
    .where(eq(leadsTable.id, id))
    .returning();
  return rows[0] ? rowToLead(rows[0]) : undefined;
}

/** Saves enrichment data and marks the lead status as enriched. */
export async function setEnrichment(
  id: string,
  enrichment: LeadEnrichment,
): Promise<Lead | undefined> {
  return updateLead(id, {
    status: "enriched",
    enrichment,
    errorMessage: null,
  });
}

/** Marks a lead as currently being enriched and clears any prior error. */
export async function setEnriching(id: string): Promise<Lead | undefined> {
  return updateLead(id, { status: "enriching", errorMessage: null });
}

/** Marks a lead as failed and stores the error message. */
export async function setFailed(id: string, message: string): Promise<Lead | undefined> {
  return updateLead(id, { status: "failed", errorMessage: message });
}

/** Deletes a lead by ID and returns true if a row was removed. */
export async function deleteLead(id: string): Promise<boolean> {
  const result = await db
    .delete(leadsTable)
    .where(eq(leadsTable.id, id))
    .returning({ id: leadsTable.id });
  return result.length > 0;
}

/** Truncates the entire leads table. */
export async function clearLeads(): Promise<void> {
  await db.delete(leadsTable);
}

/** Returns all leads with status pending or failed (eligible for enrichment). */
export async function pendingLeads(): Promise<Lead[]> {
  const rows = await db
    .select()
    .from(leadsTable)
    .where(
      or(
        eq(leadsTable.status, "pending"),
        eq(leadsTable.status, "failed"),
      ),
    );
  return rows.map(rowToLead);
}
