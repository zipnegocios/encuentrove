import { Router, type Request, type Response } from "express";
import { getFeedCached } from "../lib/feed";

const router = Router();

// El feed es la ruta de lectura mas pedida del sistema — la consulta tanto
// la app mobile como el fallback de la web, en ambos casos directo (sin
// pasar por el poller/SSE). Antes esto caia en el passthrough generico de
// /api/v1 (ver app.ts) y reenviaba cada request al backend Java sin cache:
// con muchos clientes concurrentes (sobre todo mobile, que no usa SSE) la
// carga sobre el backend Java escalaba 1:1 con la cantidad de usuarios.
//
// Aca se sirve desde el mismo snapshot en memoria que ya mantiene el poller
// para el SSE (se refresca cada 10s, ver lib/feed.ts) — el backend Java solo
// recibe el trafico del poller, sin importar cuantos clientes pidan esto.
// Se ignoran page/size: el snapshot ya viene completo (el poller pagina
// contra el backend Java internamente), asi que siempre se devuelve todo de
// una vez en una sola "pagina".
router.get("/seres-vivientes/feed", async (req: Request, res: Response) => {
  const tipoSer = typeof req.query.tipoSer === "string" ? req.query.tipoSer.toUpperCase() : undefined;
  const all = await getFeedCached();
  const data = tipoSer ? all.filter((item) => item.tipoSer === tipoSer) : all;

  res.set("Cache-Control", "public, max-age=10");
  res.json({
    success: true,
    message: "Feed obtenido correctamente",
    currentPage: 0,
    totalItems: data.length,
    totalPages: 1,
    isLastPage: true,
    data,
  });
});

export default router;
