import { Router, type Request, type Response } from "express";
import { getMovementHistory, fetchHistorialReal } from "../lib/feed";

const router = Router();

router.get("/movimientos/:id", async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  // El id, cuando la persona tiene cedula real, ES esa cedula (ver
  // deriveRouteId) — intenta el historial real del backend Java primero.
  const real = await fetchHistorialReal(id);
  if (real && real.length > 0) {
    res.json({ success: true, data: real });
    return;
  }

  // Sin cedula real (animales, "SIN_CEDULA") o el backend real fallo: cae al
  // respaldo interno (snapshot crudo en memoria).
  res.json({ success: true, data: getMovementHistory(id) });
});

export default router;
