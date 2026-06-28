import { logger } from "./logger";

const JAVA_BACKEND = (process.env.JAVA_BACKEND_URL ?? "https://heart.encuentrove.online").replace(/\/$/, "");
const S3_BASE_URL = (process.env.S3_BASE_URL ?? "https://encuentrove-bucket.s3.us-east-1.amazonaws.com").replace(/\/$/, "");

// How often to poll the Java backend for changes. Centralized here so a
// single poll serves every connected SSE client, watches.ts, the OG renderer
// and the sitemap — none of them hit the Java backend independently.
const POLL_INTERVAL_MS = 10_000;

export interface ApiUsuario {
  id?: string;
  nombreCompleto?: string;
  nombre?: string;
  apellido?: string;
  telefono?: string;
}

export interface ApiFeedItem {
  idMovimiento: number;
  tipoSer: string;
  nombre: string;
  apellido?: string;
  cedula?: string;
  rangoEdad?: string;
  sexo?: string;
  urlFoto?: string;
  estadoActual: string;
  condicionMedica?: string;
  conFamiliar: boolean;
  nombreLugar?: string;
  fechaRegistro: string;
  usuarioHito?: ApiUsuario;
  usuarioCreador?: ApiUsuario;
}

// Stable key for tracking a watch across estado changes (watches.ts).
// Not the same as the routing id used in /ser/:id — see deriveRouteId.
export function deriveStableKey(item: ApiFeedItem): string {
  if (item.cedula?.trim()) return item.cedula.trim();
  return `${item.tipoSer}::${item.nombre ?? ""}::${item.apellido ?? ""}`;
}

// Mirrors the frontend's id derivation (artifacts/encuentrove-web/src/api/index.ts
// mapFeedItem) so /api/og/ser/:id can find the same item a shared /ser/:id link
// points to.
export function deriveRouteId(item: ApiFeedItem): string {
  if (item.cedula) return item.cedula.replace(/\s+/g, "-");
  return `${item.tipoSer}-${item.nombre ?? "SIN_NOMBRE"}-${item.idMovimiento}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
}

// Mirrors the frontend's buildFotoUrl: urlFoto may already be an absolute URL,
// or a relative S3 key that needs the bucket base prepended.
export function buildFotoUrl(urlFoto: string | undefined): string | null {
  if (!urlFoto) return null;
  if (urlFoto.startsWith("http")) return urlFoto;
  return `${S3_BASE_URL}/${urlFoto}`;
}

async function fetchFeedItems(tipo: "PERSONA" | "ANIMAL"): Promise<ApiFeedItem[]> {
  const url = `${JAVA_BACKEND}/api/v1/seres-vivientes/feed?tipoSer=${tipo}&page=0&size=500`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Feed ${tipo}: HTTP ${res.status}`);
  const data = await res.json() as { success: boolean; data: ApiFeedItem[] };
  return data.data ?? [];
}

// The Java backend returns one row per movimiento (event), not one per
// persona/animal — the same person can appear multiple times. Sort by most
// recent first, then keep only the first (= latest) occurrence per identity.
function sortAndDedupe(items: ApiFeedItem[]): ApiFeedItem[] {
  const sorted = [...items].sort(
    (a, b) => new Date(b.fechaRegistro).getTime() - new Date(a.fechaRegistro).getTime(),
  );
  const seen = new Map<string, ApiFeedItem>();
  for (const item of sorted) {
    const key = item.cedula || `${item.tipoSer}::${item.nombre}::${item.apellido ?? ""}`;
    if (!seen.has(key)) seen.set(key, item);
  }
  return Array.from(seen.values());
}

async function fetchAllFeedItems(): Promise<ApiFeedItem[]> {
  const [personaResult, animalResult] = await Promise.allSettled([
    fetchFeedItems("PERSONA"),
    fetchFeedItems("ANIMAL"),
  ]);
  if (personaResult.status === "rejected" && animalResult.status === "rejected") {
    throw personaResult.reason;
  }
  const all = [
    ...(personaResult.status === "fulfilled" ? personaResult.value : []),
    ...(animalResult.status === "fulfilled" ? animalResult.value : []),
  ];
  return sortAndDedupe(all);
}

let snapshot: ApiFeedItem[] = [];
let snapshotJson = "";
const listeners = new Set<(items: ApiFeedItem[]) => void>();

async function poll(): Promise<void> {
  let items: ApiFeedItem[];
  try {
    items = await fetchAllFeedItems();
  } catch (err) {
    logger.warn({ err }, "feed poll: backend unreachable, keeping last snapshot");
    return;
  }

  const json = JSON.stringify(items);
  if (json === snapshotJson) return;

  snapshot = items;
  snapshotJson = json;
  for (const listener of listeners) listener(snapshot);
}

// Kick off immediately on module load (don't wait for the first interval
// tick) so the first request doesn't have to wait up to POLL_INTERVAL_MS.
void poll();
setInterval(() => {
  poll().catch((err) => logger.error({ err }, "feed poll: unexpected error"));
}, POLL_INTERVAL_MS);

// Always-fresh (max POLL_INTERVAL_MS old) snapshot — no network call here,
// just returns whatever the background poller currently holds. Async to
// keep the existing call sites (watches.ts, og.ts) unchanged.
export async function getFeedCached(): Promise<ApiFeedItem[]> {
  return snapshot;
}

export function subscribeFeed(listener: (items: ApiFeedItem[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function buildStateMap(): Promise<Map<string, string>> {
  const all = await getFeedCached();
  const map = new Map<string, string>();
  for (const item of all) {
    const key = deriveStableKey(item);
    if (!map.has(key)) map.set(key, item.estadoActual);
  }
  return map;
}
