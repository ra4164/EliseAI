import { Router, type IRouter } from "express";
import healthRouter from "./health";
import leadsRouter from "./leads";
import scheduleRouter from "./schedule";

const router: IRouter = Router();

router.use(healthRouter);
router.use(leadsRouter);
router.use(scheduleRouter);

export default router;
