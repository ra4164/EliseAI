import { Router } from "express";
import { getScheduleStatus, runEnrichAll } from "../lib/scheduler";

const router: Router = Router();

/** Returns the current scheduler status including next run time and last run stats. */
router.get("/schedule", (_req, res) => {
  res.json(getScheduleStatus());
});

/** Immediately triggers an enrichment run and returns the results with updated schedule status. */
router.post("/schedule/trigger", async (_req, res) => {
  try {
    const result = await runEnrichAll();
    res.json({ ...result, schedule: getScheduleStatus() });
  } catch (err) {
    res.status(500).json({ error: "Failed to trigger enrichment run" });
  }
});

export default router;
