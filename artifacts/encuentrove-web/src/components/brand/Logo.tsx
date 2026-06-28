import * as React from "react";

export function Logo({ width = 160, height = 32, className = "" }: { width?: number | string, height?: number | string, className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="EncuentroVE"
      width={width}
      height={height}
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}
