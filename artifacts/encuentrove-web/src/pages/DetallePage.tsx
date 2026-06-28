import * as React from "react";
import { useRoute, Link } from "wouter";
import { getSerById } from "@/api";
import { subscribeLiveFeed, getLiveSnapshot } from "@/lib/liveFeed";
import { SerVivienteConEstado, EstadoPersona, MovimientoConUbicacion } from "@/data/types";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, User, PawPrint, Calendar, AlertCircle, HeartPulse, ShieldCheck, Activity, ZoomIn, X } from "lucide-react";
import { Isotype } from "@/components/brand/Isotype";
import { Footer } from "@/components/Footer";
import { ShareButtons } from "@/components/ShareButtons";

const STATUS_LABELS: Record<EstadoPersona, string> = {
  BUSCADO: "Buscado/a",
  LOCALIZADO_BIEN: "Localizado/a Bien",
  EN_REFUGIO: "En Refugio",
  NECESITA_ASISTENCIA_MEDICA: "Necesita Atencion Medica",
};

const STATUS_COLORS: Record<EstadoPersona, string> = {
  BUSCADO: "hsl(var(--status-buscado))",
  LOCALIZADO_BIEN: "hsl(var(--status-localizado))",
  EN_REFUGIO: "hsl(var(--status-refugio))",
  NECESITA_ASISTENCIA_MEDICA: "hsl(var(--status-medica))",
};

function PhotoViewer({ fotoUrl, nombre }: { fotoUrl: string; nombre: string }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <>
      <div className="relative group cursor-pointer" onClick={() => setExpanded(true)}>
        <img src={fotoUrl} alt={`Foto de ${nombre}`} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center rounded-2xl">
          <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
        </div>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpanded(false)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
            onClick={() => setExpanded(false)}
            aria-label="Cerrar foto"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={fotoUrl}
            alt={`Foto ampliada de ${nombre}`}
            className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

function MovimientoCard({ mov, isLatest }: { mov: MovimientoConUbicacion; isLatest: boolean }) {
  const movStatusColor = STATUS_COLORS[mov.estado_persona];

  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm border ${isLatest ? 'border-primary/20 ring-1 ring-primary/10' : 'border-border'}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full text-white"
              style={{ backgroundColor: movStatusColor }}
            >
              {STATUS_LABELS[mov.estado_persona]}
            </span>
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(mov.fecha_registro))}
            </span>
          </div>
          <h4 className="font-bold text-base md:text-lg flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            {mov.ubicacion.nombre_lugar}
            <span className="text-sm font-normal text-muted-foreground ml-1">
              — Zona {mov.ubicacion.zona}
            </span>
          </h4>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-xl">
        <div>
          <span className="text-muted-foreground block mb-1 text-xs uppercase font-bold tracking-wider">Reportado por</span>
          <span className="font-medium">{mov.id_persona_dueno_telefono}</span>
        </div>
        {mov.con_familiar && (
          <div>
            <span className="text-muted-foreground block mb-1 text-xs uppercase font-bold tracking-wider">Con familiar</span>
            <span className="font-medium text-emerald-700 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Si
            </span>
          </div>
        )}
        {mov.condicion_medica && (
          <div>
            <span className="text-muted-foreground block mb-1 text-xs uppercase font-bold tracking-wider">Condicion Medica</span>
            <span className="font-medium text-orange-700 flex items-center gap-1.5">
              <HeartPulse className="w-3.5 h-3.5" />
              {mov.condicion_medica}
            </span>
          </div>
        )}
        <div>
          <span className="text-muted-foreground block mb-1 text-xs uppercase font-bold tracking-wider">ID Transaccion</span>
          <span className="font-mono text-xs text-muted-foreground">{mov.id_trx}</span>
        </div>
      </div>
    </div>
  );
}

export default function DetallePage() {
  const [, params] = useRoute("/ser/:id");
  const id = params?.id;

  const [ser, setSer] = React.useState<SerVivienteConEstado | null>(null);
  const [loading, setLoading] = React.useState(true);
  const liveSnapshot = React.useSyncExternalStore(subscribeLiveFeed, getLiveSnapshot);

  // El id de la URL cambio — recarga mostrando el skeleton.
  React.useEffect(() => {
    if (id) {
      setLoading(true);
      getSerById(id).then(data => {
        setSer(data);
        setLoading(false);
      });
    }
  }, [id]);

  // Llego un push del feed en vivo — refresca a esta misma persona en
  // silencio (puede haber cambiado de estado mientras la pagina esta abierta).
  React.useEffect(() => {
    if (!id || !liveSnapshot) return;
    getSerById(id).then(setSer);
  }, [id, liveSnapshot]);

  // Combina con el OG dinamico que sirve el api-server a bots sociales
  // (ver artifacts/api-server/src/routes/og.ts) para que la pestana del
  // navegador tambien refleje a quien se esta viendo, no el titulo generico.
  React.useEffect(() => {
    if (!ser) return;
    const nombre = ser.tipo_ser === 'PERSONA' ? `${ser.nombre} ${ser.apellido}` : (ser.nombre ?? 'Animal');
    document.title = `${STATUS_LABELS[ser.estadoActual]}: ${nombre} — EncuentroVE`;
    return () => {
      document.title = 'EncuentroVE — Busca a tus seres queridos';
    };
  }, [ser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-24 pb-12 px-4 flex justify-center">
        <div className="w-full max-w-3xl animate-pulse space-y-8">
          <div className="h-8 w-32 bg-muted rounded"></div>
          <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-border h-96"></div>
        </div>
      </div>
    );
  }

  if (!ser) {
    return (
      <div className="min-h-screen bg-background pt-32 px-4 flex flex-col items-center text-center">
        <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="w-10 h-10 text-muted-foreground opacity-50" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Registro no encontrado</h2>
        <p className="text-muted-foreground max-w-md mb-8">El ID proporcionado no corresponde a ningun registro en la base de datos de emergencia.</p>
        <Link href="/buscar">
          <Button className="rounded-full px-8">Volver a la busqueda</Button>
        </Link>
      </div>
    );
  }

  const isPersona = ser.tipo_ser === 'PERSONA';
  const mainFotoUrl = ser.ultimoMovimiento.fotoUrl;
  const statusColor = STATUS_COLORS[ser.estadoActual];
  const nombreCompleto = isPersona ? `${ser.nombre} ${ser.apellido}` : (ser.nombre ?? 'Animal');

  return (
    <div className="min-h-[100dvh] bg-background pt-24 pb-20">
      <div className="container mx-auto px-4 md:px-6 max-w-4xl">
        <Link href="/buscar" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a resultados
        </Link>

        {/* Profile Card */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-md border border-border/50 mb-10">
          <div className="h-32 md:h-40 relative" style={{ backgroundColor: statusColor }}>
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='3'/%3E%3C/g%3E%3C/svg%3E")`, backgroundSize: '20px 20px' }}></div>
          </div>

          <div className="px-6 md:px-10 pb-8 md:pb-10 relative">
            <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start -mt-16 md:-mt-20 relative z-10">
              {/* Avatar / Photo */}
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl border-4 border-white bg-white shadow-lg overflow-hidden shrink-0 flex items-center justify-center">
                {mainFotoUrl ? (
                  <PhotoViewer fotoUrl={mainFotoUrl} nombre={nombreCompleto} />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Isotype width={60} height={60} className="opacity-20" />
                  </div>
                )}
              </div>

              {/* Header Info */}
              <div className="flex-1 text-center md:text-left pt-2 md:pt-24">
                <div className="inline-flex items-center justify-center md:justify-start gap-2 mb-3">
                  <span
                    className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full text-white shadow-sm"
                    style={{ backgroundColor: statusColor }}
                    data-testid="badge-estado"
                  >
                    {STATUS_LABELS[ser.estadoActual]}
                  </span>

                  {ser.ultimoMovimiento.con_familiar && (
                    <span className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1 border border-emerald-200">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Con familiar
                    </span>
                  )}
                </div>

                <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mb-2">
                  {nombreCompleto}
                </h1>

                <div className="text-muted-foreground font-medium flex items-center justify-center md:justify-start gap-2 text-sm md:text-base">
                  {isPersona ? <User className="w-4 h-4" /> : <PawPrint className="w-4 h-4" />}
                  <span>{ser.id}</span>
                  <span className="opacity-40">•</span>
                  <span>{ser.rango_edad}</span>
                  {ser.sexo && (
                    <>
                      <span className="opacity-40">•</span>
                      <span>{ser.sexo}</span>
                    </>
                  )}
                </div>

                <ShareButtons
                  className="mt-4 flex justify-center md:justify-start"
                  title={`${STATUS_LABELS[ser.estadoActual]}: ${nombreCompleto} — EncuentroVE`}
                  text={`${ser.ubicacionActual.nombre_lugar ? `Visto por última vez en ${ser.ubicacionActual.nombre_lugar}. ` : ""}Ayúdanos a difundir y encontrarlo/a.`}
                  url={`https://encuentrove.online/ser/${encodeURIComponent(ser.id)}`}
                />
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
              <div className="space-y-6">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest border-b pb-2">Identificacion</h3>
                <dl className="space-y-4">
                  {isPersona ? (
                    ser.cedula && (
                      <div>
                        <dt className="text-sm text-muted-foreground mb-1">Cedula</dt>
                        <dd className="font-semibold text-foreground text-lg">{ser.cedula}</dd>
                      </div>
                    )
                  ) : (
                    <>
                      <div>
                        <dt className="text-sm text-muted-foreground mb-1">Raza / Tipo</dt>
                        <dd className="font-semibold text-foreground text-lg">{ser.raza ?? 'No especificada'}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted-foreground mb-1">Color / Marcas</dt>
                        <dd className="font-semibold text-foreground text-lg">{ser.color ?? 'No especificado'}</dd>
                      </div>
                    </>
                  )}
                </dl>
              </div>

              <div className="space-y-6">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest border-b pb-2">Ubicacion Actual</h3>
                <div className="bg-muted/50 rounded-2xl p-5 border border-border/50">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-lg mb-1">{ser.ubicacionActual.nombre_lugar}</div>
                      <div className="text-muted-foreground font-medium text-sm">Zona: {ser.ubicacionActual.zona}</div>
                    </div>
                  </div>
                </div>

                {ser.ultimoMovimiento.condicion_medica && (
                  <div className="bg-orange-50 text-orange-900 rounded-2xl p-5 border border-orange-200">
                    <div className="flex items-start gap-3">
                      <Activity className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-sm uppercase tracking-wider text-orange-800 mb-1">Nota Medica</div>
                        <div className="font-medium text-sm">{ser.ultimoMovimiento.condicion_medica}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Movement History */}
        <h3 className="text-xl font-bold tracking-tight mb-6">Historial de Movimientos</h3>
        <div className="relative border-l-2 border-muted ml-4 md:ml-6 space-y-8 pb-8">
          {ser.movimientos.map((mov, idx) => {
            const isLatest = idx === 0;
            const movStatusColor = STATUS_COLORS[mov.estado_persona];

            return (
              <div key={mov.id} className="relative pl-8 md:pl-10">
                <div
                  className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full border-4 border-background ${isLatest ? 'shadow-sm z-10' : ''}`}
                  style={{ backgroundColor: movStatusColor }}
                ></div>
                <MovimientoCard mov={mov} isLatest={isLatest} />
              </div>
            );
          })}
        </div>
      </div>

      <Footer />
    </div>
  );
}
