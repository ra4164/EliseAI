import { randomUUID } from "node:crypto";
import { eq, or, sql } from "drizzle-orm";
import { db, leadsTable } from "@workspace/db";
import type { Lead, LeadInput, LeadEnrichment, AdditionalContact } from "@workspace/api-zod";

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
  };
}

export async function listLeads(): Promise<Lead[]> {
  const rows = await db
    .select()
    .from(leadsTable)
    .orderBy(sql`${leadsTable.createdAt} DESC`);
  return rows.map(rowToLead);
}

export async function getLead(id: string): Promise<Lead | undefined> {
  const rows = await db
    .select()
    .from(leadsTable)
    .where(eq(leadsTable.id, id))
    .limit(1);
  return rows[0] ? rowToLead(rows[0]) : undefined;
}

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

export function normalizeAddress(addr: string): string {
  return addr.toLowerCase().trim().replace(/\s+/g, " ");
}

export async function findLeadsByAddress(propertyAddress: string): Promise<Lead[]> {
  const norm = normalizeAddress(propertyAddress);
  const rows = await db.select().from(leadsTable);
  return rows.map(rowToLead).filter(
    (l) => normalizeAddress(l.propertyAddress) === norm,
  );
}

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
  };
  await db.insert(leadsTable).values(values);
  return rowToLead(values as typeof leadsTable.$inferSelect);
}

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

  if (Object.keys(dbPatch).length === 0) return getLead(id);

  const rows = await db
    .update(leadsTable)
    .set(dbPatch)
    .where(eq(leadsTable.id, id))
    .returning();
  return rows[0] ? rowToLead(rows[0]) : undefined;
}

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

export async function setEnriching(id: string): Promise<Lead | undefined> {
  return updateLead(id, { status: "enriching", errorMessage: null });
}

export async function setFailed(id: string, message: string): Promise<Lead | undefined> {
  return updateLead(id, { status: "failed", errorMessage: message });
}

export async function deleteLead(id: string): Promise<boolean> {
  const result = await db
    .delete(leadsTable)
    .where(eq(leadsTable.id, id))
    .returning({ id: leadsTable.id });
  return result.length > 0;
}

export async function clearLeads(): Promise<void> {
  await db.delete(leadsTable);
}

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
