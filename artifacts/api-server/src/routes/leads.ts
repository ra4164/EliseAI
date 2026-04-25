import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  addLead,
  clearLeads,
  deleteLead as removeLead,
  getLead,
  listLeads,
  pendingLeads,
  setEnriching,
  setEnrichment,
  setFailed,
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

router.get("/leads", (_req, res) => {
  res.json({ leads: listLeads() });
});

router.post("/leads", (req, res) => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }
  const { leads: input } = parsed.data;
  // If multiple leads, automatically tag them with a shared batch id so
  // they can be visually grouped and exported together later.
  const isBatch = input.length > 1;
  const batchId = parsed.data.batchId ?? (isBatch ? randomUUID() : null);
  const batchLabel = parsed.data.batchLabel ?? (isBatch
    ? `Batch ${new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} (${input.length} leads)`
    : null);
  const created = input.map((l) => addLead(l, batchId, batchLabel));
  res.json({ leads: created });
});

router.delete("/leads", (_req, res) => {
  clearLeads();
  res.json({ success: true, message: "All leads deleted" });
});

router.post("/leads/seed", (_req, res) => {
  clearLeads();
  const batchId = randomUUID();
  const batchLabel = `Sample dataset (${SAMPLE_LEADS.length} leads)`;
  const created = SAMPLE_LEADS.map((l) => addLead(l, batchId, batchLabel));
  res.json({ leads: created });
});

router.post("/leads/enrich-all", async (req, res) => {
  const pending = pendingLeads();
  const results: Lead[] = [];
  let succeeded = 0;
  let failed = 0;
  for (const lead of pending) {
    setEnriching(lead.id);
    try {
      const enrichment = await enrichLead(lead);
      const next = setEnrichment(lead.id, enrichment);
      if (next) results.push(next);
      succeeded++;
    } catch (err) {
      req.log?.warn({ err, leadId: lead.id }, "Failed to enrich lead");
      const next = setFailed(
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

router.get("/leads/stats", (_req, res) => {
  const all = listLeads();
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

router.get("/leads/:leadId", (req, res) => {
  const lead = getLead(req.params["leadId"]!);
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

router.patch("/leads/:leadId", (req, res) => {
  const id = req.params["leadId"]!;
  const existing = getLead(id);
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
  const updated = updateLead(id, patch);
  res.json(updated);
});

router.delete("/leads/:leadId", (req, res) => {
  const ok = removeLead(req.params["leadId"]!);
  if (!ok) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  res.json({ success: true, message: "Lead deleted" });
});

router.post("/leads/:leadId/enrich", async (req, res) => {
  const id = req.params["leadId"]!;
  const lead = getLead(id);
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  setEnriching(id);
  try {
    const enrichment = await enrichLead(lead);
    const next = setEnrichment(id, enrichment);
    res.json(next);
  } catch (err) {
    req.log?.warn({ err, leadId: id }, "Failed to enrich lead");
    const next = setFailed(
      id,
      err instanceof Error ? err.message : "Unknown error",
    );
    res.status(500).json(next);
  }
});

export default router;
