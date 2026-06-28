import { Router, type Request, type Response } from "express";
import { getMovementHistory } from "../lib/feed";

const router = Router();

router.get("/movimientos/:id", (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  res.json({ success: true, data: getMovementHistory(id) });
});

export default router;
