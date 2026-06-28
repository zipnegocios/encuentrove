import { Logo } from "@/components/brand/Logo";

export function Footer() {
  return (
    <footer className="border-t py-8 mt-auto bg-white">
      <div className="container mx-auto px-4 text-center text-sm text-muted-foreground space-y-3">
        <Logo height={20} className="justify-center mb-2 opacity-50 grayscale" />
        <p>Plataforma publica de busqueda. Todos los datos son referenciales y sujetos a confirmacion en campo.</p>
        <p className="pt-3 border-t border-border/50 max-w-md mx-auto leading-relaxed">
          Desarrollado por{" "}
          <a
            href="https://ss2526.tech/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground hover:text-primary underline"
          >
            Solutions Systems 2526 C.A.
          </a>{" "}
          — Aplicacion Sin Fines de Lucro.
          <br />
          Torre Profesional La California, Av. Francisco de Miranda, Piso 5, Oficina 5-6C, Caracas 1070, Miranda.
        </p>
      </div>
    </footer>
  );
}
