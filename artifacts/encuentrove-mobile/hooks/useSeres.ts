import { useQuery } from "@tanstack/react-query";
import { getAllSeres, filterSeres, computeEstadisticas } from "@/lib/api";
import { mockSeres } from "@/lib/mockData";
import { SerVivienteConEstado, Estadisticas, EstadoPersona, TipoSer } from "@/types";

async function getSeres(): Promise<SerVivienteConEstado[]> {
  try {
    return await getAllSeres();
  } catch (err) {
    if (__DEV__) {
      console.warn("[EncuentroVE] API unreachable — using mock data (DEV only)", err);
      return mockSeres;
    }
    throw err;
  }
}

export function useAllSeres() {
  return useQuery<SerVivienteConEstado[]>({
    queryKey: ["seres"],
    queryFn: getSeres,
    staleTime: 60_000,
    retry: 2,
  });
}

export function useFilteredSeres(params: {
  query?: string;
  tipo?: TipoSer | "";
  estado?: EstadoPersona | "";
}) {
  const { data: all = [], ...rest } = useAllSeres();
  const items = filterSeres(all, params);
  return { data: items, ...rest };
}

export function useEstadisticas() {
  const { data: all = [], ...rest } = useAllSeres();
  const stats: Estadisticas = computeEstadisticas(all);
  return { data: stats, ...rest };
}

export function useSerById(id: string) {
  const { data: all = [], ...rest } = useAllSeres();
  const ser = all.find((s) => s.id === id || s.cedula === id) ?? null;
  return { data: ser, ...rest };
}
