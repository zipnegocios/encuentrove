import * as React from "react";

interface Props {
  text: string;
  className?: string;
  speed?: number;
  gap?: number;
}

// El placeholder nativo de <input> no se puede animar de forma confiable
// (::placeholder no soporta transform/animation en la mayoria de navegadores).
// Este componente se superpone al input (ver BuscarPage) y desplaza el texto
// en bucle solo cuando no entra completo en el ancho disponible.
export function MarqueeText({ text, className, speed = 38, gap = 48 }: Props) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLSpanElement>(null);
  const [scrollState, setScrollState] = React.useState<{ scroll: boolean; distance: number; duration: number }>({
    scroll: false,
    distance: 0,
    duration: 0,
  });

  React.useEffect(() => {
    const measure = () => {
      const containerWidth = containerRef.current?.offsetWidth ?? 0;
      const textWidth = textRef.current?.offsetWidth ?? 0;
      const scroll = containerWidth > 0 && textWidth > containerWidth;
      const distance = textWidth + gap;
      setScrollState({ scroll, distance, duration: distance / speed });
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [text, gap, speed]);

  const wrapperStyle: React.CSSProperties | undefined = scrollState.scroll
    ? ({
        animation: `marquee-scroll ${scrollState.duration}s linear infinite`,
        animationDelay: "0.8s",
        "--marquee-distance": `${scrollState.distance}px`,
      } as React.CSSProperties)
    : undefined;

  return (
    <div ref={containerRef} className={`overflow-hidden whitespace-nowrap ${className ?? ""}`}>
      <div className={scrollState.scroll ? "inline-flex" : "inline-block"} style={wrapperStyle}>
        <span ref={textRef}>{text}</span>
        {scrollState.scroll && <span style={{ marginLeft: gap }}>{text}</span>}
      </div>
    </div>
  );
}
