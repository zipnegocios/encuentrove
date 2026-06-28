import { QRCodeSVG } from "qrcode.react";
import { Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

const APK_PATH = "/downloads/app-release.apk";

export function DescargaApp() {
  const apkUrl = typeof window !== "undefined" ? `${window.location.origin}${APK_PATH}` : APK_PATH;

  return (
    <section className="mt-16 max-w-3xl mx-auto bg-[#0f3b25] rounded-3xl p-8 md:p-12 text-white flex flex-col md:flex-row items-center gap-8">
      <div className="flex-1 text-center md:text-left">
        <div className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#2ECC71] mb-3">
          <Smartphone className="w-4 h-4" />
          App Movil
        </div>
        <h2 className="text-2xl md:text-3xl font-bold mb-3">Lleva EncuentroVE en tu telefono</h2>
        <p className="text-white/70 mb-6">
          Descarga la version Android directamente (disponible temporalmente mientras se publica en las tiendas oficiales).
        </p>
        <a href={APK_PATH} download>
          <Button size="lg" className="rounded-full px-8 bg-[#2ECC71] hover:bg-[#2ECC71]/90 text-[#0f3b25] font-semibold">
            <Download className="w-4 h-4 mr-2" />
            Descargar APK
          </Button>
        </a>
      </div>
      <div className="bg-white p-4 rounded-2xl shrink-0">
        <QRCodeSVG value={apkUrl} size={140} />
      </div>
    </section>
  );
}
