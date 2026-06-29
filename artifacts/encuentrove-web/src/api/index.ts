// Phase 2: real HTTP calls to the backend API.
// Uses Vite proxy (dev) / nginx proxy (Docker) so all requests are relative /api/v1/...
// Override with VITE_API_BASE_URL for external absolute URLs (e.g. staging/prod).
// Falls back to mock data when the API is unreachable.
// The real feed itself is no longer fetched here — see src/lib/liveFeed.ts,
// which receives it in real time over SSE and keeps a live snapshot in memory.

import { seresVivientes, movimientos, getUbicacionForMovimiento, ubicaciones as mockUbicaciones } from '../data/mockData';
import {
  SerVivienteConEstado,
  MovimientoConUbicacion,
  MovimientoSerViviente,
  Ubicacion,
  EstadoPersona,
  TipoSer,
} from '../data/types';
import { apiBase, S3_BASE_URL, API_BASE_URL } from '../lib/env';
import { getLiveSnapshot, fetchMovementHistory } from '../lib/liveFeed';

export { S3_BASE_URL, API_BASE_URL };

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

// ─── Selector: live feed vs mock ───────────────────────────────────────────────

async function getAll(): Promise<SerVivienteConEstado[]> {
  // The live feed (src/lib/liveFeed.ts) is always connecting/connected in the
  // background. While no real snapshot has arrived yet (first load, or the
  // backend has never been reachable), fall back to mock data silently.
  return getLiveSnapshot() ?? seresConEstadoMock;
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

const onlyDigits = (s: string) => s.replace(/\D/g, '');

// Umbral minimo para disparar una busqueda predictiva: si el usuario esta
// escribiendo numeros (cedula), se espera a 5 digitos antes de buscar (una
// busqueda parcial de 1-4 digitos seria demasiado amplia); si es texto
// (nombre/apellido), 3 caracteres alcanza. Un campo vacio siempre "cumple"
// para poder limpiar los resultados al borrar el input.
export function meetsPredictiveThreshold(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return true;
  const isNumeric = /^\d+$/.test(trimmed);
  return isNumeric ? trimmed.length >= 5 : trimmed.length >= 3;
}

export async function searchSeres(params: SearchParams): Promise<SearchResult> {
  let filtered = await getAll();

  if (params.query) {
    const q = normalizeStr(params.query);
    const qDigits = onlyDigits(params.query);
    filtered = filtered.filter(ser => {
      const nombre = normalizeStr(`${ser.nombre ?? ''} ${ser.apellido ?? ''}`);
      if (nombre.includes(q)) return true;
      if (qDigits.length >= 5 && ser.cedula && onlyDigits(ser.cedula).includes(qDigits)) return true;
      return false;
    });
  }
  // Por defecto el listado es solo de personas — los animales/mascotas solo
  // aparecen si se filtra explicitamente por tipo=ANIMAL.
  filtered = filtered.filter(s => s.tipo_ser === (params.tipo ?? 'PERSONA'));
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
  // El snapshot en vivo solo conserva el ultimo movimiento por persona (ver
  // lib/liveFeed.ts) — el historial completo se pide aparte al api-server.
  if (getLiveSnapshot()) {
    const history = await fetchMovementHistory(id_ser_viviente);
    if (history.length > 0) return history;
  }
  const ser = await getSerById(id_ser_viviente);
  return ser?.movimientos ?? [];
}

export async function getZonas(): Promise<string[]> {
  const all = await getAll();
  // If we got real (live) data use location names; otherwise use the mock zonas.
  if (getLiveSnapshot()) return Array.from(new Set(all.map(s => s.ubicacionActual.nombre_lugar)));
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
