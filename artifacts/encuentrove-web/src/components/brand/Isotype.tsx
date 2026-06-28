import * as React from "react";

export function Isotype({ width = 24, height = 24, className = "" }: { width?: number | string, height?: number | string, className?: string }) {
  return (
    <img
      src="/icono.png"
      alt="EncuentroVE ícono"
      width={width}
      height={height}
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}
