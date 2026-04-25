import { randomUUID } from "node:crypto";
import type { Lead, LeadInput, LeadEnrichment, AdditionalContact } from "@workspace/api-zod";

const leads = new Map<string, Lead>();

export function listLeads(): Lead[] {
  return Array.from(leads.values()).sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getLead(id: string): Lead | undefined {
  return leads.get(id);
}

export function findLeadByEmail(email: string): Lead | undefined {
  const normalized = email.toLowerCase().trim();
  return Array.from(leads.values()).find(
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

export function findLeadsByAddress(propertyAddress: string): Lead[] {
  const norm = normalizeAddress(propertyAddress);
  return Array.from(leads.values()).filter(
    (l) => normalizeAddress(l.propertyAddress) === norm,
  );
}

export function addLead(
  input: LeadInput,
  batchId: string | null = null,
  batchLabel: string | null = null,
): Lead {
  const lead: Lead = {
    id: randomUUID(),
    name: input.name,
    email: input.email,
    company: input.company,
    propertyAddress: input.propertyAddress,
    city: input.city,
    state: input.state,
    country: input.country,
    status: "pending",
    createdAt: new Date().toISOString(),
    enrichment: null,
    errorMessage: null,
    batchId,
    batchLabel,
    notes: null,
    outreachSentAt: null,
    additionalContacts: [],
  };
  leads.set(lead.id, lead);
  return lead;
}

export function addContactToLead(
  id: string,
  contact: AdditionalContact,
): Lead | undefined {
  const existing = leads.get(id);
  if (!existing) return undefined;
  // Prevent exact duplicate contacts
  const alreadyExists = existing.additionalContacts.some(
    (c) => c.email.toLowerCase().trim() === contact.email.toLowerCase().trim(),
  );
  if (alreadyExists) return existing;
  const next: Lead = {
    ...existing,
    additionalContacts: [...existing.additionalContacts, contact],
  };
  leads.set(id, next);
  return next;
}

export function updateAdditionalContactSentAt(
  id: string,
  email: string,
  outreachSentAt: string | null,
): Lead | undefined {
  const existing = leads.get(id);
  if (!existing) return undefined;
  const norm = email.toLowerCase().trim();
  const next: Lead = {
    ...existing,
    additionalContacts: existing.additionalContacts.map((c) =>
      c.email.toLowerCase().trim() === norm ? { ...c, outreachSentAt } : c,
    ),
  };
  leads.set(id, next);
  return next;
}

export function updateLead(id: string, patch: Partial<Lead>): Lead | undefined {
  const existing = leads.get(id);
  if (!existing) return undefined;
  const next: Lead = { ...existing, ...patch } as Lead;
  leads.set(id, next);
  return next;
}

export function setEnrichment(
  id: string,
  enrichment: LeadEnrichment,
): Lead | undefined {
  return updateLead(id, {
    status: "enriched",
    enrichment,
    errorMessage: null,
  });
}

export function setEnriching(id: string): Lead | undefined {
  return updateLead(id, { status: "enriching", errorMessage: null });
}

export function setFailed(id: string, message: string): Lead | undefined {
  return updateLead(id, { status: "failed", errorMessage: message });
}

export function deleteLead(id: string): boolean {
  return leads.delete(id);
}

export function clearLeads(): void {
  leads.clear();
}

export function pendingLeads(): Lead[] {
  return Array.from(leads.values()).filter(
    (l) => l.status === "pending" || l.status === "failed",
  );
}
