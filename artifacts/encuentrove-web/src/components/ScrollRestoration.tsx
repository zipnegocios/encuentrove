import * as React from "react";
import { useLocation, useSearch } from "wouter";

// Posiciones de scroll por URL, en memoria (alcanza para la sesion del tab).
const scrollPositions = new Map<string, number>();

// Se registra al evaluar el modulo (antes de que React monte nada), para
// garantizar que se entera de un popstate ANTES que el listener interno de
// wouter — si se registrara dentro de un useEffect, wouter (que tambien usa
// popstate via useLocation/useSearch) puede re-renderizar y disparar el
// efecto de restauracion antes de que nuestro flag quede en true.
let isPop = false;
if (typeof window !== "undefined") {
  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }
  window.addEventListener("popstate", () => { isPop = true; });
}

export function ScrollRestoration() {
  const [pathname] = useLocation();
  const search = useSearch();
  const key = search ? `${pathname}?${search}` : pathname;
  const prevPathnameRef = React.useRef(pathname);

  // Guarda la posicion de scroll de la URL que se esta abandonando.
  React.useEffect(() => {
    return () => { scrollPositions.set(key, window.scrollY); };
  }, [key]);

  React.useEffect(() => {
    if (isPop) {
      // Atras/adelante del navegador: vuelve a donde estaba. La pagina
      // destino puede montar con un skeleton mas corto que el contenido
      // real (los datos llegan async), asi que reintenta en los proximos
      // frames para no quedar "clampeado" por una altura todavia chica.
      const y = scrollPositions.get(key) ?? 0;
      window.scrollTo(0, y);
      requestAnimationFrame(() => {
        window.scrollTo(0, y);
        requestAnimationFrame(() => window.scrollTo(0, y));
      });
    } else if (prevPathnameRef.current !== pathname) {
      // Cambio de ruta (no solo filtros/busqueda en la misma pagina): arriba.
      window.scrollTo(0, 0);
    }
    isPop = false;
    prevPathnameRef.current = pathname;
  }, [key, pathname]);

  return null;
}
