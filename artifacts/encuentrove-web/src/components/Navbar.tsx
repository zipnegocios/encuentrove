import * as React from "react";
import { Link, useLocation } from "wouter";
import { Logo } from "./brand/Logo";

export function Navbar() {
  const [location] = useLocation();
  const isHome = location === "/";
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    if (isHome) {
      const handleScroll = () => setScrolled(window.scrollY > 20);
      window.addEventListener("scroll", handleScroll);
      handleScroll();
      return () => window.removeEventListener("scroll", handleScroll);
    }
    setScrolled(true);
    return undefined;
  }, [isHome]);

  const navClass = `fixed top-0 w-full z-50 transition-all duration-300 ${
    scrolled || !isHome ? "bg-white shadow-sm border-b border-border py-3" : "bg-transparent py-5"
  }`;

  return (
    <nav className={navClass}>
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        <Link href="/">
          <div className="cursor-pointer">
            <Logo height={28} />
          </div>
        </Link>

        <div className="flex-1 flex justify-center">
          <Link href="/buscar">
            <div className={`font-medium text-sm md:text-base hover:text-primary transition-colors cursor-pointer ${
              scrolled || !isHome ? "text-foreground" : "text-white"
            }`}>
              Buscar
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className={`text-xs md:text-sm font-medium hidden sm:inline-block ${
            scrolled || !isHome ? "text-muted-foreground" : "text-white/90"
          }`}>
            Sistema activo
          </span>
        </div>
      </div>
    </nav>
  );
}
