import { Router, type IRouter } from "express";
import healthRouter from "./health";
import reportsRouter from "./reports";
import watchesRouter from "./watches";
import ogRouter from "./og";

const router: IRouter = Router();

router.use(healthRouter);
router.use(reportsRouter);
router.use(watchesRouter);
router.use(ogRouter);

export default router;
