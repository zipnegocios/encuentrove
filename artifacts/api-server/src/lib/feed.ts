import { logger } from "./logger";

const JAVA_BACKEND = (process.env.JAVA_BACKEND_URL ?? "https://heart.encuentrove.online").replace(/\/$/, "");
const S3_BASE_URL = (process.env.S3_BASE_URL ?? "https://encuentrove-bucket.s3.us-east-1.amazonaws.com").replace(/\/$/, "");

const FEED_CACHE_TTL_MS = 30_000;

export interface ApiFeedItem {
  idMovimiento: number;
  tipoSer: string;
  nombre: string;
  apellido?: string;
  cedula?: string;
  estadoActual: string;
  urlFoto?: string;
  nombreLugar?: string;
  condicionMedica?: string;
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

export async function fetchFeedItems(tipo: "PERSONA" | "ANIMAL"): Promise<ApiFeedItem[]> {
  const url = `${JAVA_BACKEND}/api/v1/seres-vivientes/feed?tipoSer=${tipo}&page=0&size=500`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Feed ${tipo}: HTTP ${res.status}`);
  const data = await res.json() as { success: boolean; data: ApiFeedItem[] };
  return data.data ?? [];
}

let feedCache: ApiFeedItem[] | null = null;
let feedCacheAt = 0;
let feedCacheInflight: Promise<ApiFeedItem[]> | null = null;

async function fetchAllFeedItems(): Promise<ApiFeedItem[]> {
  const [personaResult, animalResult] = await Promise.allSettled([
    fetchFeedItems("PERSONA"),
    fetchFeedItems("ANIMAL"),
  ]);
  if (personaResult.status === "rejected" && animalResult.status === "rejected") {
    throw personaResult.reason;
  }
  return [
    ...(personaResult.status === "fulfilled" ? personaResult.value : []),
    ...(animalResult.status === "fulfilled" ? animalResult.value : []),
  ];
}

// Shared by watches.ts, og.ts (per-person OG) and the sitemap route — all three
// need the same "every active person/animal" list. A short TTL cache avoids
// hitting the Java backend independently from each call site.
export async function getFeedCached(): Promise<ApiFeedItem[]> {
  const now = Date.now();
  if (feedCache && now - feedCacheAt < FEED_CACHE_TTL_MS) return feedCache;
  if (feedCacheInflight) return feedCacheInflight;

  feedCacheInflight = fetchAllFeedItems()
    .then((items) => {
      feedCache = items;
      feedCacheAt = Date.now();
      return items;
    })
    .catch((err) => {
      logger.warn({ err }, "feed cache: backend unreachable");
      return feedCache ?? [];
    })
    .finally(() => {
      feedCacheInflight = null;
    });

  return feedCacheInflight;
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
