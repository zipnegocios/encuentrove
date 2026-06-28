import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

const router = Router();

// Caps prevent unvalidated free-text fields and an unbounded in-memory array
// from being used to exhaust server memory or flood the feed with junk data.
const MAX_REPORTS = 10_000;

const reportSchema = z.object({
  tipo: z.enum(["PERSONA", "ANIMAL"]).optional(),
  nombre: z.string().trim().min(1).max(200),
  apellido: z.string().trim().max(200).optional(),
  cedula: z.string().trim().max(20).optional(),
  sexo: z.string().max(20).optional(),
  rangoEdad: z.string().max(50).optional(),
  raza: z.string().trim().max(100).optional(),
  ultimaUbicacion: z.string().trim().min(1).max(500),
  condicionMedica: z.string().trim().max(500).optional(),
  contacto: z.string().trim().max(200).optional(),
});

type ReportInput = z.infer<typeof reportSchema>;

interface StoredReport extends ReportInput {
  fechaReporte: string;
}

const reports: StoredReport[] = [];

// Applied per-route (not via router.use) — a path-less router.use() here would
// also run for sibling routers' paths (e.g. /watches/*, /healthz) that fall
// through this router without a match, rate-limiting unrelated endpoints.
const reportsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/reports", reportsLimiter, (req, res) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Datos de reporte inválidos." });
    return;
  }

  if (reports.length >= MAX_REPORTS) {
    res.status(503).json({ success: false, message: "Servicio temporalmente saturado." });
    return;
  }

  const report: StoredReport = {
    ...parsed.data,
    tipo: parsed.data.tipo ?? "PERSONA",
    fechaReporte: new Date().toISOString(),
  };

  reports.push(report);

  res.status(201).json({ success: true, message: "Reporte recibido correctamente.", data: report });
});

router.get("/reports", reportsLimiter, (_req, res) => {
  res.json({ success: true, data: reports, total: reports.length });
});

export default router;
