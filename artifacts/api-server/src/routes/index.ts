import { Router, type IRouter } from "express";
import healthRouter from "./health";
import reportsRouter from "./reports";
import watchesRouter from "./watches";
import ogRouter from "./og";
import sseRouter from "./sse";

const router: IRouter = Router();

router.use(healthRouter);
router.use(reportsRouter);
router.use(watchesRouter);
router.use(ogRouter);
router.use(sseRouter);

export default router;
