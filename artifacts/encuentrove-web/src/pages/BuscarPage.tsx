import * as React from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Search, Filter, Loader2, MapPin, User, PawPrint, Calendar, ArrowRight } from "lucide-react";
import { searchSeres, getZonas, SearchParams, meetsPredictiveThreshold } from "@/api";
import { subscribeLiveFeed, getLiveSnapshot } from "@/lib/liveFeed";
import { SerVivienteConEstado, TipoSer, EstadoPersona } from "@/data/types";
import { buildSerPath } from "@/lib/slug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Isotype } from "@/components/brand/Isotype";
import { Footer } from "@/components/Footer";
import { ShareButtons } from "@/components/ShareButtons";
import { MarqueeText } from "@/components/MarqueeText";

const SEARCH_PLACEHOLDER = "Buscar por nombre, apellido o cedula...";

const STATUS_LABELS: Record<EstadoPersona, string> = {
  BUSCADO: "Buscado/a",
  LOCALIZADO_BIEN: "Localizado/a",
  EN_REFUGIO: "En Refugio",
  NECESITA_ASISTENCIA_MEDICA: "Necesita Atencion Medica"
};

const STATUS_COLORS: Record<EstadoPersona, string> = {
  BUSCADO: "hsl(var(--status-buscado))",
  LOCALIZADO_BIEN: "hsl(var(--status-localizado))",
  EN_REFUGIO: "hsl(var(--status-refugio))",
  NECESITA_ASISTENCIA_MEDICA: "hsl(var(--status-medica))"
};

// Layout de la grilla de resultados: el usuario elige densidad por separado
// para mobile (1/2 columnas) y desktop (4/6/8 columnas) — ver toolbar arriba
// de la grilla. Mapeado a clases literales (no interpoladas) para que el
// scanner JIT de Tailwind las detecte en build.
type MobileCols = 1 | 2;
type DesktopCols = 4 | 6 | 8;

const MOBILE_GRID_CLASS: Record<MobileCols, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
};
const DESKTOP_GRID_CLASS: Record<DesktopCols, string> = {
  4: "md:grid-cols-4",
  6: "md:grid-cols-6",
  8: "md:grid-cols-8",
};
const DESKTOP_GAP_CLASS: Record<DesktopCols, string> = {
  4: "gap-6",
  6: "gap-4",
  8: "gap-3",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const DEFAULT_PAGE_SIZE = 10;

interface FilterSelectsProps {
  tipo: string;
  setTipo: (v: string) => void;
  estado: string;
  setEstado: (v: string) => void;
  zona: string;
  setZona: (v: string) => void;
  zonasOptions: string[];
  stacked?: boolean;
}

// Compartido entre los selects inline de desktop y el contenido del Drawer
// off-canvas de mobile — mismo estado/logica, solo cambia el layout.
function FilterSelects({ tipo, setTipo, estado, setEstado, zona, setZona, zonasOptions, stacked }: FilterSelectsProps) {
  const triggerClass = stacked ? "h-12 w-full rounded-xl" : "h-12 w-full md:w-[140px] rounded-xl";
  const triggerClassWide = stacked ? "h-12 w-full rounded-xl" : "h-12 w-full md:w-[180px] rounded-xl";
  const suffix = stacked ? "-mobile" : "";

  return (
    <>
      <Select value={tipo} onValueChange={setTipo}>
        <SelectTrigger className={triggerClass} data-testid={`select-tipo${suffix}`}>
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="PERSONA">Personas</SelectItem>
          <SelectItem value="ANIMAL">Animales</SelectItem>
        </SelectContent>
      </Select>

      <Select value={estado} onValueChange={setEstado}>
        <SelectTrigger className={triggerClassWide} data-testid={`select-estado${suffix}`}>
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Cualquier estado</SelectItem>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={zona} onValueChange={setZona}>
        <SelectTrigger className={triggerClassWide} data-testid={`select-zona${suffix}`}>
          <SelectValue placeholder="Zona" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Todas las zonas</SelectItem>
          {zonasOptions.map(z => (
            <SelectItem key={z} value={z}>{z}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

export default function BuscarPage() {
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(searchString);
  
  const queryUrl = searchParams.get("q") ?? "";
  // "PERSONA" es el default — el listado de mascotas/animales solo aparece
  // si se filtra explicitamente por "ANIMAL". "ALL" se coerciona a "PERSONA"
  // por compatibilidad con links viejos que aun usen ese valor.
  const rawTipoUrl = searchParams.get("tipo") ?? "PERSONA";
  const tipoUrl = rawTipoUrl === "ALL" ? "PERSONA" : rawTipoUrl;
  const estadoUrl = searchParams.get("estado") ?? "ALL";
  const zonaUrl = searchParams.get("zona") ?? "ALL";
  const pageUrl = parseInt(searchParams.get("page") || "1", 10);
  const pageSizeUrl = parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10);

  const [query, setQuery] = React.useState(queryUrl);
  const [tipo, setTipo] = React.useState<string>(tipoUrl);
  const [estado, setEstado] = React.useState<string>(estadoUrl);
  const [zona, setZona] = React.useState<string>(zonaUrl);

  const [zonasOptions, setZonasOptions] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [results, setResults] = React.useState<SerVivienteConEstado[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [mobileCols, setMobileCols] = React.useState<MobileCols>(2);
  const [desktopCols, setDesktopCols] = React.useState<DesktopCols>(4);

  const hasActiveFilters = tipoUrl !== "PERSONA" || estadoUrl !== "ALL" || zonaUrl !== "ALL";

  const liveSnapshot = React.useSyncExternalStore(subscribeLiveFeed, getLiveSnapshot);

  React.useEffect(() => {
    getZonas().then(setZonasOptions);
  }, [liveSnapshot]);

  // La URL cambio por fuera de este formulario (atras/adelante del navegador,
  // link externo) — sincroniza los campos visibles para que no queden con
  // texto/filtros desfasados respecto a lo que realmente se esta mostrando.
  React.useEffect(() => { setQuery(queryUrl); }, [queryUrl]);
  React.useEffect(() => { setTipo(tipoUrl); }, [tipoUrl]);
  React.useEffect(() => { setEstado(estadoUrl); }, [estadoUrl]);
  React.useEffect(() => { setZona(zonaUrl); }, [zonaUrl]);

  // Busqueda predictiva: a partir de 3 caracteres (o al vaciar el campo)
  // aplica el filtro de texto sin esperar a que se envie el formulario.
  // Usa replace para no llenar el historial con una entrada por cada tecla.
  React.useEffect(() => {
    if (query === queryUrl) return;
    if (!meetsPredictiveThreshold(query)) return;

    const timer = setTimeout(() => {
      const p = new URLSearchParams(searchString);
      if (query.trim()) p.set("q", query.trim()); else p.delete("q");
      p.set("page", "1");
      setLocation(`/buscar?${p.toString()}`, { replace: true });
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const runSearch = React.useCallback(() => {
    const params: SearchParams = {
      query: queryUrl,
      tipo: tipoUrl as TipoSer,
      estado: estadoUrl === "ALL" ? undefined : (estadoUrl as EstadoPersona),
      zona: zonaUrl === "ALL" ? undefined : zonaUrl,
      page: pageUrl,
      pageSize: pageSizeUrl
    };

    return searchSeres(params).then(res => {
      setResults(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setLoading(false);
    });
  }, [queryUrl, tipoUrl, estadoUrl, zonaUrl, pageUrl, pageSizeUrl]);

  // Filtros/pagina cambiaron — recarga mostrando el skeleton.
  React.useEffect(() => {
    setLoading(true);
    runSearch();
  }, [runSearch]);

  // Llego un push del feed en vivo — refresca en silencio, sin parpadeo de loading.
  React.useEffect(() => {
    if (liveSnapshot) runSearch();
  }, [liveSnapshot, runSearch]);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const p = new URLSearchParams();
    if (query.trim()) p.set("q", query.trim());
    if (tipo !== "PERSONA") p.set("tipo", tipo);
    if (estado !== "ALL") p.set("estado", estado);
    if (zona !== "ALL") p.set("zona", zona);
    if (pageSizeUrl !== DEFAULT_PAGE_SIZE) p.set("pageSize", String(pageSizeUrl));
    p.set("page", "1");
    setLocation(`/buscar?${p.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    const p = new URLSearchParams(searchString);
    p.set("page", newPage.toString());
    setLocation(`/buscar?${p.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePageSizeChange = (value: string) => {
    const p = new URLSearchParams(searchString);
    if (value === String(DEFAULT_PAGE_SIZE)) p.delete("pageSize"); else p.set("pageSize", value);
    p.set("page", "1");
    setLocation(`/buscar?${p.toString()}`);
  };

  return (
    <div className="flex flex-col bg-background pt-20">
      {/* Search Header */}
      <div className="bg-white border-b sticky top-[68px] z-40 shadow-sm pb-4">
        <div className="container mx-auto px-4 md:px-6 pt-6">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 max-w-5xl mx-auto">
            <div className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-muted-foreground" />
                </div>
                <Input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-10 h-12 text-base rounded-xl"
                  data-testid="input-search"
                />
                {query.length === 0 && (
                  <div className="absolute inset-y-0 left-10 right-3 flex items-center pointer-events-none">
                    <MarqueeText text={SEARCH_PLACEHOLDER} className="text-base text-muted-foreground" />
                  </div>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setFiltersOpen(true)}
                className="h-12 w-12 rounded-xl shrink-0 relative md:hidden"
                data-testid="button-open-filters"
              >
                <Filter className="h-5 w-5" />
                {hasActiveFilters && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
                )}
              </Button>
            </div>

            <div className="hidden md:flex gap-4">
              <FilterSelects
                tipo={tipo} setTipo={setTipo}
                estado={estado} setEstado={setEstado}
                zona={zona} setZona={setZona}
                zonasOptions={zonasOptions}
              />
            </div>

            <Button type="submit" size="lg" className="h-12 rounded-xl px-8 hidden md:inline-flex" data-testid="button-search-submit">
              Filtrar
            </Button>
          </form>
        </div>
      </div>

      <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Filtrar resultados</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-2 space-y-4">
            <FilterSelects
              tipo={tipo} setTipo={setTipo}
              estado={estado} setEstado={setEstado}
              zona={zona} setZona={setZona}
              zonasOptions={zonasOptions}
              stacked
            />
          </div>
          <DrawerFooter>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setQuery(""); setTipo("PERSONA"); setEstado("ALL"); setZona("ALL");
                  setLocation("/buscar");
                  setFiltersOpen(false);
                }}
              >
                Limpiar filtros
              </Button>
            )}
            <Button
              type="button"
              className="h-12 rounded-xl"
              onClick={() => { handleSearch(); setFiltersOpen(false); }}
              data-testid="button-apply-filters"
            >
              Ver resultados
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Results */}
      <main className="flex-1 container mx-auto px-4 md:px-6 py-8">
        {loading ? (
          <div className={`grid ${MOBILE_GRID_CLASS[mobileCols]} ${DESKTOP_GRID_CLASS[desktopCols]} ${DESKTOP_GAP_CLASS[desktopCols]}`}>
            {Array.from({ length: Math.min(pageSizeUrl, 12) }).map((_, i) => (
              <Card key={i} className="overflow-hidden border-none shadow-md rounded-2xl flex flex-col h-[320px]">
                <Skeleton className="h-48 w-full rounded-none" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </Card>
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
              <Search className="w-8 h-8 text-muted-foreground opacity-50" />
            </div>
            <h3 className="text-xl font-bold mb-2">No se encontraron resultados</h3>
            <p className="text-muted-foreground max-w-md">
              Intenta buscar con otros terminos o ajusta los filtros. Recuerda que la base de datos se actualiza constantemente.
            </p>
            <Button variant="outline" className="mt-6 rounded-full" onClick={() => {
              setQuery(""); setTipo("PERSONA"); setEstado("ALL"); setZona("ALL");
              setLocation('/buscar');
            }}>
              Limpiar filtros
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground font-medium">
              <span>Mostrando {results.length} de {total} registros</span>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground/80 hidden sm:inline">Por página</span>
                  <Select value={String(pageSizeUrl)} onValueChange={handlePageSizeChange}>
                    <SelectTrigger className="h-8 w-[72px] rounded-lg text-sm" data-testid="select-page-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-1 md:hidden">
                  {([1, 2] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMobileCols(n)}
                      data-testid={`button-cols-mobile-${n}`}
                      className={`w-7 h-6 rounded-md text-xs font-bold transition-colors ${
                        mobileCols === n ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                <div className="hidden md:inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-1">
                  {([4, 6, 8] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setDesktopCols(n)}
                      data-testid={`button-cols-desktop-${n}`}
                      className={`w-7 h-6 rounded-md text-xs font-bold transition-colors ${
                        desktopCols === n ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={`grid ${MOBILE_GRID_CLASS[mobileCols]} ${DESKTOP_GRID_CLASS[desktopCols]} ${DESKTOP_GAP_CLASS[desktopCols]}`}>
              {results.map((ser) => (
                <Link key={ser.id} href={buildSerPath(ser)}>
                  <div className="group cursor-pointer h-full">
                    <Card className="overflow-hidden h-full border-border/50 shadow-sm hover:shadow-lg transition-all duration-300 rounded-2xl flex flex-col bg-white hover:-translate-y-1">
                      <div className="relative h-48 bg-muted overflow-hidden flex items-center justify-center">
                        {ser.ultimoMovimiento.fotoUrl ? (
                          <img 
                            src={ser.ultimoMovimiento.fotoUrl} 
                            alt={ser.nombre || "Foto"} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                        ) : (
                          <Isotype width={48} height={48} className="opacity-20" />
                        )}
                        <div className="absolute top-3 right-3">
                          <span 
                            className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full text-white shadow-sm backdrop-blur-md"
                            style={{ backgroundColor: STATUS_COLORS[ser.estadoActual] }}
                          >
                            {STATUS_LABELS[ser.estadoActual]}
                          </span>
                        </div>
                      </div>
                      
                      <div className="p-5 flex-1 flex flex-col">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                          {ser.tipo_ser === 'PERSONA' ? <User className="w-3.5 h-3.5" /> : <PawPrint className="w-3.5 h-3.5" />}
                          {ser.tipo_ser}
                        </div>
                        
                        <h3 className="text-lg font-bold text-foreground leading-tight mb-3 line-clamp-2">
                          {ser.tipo_ser === 'PERSONA' 
                            ? `${ser.nombre} ${ser.apellido}` 
                            : `${ser.nombre} (${ser.raza || 'Animal'})`}
                        </h3>
                        
                        <div className="mt-auto space-y-2.5">
                          <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
                            <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-primary/70" />
                            <span className="line-clamp-2 leading-snug">{ser.ubicacionActual.nombre_lugar}</span>
                          </div>

                          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4 shrink-0 text-primary/70" />
                            <span>
                              {new Intl.DateTimeFormat('es-VE', { dateStyle:'medium' }).format(new Date(ser.ultimoMovimiento.fecha_registro))}
                            </span>
                          </div>

                          <div className="pt-3 mt-1 border-t border-border/60">
                            <span className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary-foreground bg-primary px-3.5 py-2.5 rounded-xl shadow-sm group-hover:bg-accent transition-colors duration-300">
                              Ver detalles
                              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-12 mb-8">
                <Button 
                  variant="outline" 
                  disabled={pageUrl <= 1}
                  onClick={() => handlePageChange(pageUrl - 1)}
                  className="rounded-full px-6"
                >
                  Anterior
                </Button>
                <div className="text-sm font-medium text-muted-foreground px-4">
                  Pagina {pageUrl} de {totalPages}
                </div>
                <Button 
                  variant="outline" 
                  disabled={pageUrl >= totalPages}
                  onClick={() => handlePageChange(pageUrl + 1)}
                  className="rounded-full px-6"
                >
                  Siguiente
                </Button>
              </div>
            )}
          </>
        )}

        <div className="mt-12 max-w-3xl mx-auto text-center">
          <p className="text-sm font-medium text-muted-foreground mb-3">Ayuda a difundir EncuentroVE</p>
          <ShareButtons
            className="flex justify-center"
            title="EncuentroVE — Portal de Emergencia"
            text="Busca a tus seres queridos en zonas de emergencia."
            url="https://encuentrove.online/buscar"
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
