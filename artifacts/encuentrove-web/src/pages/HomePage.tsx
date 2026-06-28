import * as React from "react";
import { Link, useLocation } from "wouter";
import { Search, MapPin, AlertCircle, HeartPulse, Home as HomeIcon, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getEstadisticas } from "@/api";
import { subscribeLiveFeed, getLiveSnapshot } from "@/lib/liveFeed";
import { Isotype } from "@/components/brand/Isotype";
import { Footer } from "@/components/Footer";
import { EmpresasColaboradoras } from "@/components/EmpresasColaboradoras";
import { DescargaApp } from "@/components/DescargaApp";
import { ShareButtons } from "@/components/ShareButtons";

export default function HomePage() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = React.useState("");
  const [stats, setStats] = React.useState<{ total: number; porEstado: any; porZona: any } | null>(null);
  const liveSnapshot = React.useSyncExternalStore(subscribeLiveFeed, getLiveSnapshot);

  React.useEffect(() => {
    getEstadisticas().then(setStats);
  }, [liveSnapshot]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setLocation(`/buscar?q=${encodeURIComponent(query.trim())}`);
    } else {
      setLocation('/buscar');
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Hero Section */}
      <div className="relative pt-24 pb-16 md:pt-32 md:pb-24 flex items-center justify-center overflow-hidden">
        {/* Background gradient & noise */}
        <div className="absolute inset-0 bg-[#0f3b25]">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at center, #2ECC71 0%, transparent 70%)' }}></div>
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`}}></div>
        </div>
        
        <div className="relative z-10 w-full max-w-4xl mx-auto px-4 md:px-6 text-center text-white">
          <div className="flex justify-center mb-6">
            <Isotype width={64} height={64} />
          </div>
          
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4">
            Encuentro<span className="text-[#2ECC71]">VE</span>
          </h1>
          
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-10 font-medium">
            Busca a tus seres queridos en zonas de emergencia.
          </p>

          <form onSubmit={handleSearch} className="max-w-2xl mx-auto relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 group-focus-within:text-primary transition-colors" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ingresa nombre, apellido o numero de cedula..."
              className="block w-full pl-12 pr-32 py-4 md:py-5 border-0 rounded-2xl text-gray-900 bg-white shadow-2xl focus:ring-4 focus:ring-primary/30 transition-all text-base md:text-lg"
              data-testid="input-search-hero"
            />
            <div className="absolute inset-y-2 right-2">
              <Button type="submit" size="lg" className="h-full rounded-xl px-6 md:px-8 bg-primary hover:bg-primary/90 text-white shadow-md" data-testid="button-search-hero">
                Buscar
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Emergency Banner */}
      <div className="bg-destructive text-destructive-foreground py-3 px-4 text-center text-sm font-medium flex items-center justify-center gap-2">
        <AlertCircle className="h-4 w-4" />
        <span>Portal de emergencia activo para el estado de Vargas. Los datos son actualizados por rescatistas en campo.</span>
      </div>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-12 md:py-16">
        <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
          
          {/* Stats Column */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight">Situacion en Tiempo Real</h2>
            <p className="text-muted-foreground">Datos consolidados por nuestros equipos de rescate en el terreno.</p>
            
            {stats ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-5 border shadow-sm flex flex-col justify-center items-center text-center">
                  <span className="text-4xl font-extrabold text-foreground mb-1">{stats.total}</span>
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Registros Totales</span>
                </div>
                
                <div className="space-y-3">
                  <div className="bg-white rounded-xl p-3 border shadow-sm flex items-center gap-3">
                    <div className="w-3 h-10 rounded-full" style={{ backgroundColor: 'hsl(var(--status-localizado))' }}></div>
                    <div>
                      <div className="text-xl font-bold">{stats.porEstado['LOCALIZADO_BIEN']}</div>
                      <div className="text-xs font-medium text-muted-foreground">Localizados Bien</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-3 border shadow-sm flex items-center gap-3">
                    <div className="w-3 h-10 rounded-full" style={{ backgroundColor: 'hsl(var(--status-refugio))' }}></div>
                    <div>
                      <div className="text-xl font-bold">{stats.porEstado['EN_REFUGIO']}</div>
                      <div className="text-xs font-medium text-muted-foreground">En Refugios</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-40 rounded-xl bg-muted animate-pulse"></div>
            )}
          </div>

          {/* Guide Column */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight">Comprender los Estados</h2>
            <div className="grid gap-4">
              <div className="flex gap-4 items-start p-4 rounded-xl border bg-white shadow-sm">
                <div className="p-2 rounded-full mt-0.5" style={{ backgroundColor: 'hsla(var(--status-buscado), 0.1)', color: 'hsl(var(--status-buscado))' }}>
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Buscado/a</h3>
                  <p className="text-sm text-muted-foreground mt-1">Persona o animal reportado como desaparecido. Los equipos estan alertas a su busqueda.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start p-4 rounded-xl border bg-white shadow-sm">
                <div className="p-2 rounded-full mt-0.5" style={{ backgroundColor: 'hsla(var(--status-localizado), 0.1)', color: 'hsl(var(--status-localizado))' }}>
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Localizado/a Bien</h3>
                  <p className="text-sm text-muted-foreground mt-1">Avistado por rescatistas en buen estado de salud general, pero aun en zona de riesgo.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start p-4 rounded-xl border bg-white shadow-sm">
                <div className="p-2 rounded-full mt-0.5" style={{ backgroundColor: 'hsla(var(--status-refugio), 0.1)', color: 'hsl(var(--status-refugio))' }}>
                  <HomeIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">En Refugio</h3>
                  <p className="text-sm text-muted-foreground mt-1">Se encuentra seguro en uno de los puntos de control o refugios establecidos.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start p-4 rounded-xl border bg-white shadow-sm">
                <div className="p-2 rounded-full mt-0.5" style={{ backgroundColor: 'hsla(var(--status-medica), 0.1)', color: 'hsl(var(--status-medica))' }}>
                  <HeartPulse className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Necesita Atencion Medica</h3>
                  <p className="text-sm text-muted-foreground mt-1">Ha sido localizado pero requiere o esta recibiendo asistencia medica prioritaria.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <EmpresasColaboradoras />
        <DescargaApp />

        <div className="mt-16 max-w-2xl mx-auto text-center bg-white rounded-2xl border p-8 shadow-sm">
          <HeartHandshake className="w-8 h-8 text-primary mx-auto mb-4" />
          <p className="text-muted-foreground leading-relaxed">
            Este servicio nace como una herramienta de apoyo ciudadano ante la emergencia. No tenemos fines comerciales ni lucrativos. Nuestro unico objetivo es conectar personas y ayudar a que mascotas y seres queridos regresen a casa. Todo el desarrollo, la app y el mantenimiento son costeados por nuestro equipo, sin cobrar ni un solo centavo a los usuarios.
          </p>
        </div>

        <div className="mt-16 max-w-3xl mx-auto text-center">
          <p className="text-sm font-medium text-muted-foreground mb-3">Ayuda a difundir EncuentroVE</p>
          <ShareButtons
            className="flex justify-center"
            title="EncuentroVE — Portal de Emergencia"
            text="Busca a tus seres queridos en zonas de emergencia."
            url="https://encuentrove.online/"
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
