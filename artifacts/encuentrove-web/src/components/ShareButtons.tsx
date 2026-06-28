import * as React from "react";
import { Share2, MessageCircle, Facebook, Twitter, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ShareButtonsProps {
  title: string;
  text: string;
  url: string;
  className?: string;
}

const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

export function ShareButtons({ title, text, url, className }: ShareButtonsProps) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title, text, url });
    } catch {
      // El usuario cancelo el dialogo nativo — no es un error a mostrar.
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Link copiado", description: "Pegalo donde quieras compartirlo." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "No se pudo copiar el link", description: url });
    }
  };

  if (canNativeShare) {
    return (
      <div className={className}>
        <Button onClick={handleNativeShare} className="rounded-full px-6">
          <Share2 className="w-4 h-4 mr-2" />
          Compartir
        </Button>
      </div>
    );
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" size="icon" className="rounded-full" aria-label="Compartir por WhatsApp">
          <MessageCircle className="w-4 h-4" />
        </Button>
      </a>
      <a href={facebookUrl} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" size="icon" className="rounded-full" aria-label="Compartir en Facebook">
          <Facebook className="w-4 h-4" />
        </Button>
      </a>
      <a href={twitterUrl} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" size="icon" className="rounded-full" aria-label="Compartir en X">
          <Twitter className="w-4 h-4" />
        </Button>
      </a>
      <Button variant="outline" size="icon" className="rounded-full" aria-label="Copiar link" onClick={handleCopyLink}>
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </Button>
    </div>
  );
}
