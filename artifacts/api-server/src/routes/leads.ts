import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  addLead,
  addContactToLead,
  clearLeads,
  deleteLead as removeLead,
  findLeadByEmail,
  findLeadsByAddress,
  getLead,
  listLeads,
  normalizeAddress,
  pendingLeads,
  setEnriching,
  setEnrichment,
  setFailed,
  updateAdditionalContactSentAt,
  updateLead,
} from "../lib/store";
import { enrichLead } from "../lib/enrich";
import { SAMPLE_LEADS } from "../lib/sample-leads";
import type { Lead, LeadStats, DuplicateConflict } from "@workspace/api-zod";

const LeadInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  company: z.string().min(1),
  propertyAddress: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  country: z.string().min(1),
});

const CreateBody = z.object({
  leads: z.array(LeadInputSchema).min(1),
  batchId: z.string().optional(),
  batchLabel: z.string().optional(),
});

const router: IRouter = Router();

router.get("/leads", async (_req, res) => {
  res.json({ leads: await listLeads() });
});

router.post("/leads", async (req, res) => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }
  const { leads: input } = parsed.data;

  const created: Lead[] = [];
  const skipped: Array<{ name: string; email: string }> = [];
  const conflicts: DuplicateConflict[] = [];

  const isBatch = input.length > 1;
  const batchId = parsed.data.batchId ?? (isBatch ? randomUUID() : null);
  const batchLabel =
    parsed.data.batchLabel ??
    (isBatch
      ? `Batch ${new Date().toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })} (${input.length} leads)`
      : null);

  for (const lead of input) {
    const byEmail = await findLeadByEmail(lead.email);
    if (byEmail) {
      skipped.push({ name: lead.name, email: lead.email });
      continue;
    }

    const byAddress = await findLeadsByAddress(lead.propertyAddress);
    if (byAddress.length > 0) {
      const primary = byAddress[0]!;
      conflicts.push({
        incomingName: lead.name,
        incomingEmail: lead.email,
        existingLeadId: primary.id,
        existingLeadName: primary.name,
        existingLeadEmail: primary.email,
        propertyAddress: lead.propertyAddress,
      });
      continue;
    }

    created.push(await addLead(lead, batchId, batchLabel));
  }

  res.json({ leads: created, skipped, conflicts });
});

router.delete("/leads", async (_req, res) => {
  await clearLeads();
  res.json({ success: true, message: "All leads deleted" });
});

router.post("/leads/seed", async (_req, res) => {
  await clearLeads();
  const batchId = randomUUID();
  const batchLabel = `Sample dataset (${SAMPLE_LEADS.length} leads)`;
  const created = await Promise.all(
    SAMPLE_LEADS.map((l) => addLead(l, batchId, batchLabel)),
  );
  res.json({ leads: created });
});

router.post("/leads/enrich-all", async (req, res) => {
  const pending = await pendingLeads();
  const results: Lead[] = [];
  let succeeded = 0;
  let failed = 0;
  for (const lead of pending) {
    await setEnriching(lead.id);
    try {
      const enrichment = await enrichLead(lead);
      const next = await setEnrichment(lead.id, enrichment);
      if (next) results.push(next);
      succeeded++;
    } catch (err) {
      req.log?.warn({ err, leadId: lead.id }, "Failed to enrich lead");
      const next = await setFailed(
        lead.id,
        err instanceof Error ? err.message : "Unknown error",
      );
      if (next) results.push(next);
      failed++;
    }
  }
  res.json({
    processed: pending.length,
    succeeded,
    failed,
    leads: results,
  });
});

router.get("/leads/stats", async (_req, res) => {
  const all = await listLeads();
  const enriched = all.filter((l) => l.status === "enriched" && l.enrichment);
  const pending = all.filter(
    (l) => l.status === "pending" || l.status === "failed",
  );
  const scores = enriched.map((l) => l.enrichment!.score);
  const avg =
    scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) /
        10
      : 0;
  const hot = enriched.filter((l) => l.enrichment!.tier === "hot");
  const warm = enriched.filter((l) => l.enrichment!.tier === "warm");
  const cold = enriched.filter((l) => l.enrichment!.tier === "cold");
  const buckets: Array<{ bucket: string; lo: number; hi: number }> = [
    { bucket: "0-19", lo: 0, hi: 19 },
    { bucket: "20-39", lo: 20, hi: 39 },
    { bucket: "40-59", lo: 40, hi: 59 },
    { bucket: "60-79", lo: 60, hi: 79 },
    { bucket: "80-100", lo: 80, hi: 100 },
  ];
  const distribution = buckets.map(({ bucket, lo, hi }) => ({
    bucket,
    count: scores.filter((s) => s >= lo && s <= hi).length,
  }));
  const top = [...enriched]
    .sort((a, b) => (b.enrichment!.score ?? 0) - (a.enrichment!.score ?? 0))
    .slice(0, 5);
  const recent = [...enriched]
    .sort(
      (a, b) =>
        new Date(b.enrichment!.enrichedAt).getTime() -
        new Date(a.enrichment!.enrichedAt).getTime(),
    )
    .slice(0, 5);
  const stats: LeadStats = {
    total: all.length,
    enrichedCount: enriched.length,
    pendingCount: pending.length,
    averageScore: avg,
    hotCount: hot.length,
    warmCount: warm.length,
    coldCount: cold.length,
    topLeads: top,
    recentlyEnriched: recent,
    scoreDistribution: distribution,
  };
  res.json(stats);
});

router.get("/leads/:leadId", async (req, res) => {
  const lead = await getLead(req.params["leadId"]!);
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  res.json(lead);
});

const UpdateBody = z.object({
  notes: z.string().optional(),
  outreachSentAt: z.string().nullable().optional(),
});

router.patch("/leads/:leadId", async (req, res) => {
  const id = req.params["leadId"]!;
  const existing = await getLead(id);
  if (!existing) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const parsed = UpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const patch: Partial<typeof existing> = {};
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
  if (parsed.data.outreachSentAt !== undefined)
    patch.outreachSentAt = parsed.data.outreachSentAt;
  const updated = await updateLead(id, patch);
  res.json(updated);
});

router.delete("/leads/:leadId", async (req, res) => {
  const ok = await removeLead(req.params["leadId"]!);
  if (!ok) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  res.json({ success: true, message: "Lead deleted" });
});

// ---------- Additional contacts (duplicate merging) ----------

const AddContactBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  outreachSentAt: z.string().nullable().default(null),
});

router.post("/leads/:leadId/contacts", async (req, res) => {
  const id = req.params["leadId"]!;
  const lead = await getLead(id);
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const parsed = AddContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updated = await addContactToLead(id, parsed.data);
  res.json(updated);
});

const UpdateContactBody = z.object({
  email: z.string().email(),
  outreachSentAt: z.string().nullable().optional(),
});

router.patch("/leads/:leadId/contacts", async (req, res) => {
  const id = req.params["leadId"]!;
  const lead = await getLead(id);
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const parsed = UpdateContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.outreachSentAt !== undefined) {
    const updated = await updateAdditionalContactSentAt(
      id,
      parsed.data.email,
      parsed.data.outreachSentAt,
    );
    res.json(updated);
  } else {
    res.json(lead);
  }
});

// ---------- Enrichment ----------

router.post("/leads/:leadId/enrich", async (req, res) => {
  const id = req.params["leadId"]!;
  const lead = await getLead(id);
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  await setEnriching(id);
  try {
    const enrichment = await enrichLead(lead);
    const next = await setEnrichment(id, enrichment);
    res.json(next);
  } catch (err) {
    req.log?.warn({ err, leadId: id }, "Failed to enrich lead");
    const next = await setFailed(
      id,
      err instanceof Error ? err.message : "Unknown error",
    );
    res.status(500).json(next);
  }
});

export default router;
