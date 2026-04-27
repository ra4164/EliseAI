import { Router, type IRouter } from "express";
import healthRouter from "./health";
import leadsRouter from "./leads";
import scheduleRouter from "./schedule";
import sheetsRouter from "./sheets";

const router: IRouter = Router();

router.use(healthRouter);
router.use(leadsRouter);
router.use(scheduleRouter);
router.use(sheetsRouter);

export default router;
