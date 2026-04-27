import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  addLead,
  addContactToLead,
  clearLeads,
  deleteLead as removeLead,
  getLead,
  listLeads,
  pendingLeads,
  setEnriching,
  setEnrichment,
  setFailed,
  updateAdditionalContactSentAt,
  updateLead,
} from "../lib/store";
import { enrichLead } from "../lib/enrich";
import { SAMPLE_LEADS } from "../lib/sample-leads";
import type { Lead, LeadStats } from "@workspace/api-zod";

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

/** Returns all leads sorted by creation date. */
router.get("/leads", async (_req, res) => {
  try {
    res.json({ leads: await listLeads() });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch leads" });
  }
});

/** Creates one or more leads with no deduplication — every submitted lead is added. */
router.post("/leads", async (req, res) => {
  try {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }
    const { leads: input } = parsed.data;

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

    const created = await Promise.all(
      input.map((lead) => addLead(lead, batchId, batchLabel)),
    );

    res.json({ leads: created, skipped: [], conflicts: [] });
  } catch (err) {
    res.status(500).json({ error: "Failed to create leads" });
  }
});

/** Deletes all leads from the database. */
router.delete("/leads", async (_req, res) => {
  try {
    await clearLeads();
    res.json({ success: true, message: "All leads deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete leads" });
  }
});

/** Clears existing leads and seeds the database with the sample dataset. */
router.post("/leads/seed", async (_req, res) => {
  try {
    await clearLeads();
    const batchId = randomUUID();
    const batchLabel = `Sample dataset (${SAMPLE_LEADS.length} leads)`;
    const created = await Promise.all(
      SAMPLE_LEADS.map((l) => addLead(l, batchId, batchLabel)),
    );
    res.json({ leads: created });
  } catch (err) {
    res.status(500).json({ error: "Failed to seed leads" });
  }
});

/** Enriches all pending and failed leads concurrently and returns results. */
router.post("/leads/enrich-all", async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: "Failed to run enrich-all" });
  }
});

/** Returns aggregate stats, score distribution, top leads, and stale contacts. */
router.get("/leads/stats", async (_req, res) => {
  try {
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

    const staleCutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const stale = all.filter(
      (l) =>
        l.funnelStatus === "contacted" &&
        l.funnelStatusUpdatedAt !== null &&
        new Date(l.funnelStatusUpdatedAt) <= staleCutoff,
    );

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
      funnelContactedCount: all.filter((l) => l.funnelStatus === "contacted")
        .length,
      funnelRepliedCount: all.filter((l) => l.funnelStatus === "replied").length,
      funnelCallBookedCount: all.filter((l) => l.funnelStatus === "call_booked")
        .length,
      staleLeads: stale,
    };
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch lead stats" });
  }
});

/** Returns a single lead by ID, or 404 if not found. */
router.get("/leads/:leadId", async (req, res) => {
  try {
    const lead = await getLead(req.params["leadId"]!);
    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch lead" });
  }
});

const FUNNEL_STATUSES = [
  "contacted",
  "replied",
  "ghosted",
  "call_booked",
  "lost",
] as const;

const UpdateBody = z.object({
  notes: z.string().optional(),
  outreachSentAt: z.string().nullable().optional(),
  funnelStatus: z.enum(FUNNEL_STATUSES).nullable().optional(),
  funnelStatusUpdatedAt: z.string().nullable().optional(),
});

/** Partially updates notes, outreach timestamp, or funnel status on a lead. */
router.patch("/leads/:leadId", async (req, res) => {
  try {
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
    if (parsed.data.funnelStatus !== undefined) {
      patch.funnelStatus = parsed.data.funnelStatus;
      patch.funnelStatusUpdatedAt =
        parsed.data.funnelStatusUpdatedAt !== undefined
          ? parsed.data.funnelStatusUpdatedAt
          : parsed.data.funnelStatus !== null
            ? new Date().toISOString()
            : null;
    }
    const updated = await updateLead(id, patch);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update lead" });
  }
});

/** Deletes a single lead by ID, returning 404 if not found. */
router.delete("/leads/:leadId", async (req, res) => {
  try {
    const ok = await removeLead(req.params["leadId"]!);
    if (!ok) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    res.json({ success: true, message: "Lead deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete lead" });
  }
});

// ---------- Additional contacts (duplicate merging) ----------

const AddContactBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  outreachSentAt: z.string().nullable().default(null),
});

/** Adds an additional contact to a lead, skipping duplicates by email. */
router.post("/leads/:leadId/contacts", async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: "Failed to add contact" });
  }
});

const UpdateContactBody = z.object({
  email: z.string().email(),
  outreachSentAt: z.string().nullable().optional(),
});

/** Updates the outreach timestamp on an additional contact by email. */
router.patch("/leads/:leadId/contacts", async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: "Failed to update contact" });
  }
});

// ---------- Enrichment ----------

/** Triggers enrichment for a single lead, updating status to enriched or failed. */
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
