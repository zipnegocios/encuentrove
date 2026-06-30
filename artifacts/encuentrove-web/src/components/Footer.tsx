import * as React from "react";
import { Link } from "wouter";
// Oculto temporalmente — no eliminar.
// import { Code2 } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
// Oculto temporalmente — no eliminar.
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogDescription,
//   DialogTrigger,
// } from "@/components/ui/dialog";
// import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

// Oculto temporalmente — no eliminar.
// const DEV_TEAM = ["Simon Salazar", "José Gabriel Pérez Cortez", "Gustavo Amarista"];
// function initials(name: string): string {
//   const parts = name.split(" ").filter(Boolean);
//   if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
//   return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
// }

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-auto bg-white">
      <div className="h-[3px] w-full bg-gradient-to-r from-primary via-accent to-primary" />

      <div className="container mx-auto px-4 md:px-6 py-3 md:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5">
            <Logo height={16} className="shrink-0 opacity-90" />
            <span className="hidden lg:inline text-[11px] text-muted-foreground border-l border-border/60 pl-2.5 leading-none">
              Datos referenciales, sujetos a confirmación en campo.
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] sm:text-xs text-muted-foreground">
            <Link href="/" className="hover:text-primary transition-colors">
              Inicio
            </Link>
            <Link href="/buscar" className="hover:text-primary transition-colors">
              Buscar
            </Link>
            {/* Oculto temporalmente — no eliminar. */}
            {/* <span className="text-border hidden sm:inline">|</span>
            <span>
              © {year} ·{" "}
              <a
                href="https://ss2526.tech/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground hover:text-primary underline"
              >
                SS2526 C.A.
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
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-border/60 text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors shrink-0"
                    >
                      <Code2 className="w-3 h-3" />
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
            </Dialog> */}
          </div>
        </div>
      </div>
    </footer>
  );
}
