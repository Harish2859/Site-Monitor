import { Router, type IRouter } from "express";
import healthRouter from "./health";
import monitorsRouter from "./monitors";
import monitorLogsRouter from "./monitor-logs";
import alertsRouter from "./alerts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(monitorsRouter);
router.use(monitorLogsRouter);
router.use(alertsRouter);

export default router;
