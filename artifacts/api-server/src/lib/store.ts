import { randomUUID } from "node:crypto";
import type { Lead, LeadInput, LeadEnrichment } from "@workspace/api-zod";

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

export function addLead(input: LeadInput): Lead {
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
  };
  leads.set(lead.id, lead);
  return lead;
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
