import { QRCodeSVG } from "qrcode.react";
import { Download, Smartphone, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Descarga directa mientras Google Play Store termina de aprobar la app.
// Cuando este publicada en la tienda, reemplazar este link (y el de la app
// movil) por la URL de Play Store.
const APK_URL = "https://encuentrove-bucket.s3.us-east-1.amazonaws.com/fotos/2026/06/ce0f59b4-c281-4620-a0b7-15966b87aa09.apk";

const CHECKS = [
  "Es el mismo archivo que enviamos a Google.",
  "Escaneado con antivirus y firmado por nuestro equipo.",
  "Solo necesitas permitir \"Instalar desde orígenes desconocidos\" en tu celular.",
];

export function DescargaApp() {
  return (
    <section className="mt-16 max-w-3xl mx-auto bg-[#0f3b25] rounded-3xl p-8 md:p-12 text-white flex flex-col md:flex-row items-center gap-8">
      <div className="flex-1 text-center md:text-left">
        <div className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#2ECC71] mb-3">
          <Smartphone className="w-4 h-4" />
          Descarga Segura de nuestra App (Version Android)
        </div>
        <p className="text-white/70 mb-4">
          Mientras Google Play Store finaliza la revision de nuestra aplicacion (proceso que puede tomar hasta 7 dias), hemos habilitado un enlace de descarga directa del archivo APK.
        </p>
        <ul className="space-y-2 mb-6">
          {CHECKS.map((text) => (
            <li key={text} className="flex items-start gap-2 text-sm text-white/80">
              <CheckCircle2 className="w-4 h-4 text-[#2ECC71] shrink-0 mt-0.5" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <a href={APK_URL} download>
          <Button size="lg" className="rounded-full px-8 bg-[#2ECC71] hover:bg-[#2ECC71]/90 text-[#0f3b25] font-semibold">
            <Download className="w-4 h-4 mr-2" />
            Descargar APK
          </Button>
        </a>
        <p className="text-white/50 text-xs mt-4">
          Una vez que la app este en Play Store, te notificaremos para que actualices desde alli.
        </p>
      </div>
      <div className="bg-white p-4 rounded-2xl shrink-0">
        <QRCodeSVG value={APK_URL} size={140} />
      </div>
    </section>
  );
}
