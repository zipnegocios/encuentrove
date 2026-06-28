import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { logger } from "../lib/logger";

const router = Router();

const JAVA_BACKEND = (process.env.JAVA_BACKEND_URL ?? "https://heart.encuentrove.online").replace(/\/$/, "");

const ESTADO_LABELS: Record<string, string> = {
  BUSCADO: "Buscado/a",
  LOCALIZADO_BIEN: "Localizado/a — Bien",
  EN_REFUGIO: "En refugio",
  NECESITA_ASISTENCIA_MEDICA: "Necesita asistencia médica",
};

const ESTADOS = Object.keys(ESTADO_LABELS) as [string, ...string[]];

// Bounds prevent a single client (or a flood of fake tokens) from growing the
// in-memory registrations map or per-token watch lists without limit.
const MAX_WATCHES_PER_TOKEN = 100;
const MAX_REGISTRATIONS = 5000;

const watchItemSchema = z.object({
  stableKey: z.string().min(1).max(200),
  lastKnownEstado: z.enum(ESTADOS),
  nombre: z.string().max(200).optional(),
});

const registerBodySchema = z.object({
  token: z.string().min(1).max(256),
  watches: z.array(watchItemSchema).max(MAX_WATCHES_PER_TOKEN),
});

const deleteBodySchema = z.object({
  token: z.string().min(1).max(256),
});

const checkBodySchema = z.object({
  watches: z.array(watchItemSchema).max(MAX_WATCHES_PER_TOKEN),
});

type WatchCheckItem = z.infer<typeof watchItemSchema>;

interface WatchRegistration {
  token: string;
  watches: WatchCheckItem[];
  updatedAt: number;
}

// Applied per-route (not via router.use) — a path-less router.use() here would
// also run for sibling routers' paths (e.g. /reports, /healthz) that fall
// through this router without a match, rate-limiting unrelated endpoints.
const watchesLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

interface ApiFeedItem {
  idMovimiento: number;
  tipoSer: string;
  nombre: string;
  apellido?: string;
  cedula?: string;
  estadoActual: string;
}

function deriveStableKey(item: ApiFeedItem): string {
  if (item.cedula?.trim()) return item.cedula.trim();
  return `${item.tipoSer}::${item.nombre ?? ""}::${item.apellido ?? ""}`;
}

async function fetchFeedItems(tipo: string): Promise<ApiFeedItem[]> {
  const url = `${JAVA_BACKEND}/api/v1/seres-vivientes/feed?tipoSer=${tipo}&page=0&size=500`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Feed ${tipo}: HTTP ${res.status}`);
  const data = await res.json() as { success: boolean; data: ApiFeedItem[] };
  return data.data ?? [];
}

async function buildStateMap(): Promise<Map<string, string>> {
  const [personaResult, animalResult] = await Promise.allSettled([
    fetchFeedItems("PERSONA"),
    fetchFeedItems("ANIMAL"),
  ]);
  if (personaResult.status === "rejected") throw personaResult.reason;
  const all: ApiFeedItem[] = [
    ...personaResult.value,
    ...(animalResult.status === "fulfilled" ? animalResult.value : []),
  ];
  const map = new Map<string, string>();
  for (const item of all) {
    const key = deriveStableKey(item);
    if (!map.has(key)) map.set(key, item.estadoActual);
  }
  return map;
}

async function sendExpoPush(token: string, nombre: string, oldEstado: string, newEstado: string, stableKey: string): Promise<void> {
  const oldLabel = ESTADO_LABELS[oldEstado] ?? oldEstado;
  const newLabel = ESTADO_LABELS[newEstado] ?? newEstado;
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        to: token,
        title: `📍 ${nombre}`,
        body: `Estado cambió: ${oldLabel} → ${newLabel}`,
        data: { stableKey },
        sound: "default",
      }),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "Expo push send failed");
    }
  } catch (err) {
    logger.warn({ err }, "Expo push network error");
  }
}

const registrations = new Map<string, WatchRegistration>();
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

async function checkAndPushAll(): Promise<void> {
  if (registrations.size === 0) return;
  let stateMap: Map<string, string>;
  try {
    stateMap = await buildStateMap();
  } catch (err) {
    logger.warn({ err }, "watches scheduler: backend unreachable");
    return;
  }

  const now = Date.now();
  for (const [token, reg] of registrations) {
    if (now - reg.updatedAt > TOKEN_TTL_MS) {
      registrations.delete(token);
      continue;
    }

    const updatedWatches: WatchCheckItem[] = [];
    let dirty = false;

    for (const watch of reg.watches) {
      const currentEstado = stateMap.get(watch.stableKey);
      if (currentEstado !== undefined && currentEstado !== watch.lastKnownEstado) {
        dirty = true;
        await sendExpoPush(token, watch.nombre ?? watch.stableKey, watch.lastKnownEstado, currentEstado, watch.stableKey);
        updatedWatches.push({ ...watch, lastKnownEstado: currentEstado });
      } else {
        updatedWatches.push(watch);
      }
    }

    if (dirty) {
      registrations.set(token, { ...reg, watches: updatedWatches });
    }
  }
}

setInterval(() => {
  checkAndPushAll().catch((err) => logger.error({ err }, "watches scheduler error"));
}, 60_000);

router.post("/watches/register", watchesLimiter, (req: Request, res: Response) => {
  const parsed = registerBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "token and watches[] required" });
    return;
  }
  const { token, watches } = parsed.data;

  if (registrations.size >= MAX_REGISTRATIONS && !registrations.has(token)) {
    res.status(503).json({ success: false, message: "Service temporarily at capacity" });
    return;
  }

  registrations.set(token, { token, watches, updatedAt: Date.now() });
  logger.info({ token: token.slice(0, 20), watchCount: watches.length }, "watches registered");
  res.json({ success: true, message: "Watches registered for push delivery" });
});

router.delete("/watches/register", watchesLimiter, (req: Request, res: Response) => {
  const parsed = deleteBodySchema.safeParse(req.body);
  if (parsed.success) registrations.delete(parsed.data.token);
  res.json({ success: true });
});

router.post("/watches/check", watchesLimiter, async (req: Request, res: Response) => {
  const parsed = checkBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "watches[] required" });
    return;
  }
  const { watches } = parsed.data;
  if (watches.length === 0) {
    res.json({ success: true, changed: [] });
    return;
  }
  try {
    const stateMap = await buildStateMap();
    const changed = watches
      .filter((w) => {
        const cur = stateMap.get(w.stableKey);
        return cur !== undefined && cur !== w.lastKnownEstado;
      })
      .map((w) => ({
        stableKey: w.stableKey,
        oldEstado: w.lastKnownEstado,
        newEstado: stateMap.get(w.stableKey)!,
      }));
    res.json({ success: true, changed });
  } catch (err) {
    logger.error({ err }, "watches/check error");
    res.status(502).json({ success: false, message: "Backend proxy error" });
  }
});

export default router;
