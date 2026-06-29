import { Router, type Request, type Response } from "express";
import { maskPhone } from "../lib/feed";
import { logger } from "../lib/logger";

const router = Router();

const JAVA_BACKEND = (process.env.JAVA_BACKEND_URL ?? "https://heart.encuentrove.online").replace(/\/$/, "");

interface CedulaLookupData {
  telefonoRef?: string;
  usuario?: { telefono?: string };
}

// GET /api/v1/seres-vivientes/cedula/:cedula cae en el passthrough generico
// de /api/v1 (app.ts) y devuelve telefonoRef / usuario.telefono SIN
// enmascarar a quien la llame directo — a diferencia del feed/historial, que
// ya enmascaran via contactoLabel (lib/feed.ts). Se intercepta aca antes del
// passthrough para aplicar la misma mascara.
router.get("/seres-vivientes/cedula/:cedula", async (req: Request, res: Response) => {
  const cedula = Array.isArray(req.params.cedula) ? req.params.cedula[0] : req.params.cedula;
  const url = `${JAVA_BACKEND}/api/v1/seres-vivientes/cedula/${encodeURIComponent(cedula)}`;

  try {
    const upstream = await fetch(url, { headers: { Accept: "application/json" } });
    const body = await upstream.json() as { success: boolean; data?: CedulaLookupData };

    if (body.data) {
      body.data.telefonoRef = maskPhone(body.data.telefonoRef);
      if (body.data.usuario) body.data.usuario.telefono = maskPhone(body.data.usuario.telefono);
    }

    res.status(upstream.status).json(body);
  } catch (err) {
    logger.error({ err, url }, "cedula proxy error");
    res.status(502).json({ success: false, message: "Backend proxy error", data: null });
  }
});

export default router;
