import * as React from "react";
import { Link } from "wouter";
import { Code2 } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

const DEV_TEAM = ["Simon Salazar", "José Gabriel Pérez Cortez", "Gustavo Amarista"];

function initials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-auto bg-white">
      <div className="h-1 w-full bg-gradient-to-r from-primary via-accent to-primary" />

      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
          <div className="flex flex-col items-center md:items-start text-center md:text-left gap-3">
            <Logo height={24} />
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Plataforma pública de búsqueda en zonas de emergencia. Conectamos personas, animales y familias que se buscan.
            </p>
          </div>

          <div className="flex flex-col items-center md:items-start gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/70">Navegación</h4>
            <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Inicio
            </Link>
            <Link href="/buscar" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Buscar
            </Link>
          </div>

          <div className="flex flex-col items-center md:items-start gap-3 text-center md:text-left">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/70">Aviso</h4>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Todos los datos mostrados son referenciales y están sujetos a confirmación en campo.
            </p>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            © {year} EncuentroVE — Aplicación sin fines de lucro.
          </p>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              Desarrollado por{" "}
              <a
                href="https://ss2526.tech/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground hover:text-primary underline"
              >
                Solutions Systems 2526 C.A.
              </a>
            </span>

            <Dialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      aria-label="Equipo de desarrollo"
                      data-testid="button-dev-team"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-border/60 text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors shrink-0"
                    >
                      <Code2 className="w-3.5 h-3.5" />
                    </button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>Equipo de Desarrollo</TooltipContent>
              </Tooltip>

              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Code2 className="w-5 h-5 text-primary" />
                    Equipo de Desarrollo
                  </DialogTitle>
                  <DialogDescription>Las personas detrás de EncuentroVE.</DialogDescription>
                </DialogHeader>
                <ul className="space-y-2.5 pt-1">
                  {DEV_TEAM.map((name) => (
                    <li key={name} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                        {initials(name)}
                      </div>
                      <p className="font-medium text-sm text-foreground">{name}</p>
                    </li>
                  ))}
                </ul>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </footer>
  );
}
