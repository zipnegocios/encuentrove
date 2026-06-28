// Receives the real-time feed pushed by api-server over SSE (GET /api/events,
// see artifacts/api-server/src/routes/sse.ts) and shapes the raw backend
// items into SerVivienteConEstado — the only place in the frontend that knows
// about the raw API shape. src/api/index.ts consumes the already-shaped
// snapshot for search/filter/stats queries.
import { apiBase, S3_BASE_URL } from "./env";
import {
  SerVivienteConEstado,
  MovimientoConUbicacion,
  Ubicacion,
  EstadoPersona,
  TipoSer,
  RangoEdad,
  Sexo,
} from "@/data/types";

interface ApiUsuario {
  id?: string;
  nombreCompleto?: string;
  nombre?: string;
  apellido?: string;
  telefono?: string;
}

interface ApiFeedItem {
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
  nombreLugar: string;
  fechaRegistro: string;
  usuarioHito?: ApiUsuario;
  usuarioCreador?: ApiUsuario;
}

function buildFotoUrl(urlFoto: string | undefined | null): string | null {
  if (!urlFoto) return null;
  if (urlFoto.startsWith("http")) return urlFoto; // already full S3 URL
  const s3 = S3_BASE_URL();
  if (s3) return `${s3.replace(/\/$/, "")}/${urlFoto}`;
  return null;
}

function mapSexo(raw: string | undefined | null): Sexo | null {
  if (!raw) return null;
  const u = raw.toUpperCase();
  if (u === "MASCULINO") return "Masculino";
  if (u === "FEMENINO") return "Femenino";
  return "Desconocido";
}

function mapRangoEdad(raw: string | undefined | null): RangoEdad {
  if (!raw) return "ADULTO";
  const n = raw.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const map: Record<string, RangoEdad> = {
    NINO: "NINO", ADOLESCENTE: "ADOLESCENTE", ADULTO: "ADULTO", ANCIANO: "ANCIANO",
  };
  return map[n] ?? "ADULTO";
}

function contactoLabel(u: ApiUsuario | undefined): string {
  if (!u) return "";
  const nombre = u.nombreCompleto ?? `${u.nombre ?? ""} ${u.apellido ?? ""}`.trim();
  return [nombre, u.telefono].filter(Boolean).join(" — ");
}

function deriveId(item: ApiFeedItem): string {
  // Use cedula as the routing ID for personas; composite for animals without cedula.
  return item.cedula
    ? item.cedula.replace(/\s+/g, "-")
    : `${item.tipoSer}-${item.nombre ?? "SIN_NOMBRE"}-${item.idMovimiento}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

function mapMovimiento(item: ApiFeedItem): MovimientoConUbicacion {
  const id = deriveId(item);
  const ubicacion: Ubicacion = {
    id: item.idMovimiento,
    nombre_lugar: item.nombreLugar,
    geolocalizacion_red: null,
    zona: item.nombreLugar,
  };

  return {
    id: item.idMovimiento,
    id_ser_viviente: id,
    id_ubicacion: item.idMovimiento,
    id_persona_dueno_telefono: contactoLabel(item.usuarioHito),
    estado_persona: item.estadoActual as EstadoPersona,
    condicion_medica: item.condicionMedica || null,
    con_familiar: item.conFamiliar,
    url_foto: item.urlFoto || null,
    fecha_registro: item.fechaRegistro,
    id_trx: `TRX-${item.idMovimiento}`,
    ubicacion,
    fotoUrl: buildFotoUrl(item.urlFoto),
  };
}

function mapFeedItem(item: ApiFeedItem): SerVivienteConEstado {
  const id = deriveId(item);
  const ubicacion: Ubicacion = {
    id: item.idMovimiento,
    nombre_lugar: item.nombreLugar,
    geolocalizacion_red: null,
    zona: item.nombreLugar,
  };
  const mov = mapMovimiento(item);

  return {
    id,
    tipo_ser: item.tipoSer as TipoSer,
    nombre: item.nombre ?? null,
    apellido: item.apellido ?? null,
    cedula: item.cedula ?? null,
    sexo: mapSexo(item.sexo),
    rango_edad: mapRangoEdad(item.rangoEdad),
    raza: null,
    color: null,
    estadoActual: item.estadoActual as EstadoPersona,
    ubicacionActual: ubicacion,
    ultimoMovimiento: mov,
    movimientos: [mov],
  };
}

// ─── Live connection ────────────────────────────────────────────────────────

type Listener = () => void;

const FALLBACK_AFTER_MS = 60_000;

let snapshot: SerVivienteConEstado[] | null = null;
let receivedAny = false;
let eventSource: EventSource | null = null;
let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener();
}

function setSnapshot(items: SerVivienteConEstado[]): void {
  snapshot = items;
  receivedAny = true;
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
  notify();
}

// Last-resort path for the rare case SSE is blocked end-to-end (some
// corporate proxies strip it). EventSource keeps retrying on its own in the
// background regardless, so this only covers the gap until it gets through.
async function fetchOnceAsFallback(): Promise<void> {
  try {
    const base = apiBase();
    const fetchTipo = async (tipo: string): Promise<ApiFeedItem[]> => {
      const res = await fetch(`${base}/api/v1/seres-vivientes/feed?tipoSer=${tipo}&page=0&size=500`);
      if (!res.ok) throw new Error(`Feed ${tipo}: HTTP ${res.status}`);
      const data: { success: boolean; data: ApiFeedItem[] } = await res.json();
      return data.data ?? [];
    };
    const [persona, animal] = await Promise.all([fetchTipo("PERSONA"), fetchTipo("ANIMAL")]);
    if (!receivedAny) setSnapshot([...persona, ...animal].map(mapFeedItem));
  } catch {
    // Stay on mock fallback (handled by src/api/index.ts) — nothing more to do here.
  }
}

function connect(): void {
  if (typeof window === "undefined" || eventSource) return;

  eventSource = new EventSource(`${apiBase()}/api/events`);
  eventSource.onmessage = (event) => {
    try {
      const raw = JSON.parse(event.data) as ApiFeedItem[];
      setSnapshot(raw.map(mapFeedItem));
    } catch {
      // Malformed message — ignore, the next push will self-correct.
    }
  };

  fallbackTimer = setTimeout(() => {
    if (!receivedAny) fetchOnceAsFallback();
  }, FALLBACK_AFTER_MS);
}

export function subscribeLiveFeed(listener: Listener): () => void {
  connect();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLiveSnapshot(): SerVivienteConEstado[] | null {
  connect();
  return snapshot;
}

// Historial completo de movimientos de una persona/animal puntual (no solo
// el ultimo, que es lo unico que trae el snapshot en vivo de mas arriba).
// Ver GET /api/movimientos/:id en api-server (lib/feed.ts: getMovementHistory).
export async function fetchMovementHistory(id: string): Promise<MovimientoConUbicacion[]> {
  try {
    const res = await fetch(`${apiBase()}/api/movimientos/${encodeURIComponent(id)}`);
    if (!res.ok) return [];
    const data: { success: boolean; data: ApiFeedItem[] } = await res.json();
    return (data.data ?? []).map(mapMovimiento);
  } catch {
    return [];
  }
}
