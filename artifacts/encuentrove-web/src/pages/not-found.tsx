import { Link } from "wouter";
import { AlertCircle } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center p-4 pt-16">
        <div className="text-center max-w-md w-full bg-white rounded-3xl shadow-sm border p-8 md:p-12">
          <div className="flex justify-center mb-8">
            <Logo height={48} />
          </div>
          <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-muted-foreground opacity-50" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Pagina no encontrada</h1>
          <p className="mt-4 text-muted-foreground mb-8 text-lg">
            Lo sentimos, la pagina que estas buscando no existe o ha sido movida.
          </p>
          <Link href="/">
            <Button size="lg" className="rounded-full px-8 w-full md:w-auto h-14 text-lg font-medium shadow-md hover:shadow-lg transition-all">
              Volver al inicio
            </Button>
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}