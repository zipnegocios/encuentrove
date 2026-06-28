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

function contactoLabel(u: ApiUsuario | undefined): string {
  if (!u) return "";
  const nombre = u.nombreCompleto ?? `${u.nombre ?? ""} ${u.apellido ?? ""}`.trim();
  return [nombre, u.telefono].filter(Boolean).join(" — ");
}

// ─── Historial real (backend Java) ─────────────────────────────────────────
// El feed (/seres-vivientes/feed) no trae el UUID real de la persona/animal,
// solo idMovimiento. El historial real solo es alcanzable via:
//   cedula -> GET /seres-vivientes/cedula/{cedula}  -> { data: { id: UUID } }
//   UUID   -> GET /seres-vivientes/historial/{UUID} -> { data: { movimientos } }
// Esto solo funciona si hay una cedula real on file (404 para "SIN_CEDULA",
// que es lo unico que tienen los animales y varias personas hoy). Para esos
// casos, getMovementHistory() (mas abajo) sigue siendo el respaldo.

export interface NormalizedMovimiento {
  id: number;
  estadoPersona: string;
  condicionMedica: string | null;
  conFamiliar: boolean;
  urlFoto: string | null;
  fechaRegistro: string;
  idTrx: string;
  nombreLugar: string;
  zona: string;
  contacto: string;
}

interface HistorialUsuario {
  nombre?: string;
  apellido?: string;
  telefono?: string;
}

interface HistorialMovimiento {
  id: number;
  ubicacion?: { nombreLugar?: string; zona?: string };
  usuario?: HistorialUsuario;
  estadoPersona: string;
  condicionMedica?: string;
  conFamiliar: boolean;
  urlFoto?: string;
  fechaRegistro: string;
  idTrx: string;
}

function contactoFromHistorialUsuario(u: HistorialUsuario | undefined): string {
  if (!u) return "";
  const nombre = `${u.nombre ?? ""} ${u.apellido ?? ""}`.trim();
  return [nombre, u.telefono].filter(Boolean).join(" — ");
}

const PLACEHOLDER_CEDULAS = new Set(["", "SIN_CEDULA", "NULL", "-"]);

async function fetchUuidByCedula(cedula: string): Promise<string | null> {
  try {
    const res = await fetch(`${JAVA_BACKEND}/api/v1/seres-vivientes/cedula/${encodeURIComponent(cedula)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json() as { success: boolean; data?: { id?: string } };
    return data.success ? data.data?.id ?? null : null;
  } catch {
    return null;
  }
}

// Devuelve null si no hay cedula real, o si el backend real no responde —
// en ambos casos el caller (routes/movimientos.ts) cae al respaldo interno.
export async function fetchHistorialReal(cedula: string | undefined): Promise<NormalizedMovimiento[] | null> {
  const trimmed = (cedula ?? "").trim();
  if (PLACEHOLDER_CEDULAS.has(trimmed.toUpperCase())) return null;

  const uuid = await fetchUuidByCedula(trimmed);
  if (!uuid) return null;

  try {
    const res = await fetch(`${JAVA_BACKEND}/api/v1/seres-vivientes/historial/${uuid}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json() as { success: boolean; data?: { movimientos: HistorialMovimiento[] } };
    if (!data.success || !data.data) return null;

    return data.data.movimientos.map((mov): NormalizedMovimiento => ({
      id: mov.id,
      estadoPersona: mov.estadoPersona,
      condicionMedica: mov.condicionMedica || null,
      conFamiliar: mov.conFamiliar,
      urlFoto: buildFotoUrl(mov.urlFoto),
      fechaRegistro: mov.fechaRegistro,
      idTrx: mov.idTrx,
      nombreLugar: mov.ubicacion?.nombreLugar ?? "",
      zona: mov.ubicacion?.zona ?? "",
      contacto: contactoFromHistorialUsuario(mov.usuario),
    }));
  } catch {
    return null;
  }
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

async function fetchAllFeedItemsSorted(): Promise<ApiFeedItem[]> {
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
  return all.sort((a, b) => new Date(b.fechaRegistro).getTime() - new Date(a.fechaRegistro).getTime());
}

let snapshot: ApiFeedItem[] = [];
let snapshotJson = "";
// Sin deduplicar — el historial de movimientos de una persona (DetallePage)
// necesita TODOS sus eventos, no solo el mas reciente (que es lo unico que
// conserva `snapshot`, pensado para la lista/feed en vivo).
let rawSnapshot: ApiFeedItem[] = [];
const listeners = new Set<(items: ApiFeedItem[]) => void>();

async function poll(): Promise<void> {
  let sorted: ApiFeedItem[];
  try {
    sorted = await fetchAllFeedItemsSorted();
  } catch (err) {
    logger.warn({ err }, "feed poll: backend unreachable, keeping last snapshot");
    return;
  }

  rawSnapshot = sorted;
  const items = sortAndDedupe(sorted);
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

// Respaldo cuando fetchHistorialReal() no aplica (sin cedula real) o falla:
// historial completo (todos los movimientos, no solo el ultimo) de una
// persona/animal puntual, filtrando el snapshot crudo en memoria. Ya viene
// ordenado descendente por fecha (ver poll()), pero limitado a la ventana de
// polling (ultimos ~500 movimientos por tipo).
export function getMovementHistory(routeId: string): NormalizedMovimiento[] {
  return rawSnapshot
    .filter((item) => deriveRouteId(item) === routeId || item.cedula === routeId)
    .map((item): NormalizedMovimiento => ({
      id: item.idMovimiento,
      estadoPersona: item.estadoActual,
      condicionMedica: item.condicionMedica || null,
      conFamiliar: item.conFamiliar,
      urlFoto: buildFotoUrl(item.urlFoto),
      fechaRegistro: item.fechaRegistro,
      idTrx: `TRX-${item.idMovimiento}`,
      nombreLugar: item.nombreLugar ?? "",
      zona: item.nombreLugar ?? "",
      contacto: contactoLabel(item.usuarioHito),
    }));
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
