import * as React from "react";
import { getEmpresas, Empresa } from "@/api";

export function EmpresasColaboradoras() {
  const [empresas, setEmpresas] = React.useState<Empresa[]>([]);

  React.useEffect(() => {
    getEmpresas().then(setEmpresas);
  }, []);

  if (empresas.length === 0) return null;

  return (
    <section className="mt-16 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold tracking-tight text-center mb-2">Empresas que Colaboran</h2>
      <p className="text-muted-foreground text-center mb-8">Organizaciones que apoyan esta plataforma de emergencia.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
        {empresas.map((empresa) => (
          <div key={empresa.id} className="bg-white rounded-xl p-5 border shadow-sm flex flex-col items-center text-center gap-3">
            <img
              src={empresa.urlLogo}
              alt={empresa.nombreEmpresa}
              className="h-16 w-16 object-contain rounded-lg"
              loading="lazy"
            />
            <div>
              <div className="font-semibold text-sm">{empresa.nombreEmpresa}</div>
              <div className="text-xs text-muted-foreground">{empresa.representante}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
