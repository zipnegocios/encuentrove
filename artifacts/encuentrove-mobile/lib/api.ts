import {
  SerVivienteConEstado,
  MovimientoConUbicacion,
  EstadoPersona,
  TipoSer,
  RangoEdad,
  Sexo,
  Ubicacion,
  Estadisticas,
} from "@/types";

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "";
}

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

interface ApiFeedResponse {
  success: boolean;
  data: ApiFeedItem[];
}

function contactoLabel(u: ApiUsuario | undefined): string {
  if (!u) return "";
  const nombre = u.nombreCompleto ?? `${u.nombre ?? ""} ${u.apellido ?? ""}`.trim();
  return [nombre, u.telefono].filter(Boolean).join(" — ");
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

function mapFeedItem(item: ApiFeedItem): SerVivienteConEstado {
  const id = item.cedula
    ? item.cedula.replace(/\s+/g, "-")
    : `${item.tipoSer}-${item.nombre ?? "SIN_NOMBRE"}-${item.idMovimiento}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const ubicacion: Ubicacion = {
    id: item.idMovimiento,
    nombre_lugar: item.nombreLugar,
    geolocalizacion_red: null,
    zona: item.nombreLugar,
  };

  const mov: MovimientoConUbicacion = {
    id: item.idMovimiento,
    id_ser_viviente: id,
    id_ubicacion: item.idMovimiento,
    id_persona_dueno_telefono: contactoLabel(item.usuarioHito ?? item.usuarioCreador),
    estado_persona: item.estadoActual as EstadoPersona,
    condicion_medica: item.condicionMedica ?? null,
    con_familiar: item.conFamiliar,
    url_foto: item.urlFoto ?? null,
    fecha_registro: item.fechaRegistro,
    id_trx: `TRX-${item.idMovimiento}`,
    ubicacion,
    fotoUrl: item.urlFoto?.startsWith("http") ? item.urlFoto : null,
  };

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

async function fetchFeed(tipo: string): Promise<ApiFeedItem[]> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/v1/seres-vivientes/feed?tipoSer=${tipo}&page=0&size=500`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Feed ${tipo}: HTTP ${res.status}`);
  const data: ApiFeedResponse = await res.json();
  return data.data ?? [];
}

let feedCache: SerVivienteConEstado[] | null = null;
let feedCacheAt = 0;
const CACHE_TTL = 60_000;

export async function getAllSeres(): Promise<SerVivienteConEstado[]> {
  const now = Date.now();
  if (feedCache && now - feedCacheAt < CACHE_TTL) return feedCache;

  const [personaResult, animalResult] = await Promise.allSettled([
    fetchFeed("PERSONA"),
    fetchFeed("ANIMAL"),
  ]);

  if (personaResult.status === "rejected") throw personaResult.reason;

  const all = [
    ...personaResult.value,
    ...(animalResult.status === "fulfilled" ? animalResult.value : []),
  ].sort((a, b) => new Date(b.fechaRegistro).getTime() - new Date(a.fechaRegistro).getTime());

  const seen = new Map<string, ApiFeedItem>();
  for (const item of all) {
    const key = item.cedula || `${item.tipoSer}::${item.nombre}::${item.apellido ?? ""}`;
    if (!seen.has(key)) seen.set(key, item);
  }

  feedCache = Array.from(seen.values()).map(mapFeedItem);
  feedCacheAt = now;
  return feedCache;
}

export function invalidateFeedCache(): void {
  feedCache = null;
  feedCacheAt = 0;
}

const normalizeStr = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function filterSeres(
  all: SerVivienteConEstado[],
  params: { query?: string; tipo?: TipoSer | ""; estado?: EstadoPersona | "" }
): SerVivienteConEstado[] {
  let filtered = all;
  if (params.query) {
    const q = normalizeStr(params.query);
    filtered = filtered.filter((ser) => {
      const nombre = normalizeStr(`${ser.nombre ?? ""} ${ser.apellido ?? ""}`);
      return nombre.includes(q) || (ser.cedula && ser.cedula.includes(params.query!));
    });
  }
  if (params.tipo) filtered = filtered.filter((s) => s.tipo_ser === params.tipo);
  if (params.estado) filtered = filtered.filter((s) => s.estadoActual === params.estado);
  return filtered;
}

export function computeEstadisticas(all: SerVivienteConEstado[]): Estadisticas {
  const stats: Estadisticas = {
    total: all.length,
    porEstado: { BUSCADO: 0, LOCALIZADO_BIEN: 0, EN_REFUGIO: 0, NECESITA_ASISTENCIA_MEDICA: 0 },
  };
  for (const s of all) {
    stats.porEstado[s.estadoActual] = (stats.porEstado[s.estadoActual] ?? 0) + 1;
  }
  return stats;
}
