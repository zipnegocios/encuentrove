// Phase 2: real HTTP calls to the backend API.
// Uses Vite proxy (dev) / nginx proxy (Docker) so all requests are relative /api/v1/...
// Override with VITE_API_BASE_URL for external absolute URLs (e.g. staging/prod).
// Falls back to mock data when the API is unreachable.

import { seresVivientes, movimientos, getUbicacionForMovimiento, ubicaciones as mockUbicaciones } from '../data/mockData';
import {
  SerVivienteConEstado,
  MovimientoConUbicacion,
  MovimientoSerViviente,
  Ubicacion,
  EstadoPersona,
  TipoSer,
  RangoEdad,
  Sexo,
} from '../data/types';

// ─── Runtime env ──────────────────────────────────────────────────────────────
// Reads window.__ENV__ (injected by nginx at container start) then import.meta.env.
function getEnv(key: string): string {
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = ((window as any).__ENV__ as Record<string, string> | undefined)?.[key];
    if (v) return v;
  }
  return (import.meta.env as Record<string, string>)[key] ?? '';
}

export const S3_BASE_URL = (): string => getEnv('VITE_S3_BASE_URL');
export const API_BASE_URL = (): string => getEnv('VITE_API_BASE_URL');

// Returns the base prefix for API calls:
// - If VITE_API_BASE_URL is set → use it as-is (e.g. for an external backend).
// - Otherwise use '' (empty) so paths like '/api/v1/...' are relative,
//   handled by the Vite proxy in dev and nginx proxy_pass in Docker.
function apiBase(): string {
  return API_BASE_URL().replace(/\/$/, '');
}

// ─── Real API types ────────────────────────────────────────────────────────────

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

// ─── Mapping helpers ───────────────────────────────────────────────────────────

function buildFotoUrl(urlFoto: string | undefined | null): string | null {
  if (!urlFoto) return null;
  if (urlFoto.startsWith('http')) return urlFoto; // already full S3 URL
  const s3 = S3_BASE_URL();
  if (s3) return `${s3.replace(/\/$/, '')}/${urlFoto}`;
  return null;
}

function mapSexo(raw: string | undefined | null): Sexo | null {
  if (!raw) return null;
  const u = raw.toUpperCase();
  if (u === 'MASCULINO') return 'Masculino';
  if (u === 'FEMENINO') return 'Femenino';
  return 'Desconocido';
}

function mapRangoEdad(raw: string | undefined | null): RangoEdad {
  if (!raw) return 'ADULTO';
  const n = raw.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const map: Record<string, RangoEdad> = {
    NINO: 'NINO', ADOLESCENTE: 'ADOLESCENTE', ADULTO: 'ADULTO', ANCIANO: 'ANCIANO',
  };
  return map[n] ?? 'ADULTO';
}

function contactoLabel(u: ApiUsuario | undefined): string {
  if (!u) return '';
  const nombre = u.nombreCompleto ?? `${u.nombre ?? ''} ${u.apellido ?? ''}`.trim();
  return [nombre, u.telefono].filter(Boolean).join(' — ');
}

function mapFeedItem(item: ApiFeedItem): SerVivienteConEstado {
  // Use cedula as the routing ID for personas; composite for animals without cedula.
  const id = item.cedula
    ? item.cedula.replace(/\s+/g, '-')
    : `${item.tipoSer}-${item.nombre ?? 'SIN_NOMBRE'}-${item.idMovimiento}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

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

// ─── Feed fetcher (real API) ───────────────────────────────────────────────────

let feedCache: SerVivienteConEstado[] | null = null;
let feedCacheAt = 0;
const CACHE_TTL = 60_000;

async function fetchFeed(): Promise<SerVivienteConEstado[]> {
  const now = Date.now();
  if (feedCache && now - feedCacheAt < CACHE_TTL) return feedCache;

  const base = apiBase();

  // Fetch PERSONA and ANIMAL separately (all-types feed has a backend bug with upper(bytea)).
  // fetchTipo throws on HTTP errors so the caller can detect API unreachability.
  async function fetchTipo(tipo: string): Promise<ApiFeedItem[]> {
    const res = await fetch(`${base}/api/v1/seres-vivientes/feed?tipoSer=${tipo}&page=0&size=500`);
    if (!res.ok) throw new Error(`Feed ${tipo}: HTTP ${res.status}`);
    const data: ApiFeedResponse = await res.json();
    return data.data ?? [];
  }

  // Use allSettled so ANIMAL failure doesn't lose PERSONA data.
  // But if PERSONA (primary) fails, consider the API unreachable → throw → mock fallback.
  const [personaResult, animalResult] = await Promise.allSettled([
    fetchTipo('PERSONA'),
    fetchTipo('ANIMAL'),
  ]);

  if (personaResult.status === 'rejected') throw personaResult.reason;

  const all = [
    ...personaResult.value,
    ...(animalResult.status === 'fulfilled' ? animalResult.value : []),
  ]
    .sort((a, b) => new Date(b.fechaRegistro).getTime() - new Date(a.fechaRegistro).getTime());

  // Deduplicate: one card per ser_viviente — keep the latest movement snapshot.
  const seen = new Map<string, ApiFeedItem>();
  for (const item of all) {
    const key = item.cedula || `${item.tipoSer}::${item.nombre}::${item.apellido ?? ''}`;
    if (!seen.has(key)) seen.set(key, item);
  }

  feedCache = Array.from(seen.values()).map(mapFeedItem);
  feedCacheAt = now;
  return feedCache;
}

// ─── Mock data fallback ────────────────────────────────────────────────────────

function buildFotoUrlMock(url_foto: string | null, id: string): string | null {
  if (!url_foto) return null;
  const s3 = S3_BASE_URL();
  if (s3) return `${s3.replace(/\/$/, '')}/${url_foto}`;
  return `https://api.dicebear.com/9.x/personas/svg?seed=${id}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
}

function enrichMovimientoMock(mov: MovimientoSerViviente): MovimientoConUbicacion {
  return { ...mov, ubicacion: getUbicacionForMovimiento(mov.id_ubicacion), fotoUrl: buildFotoUrlMock(mov.url_foto, mov.id_ser_viviente) };
}

const seresConEstadoMock: SerVivienteConEstado[] = (() => {
  return seresVivientes.map(ser => {
    const movs = movimientos
      .filter(m => m.id_ser_viviente === ser.id)
      .sort((a, b) => new Date(b.fecha_registro).getTime() - new Date(a.fecha_registro).getTime())
      .map(enrichMovimientoMock);
    if (movs.length === 0) return null;
    const latest = movs[0];
    return { ...ser, estadoActual: latest.estado_persona, ubicacionActual: latest.ubicacion, ultimoMovimiento: latest, movimientos: movs };
  }).filter((s): s is SerVivienteConEstado => s !== null);
})();

// ─── Selector: real API vs mock ────────────────────────────────────────────────

async function getAll(): Promise<SerVivienteConEstado[]> {
  // Use real API whenever a proxy or absolute URL is available.
  // In dev with Vite proxy, apiBase() returns '' and '/api/...' calls are proxied.
  // In production, VITE_API_BASE_URL should be set to the backend URL.
  try {
    return await fetchFeed();
  } catch {
    // API unreachable — fall back to mock data silently.
    return seresConEstadoMock;
  }
}

// ─── Public API (stable signatures — do NOT change for Phase 3+) ─────────────

export interface SearchParams {
  query?: string;
  tipo?: TipoSer | '';
  estado?: EstadoPersona | '';
  zona?: string;
  page?: number;
  pageSize?: number;
}

export interface SearchResult {
  items: SerVivienteConEstado[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const normalizeStr = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export async function searchSeres(params: SearchParams): Promise<SearchResult> {
  let filtered = await getAll();

  if (params.query) {
    const q = normalizeStr(params.query);
    filtered = filtered.filter(ser => {
      const nombre = normalizeStr(`${ser.nombre ?? ''} ${ser.apellido ?? ''}`);
      return nombre.includes(q) || ser.cedula === params.query;
    });
  }
  if (params.tipo) filtered = filtered.filter(s => s.tipo_ser === params.tipo);
  if (params.estado) filtered = filtered.filter(s => s.estadoActual === params.estado);
  if (params.zona) {
    filtered = filtered.filter(s =>
      s.ubicacionActual.zona === params.zona || s.ubicacionActual.nombre_lugar === params.zona
    );
  }

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 12;
  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize) || 1;

  return { items: filtered.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize, totalPages };
}

export async function getSerById(id: string): Promise<SerVivienteConEstado | null> {
  const all = await getAll();
  return all.find(s => s.id === id || s.cedula === id) ?? null;
}

export async function getUbicaciones(): Promise<Ubicacion[]> {
  const all = await getAll();
  const seen = new Map<string, Ubicacion>();
  for (const s of all) {
    if (!seen.has(s.ubicacionActual.nombre_lugar)) seen.set(s.ubicacionActual.nombre_lugar, s.ubicacionActual);
  }
  return Array.from(seen.values());
}

export async function getMovimientos(id_ser_viviente: string): Promise<MovimientoConUbicacion[]> {
  const ser = await getSerById(id_ser_viviente);
  return ser?.movimientos ?? [];
}

export async function getZonas(): Promise<string[]> {
  const all = await getAll();
  // If we got real API data use location names; otherwise use the mock zonas.
  if (feedCache) return Array.from(new Set(all.map(s => s.ubicacionActual.nombre_lugar)));
  return Array.from(new Set(mockUbicaciones.map(u => u.zona)));
}

export interface Empresa {
  id: string;
  nombreEmpresa: string;
  representante: string;
  urlLogo: string;
}

export async function getEmpresas(): Promise<Empresa[]> {
  try {
    const base = apiBase();
    const res = await fetch(`${base}/api/v1/empresas/listar`);
    if (!res.ok) throw new Error(`Empresas: HTTP ${res.status}`);
    const data: { success: boolean; data: Empresa[] } = await res.json();
    return data.data ?? [];
  } catch {
    return [];
  }
}

export async function getEstadisticas(): Promise<{
  total: number;
  porEstado: Record<EstadoPersona, number>;
  porZona: Record<string, number>;
}> {
  const all = await getAll();
  const stats = {
    total: all.length,
    porEstado: { BUSCADO: 0, LOCALIZADO_BIEN: 0, EN_REFUGIO: 0, NECESITA_ASISTENCIA_MEDICA: 0 } as Record<EstadoPersona, number>,
    porZona: {} as Record<string, number>,
  };
  for (const s of all) {
    stats.porEstado[s.estadoActual] = (stats.porEstado[s.estadoActual] ?? 0) + 1;
    const z = s.ubicacionActual.zona;
    stats.porZona[z] = (stats.porZona[z] ?? 0) + 1;
  }
  return stats;
}
