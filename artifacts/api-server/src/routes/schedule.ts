import { Router } from "express";
import { getScheduleStatus, runEnrichAll } from "../lib/scheduler";

const router: Router = Router();

router.get("/schedule", (_req, res) => {
  res.json(getScheduleStatus());
});

router.post("/schedule/trigger", async (_req, res) => {
  const result = await runEnrichAll();
  res.json({ ...result, schedule: getScheduleStatus() });
});

export default router;
